# Process Management for Development Services

**Status:** accepted
**Date:** 2026-03-09

## Context

The project runs multiple services in development: infrastructure services (PostgreSQL, Redis, Temporal) and application services (Node.js backend, web frontend). These services were started independently by each developer or tool (Claude Code, Cursor, terminal) with no coordination mechanism. This caused three recurring problems:

**Duplicate instances:** Running `pnpm dev` from two terminals, or from both an IDE and a terminal, starts multiple backend processes on the same port. The conflict is usually silent until a request fails or port binding throws an error.

**Invisible logs:** Each tool only sees the stdout of what it started. Logs from a process started by Claude Code are not visible in the developer's terminal, and vice versa. Debugging requires knowing which tool started what.

**Multi-step startup:** Starting the full stack required multiple manual commands across multiple terminal tabs: start the database, wait for it, start the backend, start the frontend. No single command brought up the full environment.

### Pre-decision state

```
docker compose up            # starts only postgres (docker-compose.yml)
pnpm --filter backend dev    # started separately, per-tool
pnpm --filter web dev        # started separately, per-tool
```

Docker Compose was already a project dependency for PostgreSQL. Infrastructure services (Postgres, Redis, Temporal) are well-suited for Docker — they are stateful, version-pinned, and have no need for hot reload. Application services are Node.js processes that benefit from direct execution: fast startup, native hot reload via `tsx watch`, and straightforward debugger attachment.

## Decision

Use a **hybrid approach**: Docker Compose for infrastructure services, Makefile with PID files for application services.

- **Docker Compose** manages Postgres, Redis, Temporal, and any other stateful infrastructure. This is unchanged from the current setup.
- **Makefile** manages the backend and web processes as native Node.js processes, using PID files in `.pids/` for duplicate prevention and log files in `.logs/` for shared log access.

```bash
make dev     # start infra + all app services
make stop    # stop all app services + infra
make logs    # tail unified log stream
make status  # show what is running
```

No new tooling is introduced. `make` is universally available. Docker Compose is already a project dependency.

### 1. Makefile structure

```makefile
.PHONY: dev stop logs status infra backend web

PIDS := .pids
LOGS := .logs

# ── Full stack ─────────────────────────────────────────────────────────────────

dev: infra
	@$(MAKE) --no-print-directory backend web
	@echo "Stack running. Logs: make logs  Status: make status"

stop:
	@for svc in backend web; do \
		if [ -f $(PIDS)/$$svc.pid ]; then \
			kill $$(cat $(PIDS)/$$svc.pid) 2>/dev/null || true; \
			rm -f $(PIDS)/$$svc.pid; \
			echo "$$svc stopped"; \
		fi; \
	done
	docker compose down

logs:
	@tail -f $(LOGS)/*.log

status:
	@for svc in backend web; do \
		if [ -f $(PIDS)/$$svc.pid ] && kill -0 $$(cat $(PIDS)/$$svc.pid) 2>/dev/null; then \
			echo "$$svc  running  (pid $$(cat $(PIDS)/$$svc.pid))"; \
		else \
			echo "$$svc  stopped"; \
		fi; \
	done
	@docker compose ps --format "table {{.Service}}\t{{.Status}}"

# ── Infrastructure ─────────────────────────────────────────────────────────────

infra:
	@docker compose up -d
	@echo "Waiting for Postgres..." && until docker compose exec db pg_isready -U user -q; do sleep 1; done

# ── Application services ───────────────────────────────────────────────────────

backend:
	@mkdir -p $(PIDS) $(LOGS)
	@if [ -f $(PIDS)/backend.pid ] && kill -0 $$(cat $(PIDS)/backend.pid) 2>/dev/null; then \
		echo "backend already running (pid $$(cat $(PIDS)/backend.pid))"; \
	else \
		rm -f $(PIDS)/backend.pid; \
		pnpm --filter backend dev >> $(LOGS)/backend.log 2>&1 & echo $$! > $(PIDS)/backend.pid; \
		echo "backend started  (pid $$(cat $(PIDS)/backend.pid))"; \
	fi

web:
	@mkdir -p $(PIDS) $(LOGS)
	@if [ -f $(PIDS)/web.pid ] && kill -0 $$(cat $(PIDS)/web.pid) 2>/dev/null; then \
		echo "web already running (pid $$(cat $(PIDS)/web.pid))"; \
	else \
		rm -f $(PIDS)/web.pid; \
		pnpm --filter web dev >> $(LOGS)/web.log 2>&1 & echo $$! > $(PIDS)/web.pid; \
		echo "web started  (pid $$(cat $(PIDS)/web.pid))"; \
	fi
```

### 2. Duplicate instance prevention

Before starting a service, the Makefile checks both conditions:
1. A PID file exists at `.pids/<service>.pid`
2. The process with that PID is alive (`kill -0 $pid`)

If either condition fails, the PID file is cleaned up and the service starts fresh. This handles stale PID files from unclean shutdowns (kill -9, machine restart) without manual intervention. Starting a second instance from any tool — terminal, Claude Code, Cursor — prints a message and exits cleanly rather than binding to the same port.

### 3. Unified log access

Application services write stdout and stderr to `.logs/<service>.log`. Any tool reads logs with the same commands:

```bash
make logs                      # tail all services
tail -f .logs/backend.log      # backend only
tail -n 100 .logs/web.log      # last 100 lines
```

