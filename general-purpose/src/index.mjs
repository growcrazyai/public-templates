import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function resolveAsset(urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const candidate = normalize(join(PUBLIC_DIR, decodeURIComponent(requested)));
  return candidate.startsWith(PUBLIC_DIR) ? candidate : null;
}

export async function handler(request, response) {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const asset = resolveAsset(url.pathname);
  if (asset === null) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('forbidden');
    return;
  }
  try {
    const body = await readFile(asset);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(asset)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
}

export function createApp() {
  return createServer(handler);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`listening on ${port}`);
  });
}
