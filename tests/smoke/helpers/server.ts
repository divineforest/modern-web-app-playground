import { spawn, type ChildProcess } from 'node:child_process';

export interface ServerOptions {
  mode: 'dev' | 'build';
  host?: string;
  port?: number;
  timeoutMs?: number;
}

export interface ServerResult {
  process: ChildProcess;
  url: string;
  cleanup: () => void;
}

/**
 * Starts the server process and waits for it to be ready
 */
export async function startServer(options: ServerOptions): Promise<ServerResult> {
  const {
    mode,
    host = 'localhost',
    port = 3001,
    timeoutMs = 30000, // 30s default timeout
  } = options;

  const url = `http://${host}:${port}`;

  console.log(`[SMOKE] Starting ${mode} server on ${url}...`);

  // Determine which command to run based on mode
  const command = 'pnpm';
  const args = mode === 'dev' ? ['dev'] : ['start'];

  // Spawn server process
  const serverProcess = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'], // pipe all stdio so we can monitor
    env: {
      ...process.env,
      PORT: port.toString(),
      HOST: host,
    },
  });

  // Log server output for debugging
  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[SERVER] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[SERVER ERR] ${data.toString().trim()}`);
  });

  // Cleanup function
  const cleanup = () => {
    console.log(`[SMOKE] Stopping server (PID: ${serverProcess.pid})`);
    if (!serverProcess.killed) {
      serverProcess.kill('SIGTERM');

      // Give it 5 seconds to shut down gracefully
      global.setTimeout(() => {
        if (!serverProcess.killed) {
          console.log('[SMOKE] Force killing server');
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  };

  // Set up cleanup on process exit
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Wait for server to be ready
  await waitForServer(`${url}/healthz`, timeoutMs);

  console.log(`[SMOKE] Server is ready at ${url}`);

  return {
    process: serverProcess,
    url,
    cleanup,
  };
}

/**
 * Polls the health endpoint until the server responds successfully or timeout
 */
export async function waitForServer(healthUrl: string, timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 1000; // Check every 1 second

  console.log(
    `[SMOKE] Waiting for server to be ready at ${healthUrl} (timeout: ${timeoutMs}ms)...`
  );

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(healthUrl, {
        method: 'HEAD', // HEAD request is lighter than GET
        signal: AbortSignal.timeout(5000), // 5s timeout per request
      });

      if (response.ok) {
        console.log(`[SMOKE] Server responded with ${response.status} - ready!`);
        return;
      }

      console.log(`[SMOKE] Server responded with ${response.status} - waiting...`);
    } catch (error) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(
        `[SMOKE] Server not ready yet (${elapsed}s elapsed) - ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    await new Promise((resolve) => global.setTimeout(resolve, pollInterval));
  }

  throw new Error(`Server failed to start within ${timeoutMs}ms at ${healthUrl}`);
}