Log files are project-local, not machine-global. Logs persist across restarts and are available even after the process exits — useful for debugging startup failures.

Add to `.gitignore`:

```
.pids/
.logs/
```

### 4. Infrastructure dependency ordering

The `infra` target starts Docker Compose in detached mode and polls `pg_isready` before returning. Application services only start after `infra` succeeds. This eliminates the class of startup race conditions where the backend exits immediately because Postgres is not yet accepting connections.

### 5. One-command startup

```bash
make dev
```

This single command starts Docker Compose infrastructure, waits for Postgres readiness, then starts backend and web as background processes with logs and PID tracking. Any tool that can run a shell command uses the same entry point.

## Consequences

### Positive

- **Single entry point:** `make dev` starts the full stack from any tool.
- **No duplicate instances:** PID + liveness check prevents silent port conflicts. Stale PIDs from crashes are cleaned up automatically.
- **Shared logs:** Project-local log files at `.logs/` are accessible to any tool or terminal, regardless of which tool started the process.
- **No new dependencies:** `make` is universally available. Docker Compose is already required for infrastructure.
- **Native Node.js execution:** Application services run directly with `tsx watch` — instant hot reload, native debugger attachment, no container rebuild cycle.
- **Fast iteration:** Source changes reflect immediately without sync or rebuild steps.
- **Clear separation of concerns:** Infrastructure (stateful, version-pinned, no hot reload needed) runs in Docker. Applications (stateless, frequently changed, debugger-attached) run natively.

### Negative

- **Makefile boilerplate per service:** Adding a new application service requires a new target with the PID/log pattern. Mitigated by the consistent pattern being copy-paste.
- **Log rotation not built-in:** `.logs/` files grow unbounded. For a dev environment this is acceptable; add `logrotate` if needed.
- **No process restart on crash:** If the backend crashes, it must be manually restarted with `make backend`. PM2 or a supervisor handles auto-restart; this setup does not.

### AI-Friendliness Impact

- **Discoverability:** 5/5 — `make dev`, `make stop`, `make logs`, `make status` are self-documenting targets. Any tool discovers them by reading the Makefile.
- **Log access:** 5/5 — Fixed paths at `.logs/<service>.log` are readable by any tool with `tail -f`. No Docker daemon or session state required.
- **Duplicate prevention:** 4/5 — PID + liveness check is reliable for normal operation. An LLM calling `make backend` when it is already running gets a clear message rather than a port conflict.
- **Reproducibility:** 4/5 — Same `make` targets work identically from any tool. Log files persist across restarts, improving debuggability.

**Overall AI-friendliness: 4.5/5** — Fixed log paths and idempotent make targets give any tool a reliable, scriptable interface. The minor gap from 5/5 is the lack of auto-restart on crash; a crashed service requires `make <service>` to recover rather than recovering automatically.

## Options Considered

### Option A: Makefile with PID files + Docker Compose for infrastructure (chosen)

Makefile manages application services (backend, web). Docker Compose manages infrastructure (Postgres, Redis, Temporal). PID files prevent duplicates; project-local log files provide shared access.

**Trade-offs:** Per-service Makefile boilerplate. No auto-restart on crash. In exchange: zero new dependencies, native Node.js execution, fast hot reload, straightforward debugger attachment.

**AI-friendliness: 4.5/5**

### Option B: Docker Compose extended to all services

Extend `docker-compose.yml` to include backend and web services. Single tool manages everything.

**Rejected because:**
- Application services in Docker require Dockerfiles and a container rebuild cycle for dependency changes. Native hot reload (`tsx watch`) requires Docker Compose Watch or volume mounts with additional configuration.
- Attaching a Node.js debugger to a containerized process requires exposing the debug port and configuring remote attach — non-trivial one-time setup per developer.
- Application services have fundamentally different characteristics from infrastructure (frequently rebuilt, debugger-attached, hot-reloaded). Containerizing them adds overhead without benefit in a dev environment.
- Docker Compose Watch (for sync-based hot reload) is available since Compose v2.22 but adds config surface area.

**AI-friendliness: 5/5** — Uniform interface for all services, but at the cost of dev-cycle friction for application services.

### Option C: PM2 with ecosystem.config.js

PM2 as a Node.js process manager for application services. Docker Compose retained for infrastructure.

**Rejected because:**
- Adds a new global dependency (`npm install -g pm2`) not in `package.json` or `devDependencies`.
- Log paths default to `~/.pm2/logs/` — machine-global, shared across all projects on the machine.
- PM2 is Node.js–specific; adding non-Node application services requires a different solution.
- The split between PM2 and Docker Compose introduces two mental models for the same concern (process lifecycle).

**AI-friendliness: 4/5** — Named processes and consistent CLI are good, but machine-global log paths and the new global dependency reduce portability.

### Option D: Overmind (Procfile-based)

`Procfile` with all services, managed by Overmind. Logs via tmux panes, attachable from any terminal.

**Rejected because:**
- Adds Overmind as a new dependency (Homebrew install, not in `package.json`).
- The Overmind process must remain in the foreground; backgrounding loses the tmux session and log access.
- Infrastructure readiness (Postgres, Temporal) is not handled; services start in parallel regardless of database state.
- tmux pane log access is interactive-only — not accessible to non-interactive tools like Claude Code or CI scripts.

**AI-friendliness: 3/5** — Procfile is readable, but tmux-based logs are not scriptable.
