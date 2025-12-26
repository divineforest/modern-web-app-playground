// IMPORTANT: Import instrument.ts at the very top to initialize Sentry
import './instrument.js';
import { buildApp } from './app.js';
import { serverHost, serverPort } from './config/server.js';

// Graceful shutdown handler
const gracefulShutdown = async (signal: string, fastify: Awaited<ReturnType<typeof buildApp>>) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully`);
  try {
    await fastify.close();
    process.exit(0);
  } catch (err) {
    fastify.log.error(
      `Error during graceful shutdown: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }
};

// Start server
async function start() {
  try {
    // Build the Fastify application
    const fastify = await buildApp();

    // Set up graceful shutdown handlers
    // Note: gracefulShutdown() never rejects (always calls process.exit), so void is appropriate
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', fastify));
    process.on('SIGINT', () => void gracefulShutdown('SIGINT', fastify));

    // Start the server
    await fastify.listen({ port: serverPort, host: serverHost });
    fastify.log.info(`🚀 Server ready at http://${serverHost}:${serverPort}`);
    fastify.log.info(`📚 API docs available at http://${serverHost}:${serverPort}/docs`);
  } catch (err) {
    console.error(`Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Note: start() never rejects (always calls process.exit on error), so void is appropriate
  void start();
}

export { start };
