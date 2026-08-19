import { respond } from './respond.mjs';
import { serveStatic } from './static.mjs';

export const routes = Object.freeze([]);

export function createRequestListener({ publicDir }) {
  return async (request, response) => {
    let outcome;
    try {
      const url = new URL(request.url, 'http://localhost');
      const route = routes.find(
        (candidate) => candidate.method === request.method && candidate.pathname === url.pathname,
      );
      if (route !== undefined) {
        outcome = await route.handler(request, url);
      } else if (request.method === 'GET') {
        outcome = await serveStatic(publicDir, url.pathname);
      } else {
        outcome = { kind: 'method-not-allowed' };
      }
    } catch (error) {
      console.error('request handling failed:', error);
      outcome = { kind: 'failure' };
    }
    respond(response, outcome);
  };
}
