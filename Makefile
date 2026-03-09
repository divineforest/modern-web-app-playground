.PHONY: dev stop logs status infra backend web worker \
        stop-backend stop-web stop-worker

PIDS := pids
LOGS := logs

# ── Full stack ──────────────────────────────────────────────────────────────────

dev: infra
	@$(MAKE) --no-print-directory backend web
	@echo ""
	@echo "  Stack running."
	@echo "  Logs:   make logs"
	@echo "  Status: make status"
	@echo "  Stop:   make stop"

stop: stop-backend stop-web stop-worker
	docker compose down
	@echo "Infrastructure stopped."

logs:
	@tail -f $(LOGS)/*.log

status:
	@echo "Application services:"
	@for svc in backend web worker; do \
		if [ -f $(PIDS)/$$svc.pid ] && kill -0 $$(cat $(PIDS)/$$svc.pid) 2>/dev/null; then \
			echo "  $$svc  running  (pid $$(cat $(PIDS)/$$svc.pid))"; \
		else \
			echo "  $$svc  stopped"; \
		fi; \
	done
	@echo ""
	@echo "Infrastructure:"
	@docker compose ps --format "  {{.Service}}  {{.Status}}"

# ── Infrastructure ──────────────────────────────────────────────────────────────

infra:
	@docker compose up -d
	@printf "Waiting for Postgres"
	@until docker compose exec -T db pg_isready -U user -q 2>/dev/null; do \
		printf "."; sleep 1; \
	done
	@echo " ready."

# ── Application services ────────────────────────────────────────────────────────

define start_service
	@mkdir -p $(PIDS) $(LOGS)
	@if [ -f $(PIDS)/$(1).pid ] && kill -0 $$(cat $(PIDS)/$(1).pid) 2>/dev/null; then \
		echo "  $(1)  already running  (pid $$(cat $(PIDS)/$(1).pid))"; \
	else \
		rm -f $(PIDS)/$(1).pid; \
		$(2) >> $(LOGS)/$(1).log 2>&1 & echo $$! > $(PIDS)/$(1).pid; \
		echo "  $(1)  started  (pid $$(cat $(PIDS)/$(1).pid))  →  $(LOGS)/$(1).log"; \
	fi
endef

define stop_service
	@if [ -f $(PIDS)/$(1).pid ]; then \
		kill $$(cat $(PIDS)/$(1).pid) 2>/dev/null || true; \
		rm -f $(PIDS)/$(1).pid; \
		echo "  $(1)  stopped"; \
	fi
endef

backend:
	$(call start_service,backend,pnpm dev)

web:
	$(call start_service,web,pnpm dev:web)

worker:
	$(call start_service,worker,pnpm temporal:worker)

stop-backend:
	$(call stop_service,backend)

stop-web:
	$(call stop_service,web)

stop-worker:
	$(call stop_service,worker)
