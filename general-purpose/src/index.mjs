import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { createRequestListener } from './http/router.mjs';

export const SERVER_LIMITS = Object.freeze({
  headersTimeout: 10_000,
  requestTimeout: 30_000,
  keepAliveTimeout: 5_000,
  maxRequestsPerSocket: 1_000,
});

const DEFAULT_PORT = 3000;
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

export function readConfig(env) {
  const port = Number(env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`invalid PORT: ${env.PORT}`);
  }
  return Object.freeze({ port, publicDir: PUBLIC_DIR });
}

export function createApp(config) {
  const server = createServer(createRequestListener(config));
  server.headersTimeout = SERVER_LIMITS.headersTimeout;
  server.requestTimeout = SERVER_LIMITS.requestTimeout;
  server.keepAliveTimeout = SERVER_LIMITS.keepAliveTimeout;
  server.maxRequestsPerSocket = SERVER_LIMITS.maxRequestsPerSocket;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = readConfig(process.env);
  createApp(config).listen(config.port, () => {
    console.log(`listening on ${config.port}`);
  });
}
