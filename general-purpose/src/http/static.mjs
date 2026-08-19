import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { resolveAssetPath } from '../core/asset-path.mjs';

export const CONTENT_TYPE_BY_EXTENSION = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
});

export async function serveStatic(publicDir, pathname) {
  const assetPath = resolveAssetPath(pathname);
  if (assetPath === null) {
    return { kind: 'not-found' };
  }
  const contentType = CONTENT_TYPE_BY_EXTENSION[extname(assetPath)];
  if (contentType === undefined) {
    return { kind: 'not-found' };
  }
  const absolute = join(publicDir, assetPath);
  try {
    const body = await readFile(absolute);
    return { kind: 'ok', body, contentType };
  } catch {
    return { kind: 'not-found' };
  }
}
