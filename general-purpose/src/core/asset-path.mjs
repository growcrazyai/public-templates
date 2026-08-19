export function resolveAssetPath(urlPath) {
  if (typeof urlPath !== 'string' || urlPath === '') {
    return null;
  }
  const target = urlPath === '/' ? '/index.html' : urlPath;
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }
  const segments = decoded.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0 || segments.includes('..')) {
    return null;
  }
  return segments.join('/');
}
