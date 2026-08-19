const FRONTEND = process.env.FRONTEND_ORIGIN ?? 'http://127.0.0.1:3000';
const BACKEND = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:8080';
const MUTATION_HEADER = 'x-requested-by';
const failures = [];

function assert(condition, claim) {
  if (condition) {
    console.log(`  ok: ${claim}`);
  } else {
    failures.push(claim);
    console.error(`  FAILED: ${claim}`);
  }
}

async function until(claim, probe, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await probe()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`gave up waiting: ${claim}`);
}

await until('the backend answers readiness', async () => (await fetch(`${BACKEND}/readyz`)).status === 200);
await until('the frontend serves the page', async () => (await fetch(FRONTEND)).status === 200);

console.log('readiness:');
assert((await fetch(`${BACKEND}/readyz`)).status === 200, 'readiness is green against the real store');
assert((await fetch(`${BACKEND}/healthz`)).status === 200, 'liveness answers');

console.log('mutation through the rewrite (browser path):');
const seeded = `seeded at ${Date.now()}`;
const created = await fetch(`${FRONTEND}/api/notes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', [MUTATION_HEADER]: 'e2e' },
  body: JSON.stringify({ body: seeded }),
});
assert(created.status === 201, 'a note is created through the same-origin rewrite');
const note = await created.json();
assert(note.body === seeded, 'the created note echoes its body');

console.log('server-rendered page (server client path):');
const page = await fetch(FRONTEND);
const html = await page.text();
assert(page.status === 200, 'the page renders');
assert(html.includes(seeded), 'the page shows the seeded note through the server-side generated client');

console.log('security headers:');
const csp = page.headers.get('content-security-policy') ?? '';
assert(csp.includes("default-src 'self'"), 'the content security policy is declared');
assert(csp.includes("frame-ancestors 'none'"), 'the policy refuses framing');
assert(page.headers.get('x-content-type-options') === 'nosniff', 'content types are not sniffed');
assert((page.headers.get('referrer-policy') ?? '') !== '', 'a referrer policy is declared');

console.log('refusal shape (problem-json, opaque outward):');
const refused = await fetch(`${FRONTEND}/api/notes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', [MUTATION_HEADER]: 'e2e' },
  body: JSON.stringify({ body: '   ' }),
});
assert(refused.status === 422, 'an invariant violation is refused with 422');
assert((refused.headers.get('content-type') ?? '').startsWith('application/problem+json'), 'the refusal is problem-json');
const problem = await refused.json();
assert(typeof problem.title === 'string' && problem.status === 422, 'the refusal carries title and status');
assert(!JSON.stringify(problem).includes('mongodb'), 'the refusal is opaque about internals');

const headerless = await fetch(`${FRONTEND}/api/notes`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ body: 'x' }),
});
assert(headerless.status === 403, 'a mutation without its origin header is refused');

if (failures.length > 0) {
  console.error(`seam witness: ${failures.length} claims failed`);
  process.exit(1);
}
console.log('seam witness: every claim holds through the production topology');
