export const SECURITY_HEADERS = Object.freeze({
  'content-security-policy':
    "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), geolocation=(), microphone=()',
  'cross-origin-opener-policy': 'same-origin',
});

const STATUS_BY_KIND = Object.freeze({
  ok: 200,
  'not-found': 404,
  'method-not-allowed': 405,
  failure: 500,
});

const GENERIC_BODY_BY_KIND = Object.freeze({
  'not-found': 'not found',
  'method-not-allowed': 'method not allowed',
  failure: 'server failure',
});

const TEXT_PLAIN = 'text/plain; charset=utf-8';

export function respond(response, outcome) {
  const status = STATUS_BY_KIND[outcome.kind] ?? STATUS_BY_KIND.failure;
  const body =
    outcome.kind === 'ok' ? outcome.body : GENERIC_BODY_BY_KIND[outcome.kind] ?? GENERIC_BODY_BY_KIND.failure;
  const contentType = outcome.kind === 'ok' ? outcome.contentType : TEXT_PLAIN;
  response.writeHead(status, { ...SECURITY_HEADERS, 'content-type': contentType });
  response.end(body);
}
