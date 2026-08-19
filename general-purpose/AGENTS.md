# Working in this project

This project was born from the `general-purpose` template line. Its law is
mechanical: the gate below verifies the conventions, so what follows is not a
plea for discipline — it is the map of what the gate enforces, why, and how to
amend it.

The gate's rules carry one of two strengths. A **refusal** rule is total over
its stated scope: within that scope, no tree that violates it goes green. A
**tripwire** rule catches the direct and demonstrated-adversarial forms of a
violation; its silence is never permission. Code that passes a tripwire's
letter while violating its spirit is non-conformant the moment it exists —
green is not a defence — and whoever discovers such code carries the
gate-amendment burden: correct the code, and where the evasion is textual,
harden the tripwire to catch that form.

## Enforcement-strength map

The convention verifier (`checks/verify.mjs`) owns the repo-level and
cross-tier rules:

| Rule | Strength | Exact scope |
| --- | --- | --- |
| `secret-scan` | refusal | every committed file except the coded exclusions named under Amendment; files over 1 MiB or with a NUL in the leading bytes are skipped as binary |
| `lockfile-presence` | refusal | `Cargo.lock` and `web/package-lock.json` exist |
| `install-script-refusal` | refusal | `web/.npmrc` contains the line `ignore-scripts=true` |
| `toolchain-pin` | refusal | `rust-toolchain.toml` pins an exact version; `engines.node` in `web/package.json` is exactly `>=22.15`; `.nvmrc` is exactly `22.15.1`; `packageManager` is declared |
| `env-site-confinement` (backend) | tripwire | the token `std::env` appears in no file under `crates/*/src/` except `crates/server/src/config.rs` |
| `env-site-confinement` (frontend) | tripwire | `process.env` only in `web/src/env/` and `web/next.config.ts`; `NEXT_PUBLIC_` names referenced only inside `web/src/env/` |
| `server-secrecy-marker` | refusal | the first import of `web/src/env/server.ts` is the `server-only` guard |
| `query-injection-refusal` | tripwire | `$where` nowhere under `crates/*/src/`; `format!` and string concatenation inside `doc! { … }` blocks (direct, line-visible forms) |
| `same-origin-refusal` | tripwire | no `CorsLayer` or `tower_http::cors` token under `crates/*/src/`; no `cors` feature token in any `crates/*/Cargo.toml` |
| `layer-dependency` | refusal | `crates/domain/Cargo.toml` `[dependencies]` names ⊆ {serde, thiserror}; `crates/http/Cargo.toml` names neither `store-mongo` nor `mongodb` |
| `contract-unidirection` | refusal | every committed file under `web/src/generated/` carries the openapi-typescript generator banner; `contract/openapi.json` is committed (the drift stage is the deep control; this rule keeps provenance honest) |
| `client-boundary-budget` | tripwire | files under `web/src/` carrying a `'use client'` directive number at most 5 (birth uses 1) |
| `size-ceiling` | refusal | files under `crates/*/src/` and `web/src/` are at most 300 lines; coded exclusion: `web/src/generated/` |

The per-tier tools own what a parser-owning tool enforces exactly; these rows
are as binding as the verifier's:

| Enforcer | Strength | What it enforces |
| --- | --- | --- |
| `cargo clippy … -D warnings` + workspace lints | refusal | no `unwrap`/`expect`/`panic` in production code (test code carries an explicit allow); `too_many_lines` at clippy's default function ceiling; every clippy and compiler warning is an error |
| `eslint` (flat config, next presets) | refusal | Next/React idiom law; `max-lines-per-function` at 60; `no-eval`, `no-implied-eval` |
| `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) | refusal | strict types across `web/src` |
| `cargo fmt --check`, `prettier --check` | refusal | no formatting drift |
| contract stage | refusal | every operation in the emitted contract is exercised by the contract tests, or the gate is red |
| contract-drift stage | refusal | `contract/openapi.json` and `web/src/generated/` are byte-identical to regeneration from the Rust annotations |
| `cargo-deny check` + `npm audit` | refusal | the dependency ledger's advisories, licenses, and sources hold today |

## Invariants

- **One gate, one meaning.** `just gate` is the single definition of done, the
  `dev-loop` build label the platform observes, and the template line's own
  conformance proof. `just dev` is watch-mode convenience, never the gate.
- **The template obeys its own law, with headroom.** The gate passed at the
  template's own publication; budgets are not at their limits (1 of 5 client
  leaves, files well under the ceiling).
- **The map is honest.** Every enforcement claim in this document is true of
  the verifier and the linter configurations. Amending one re-verifies the
  other.
- **The dependency ledger is closed.** Every third-party name resolves from a
  committed lockfile (`Cargo.lock`, `web/package-lock.json`); installation is
  inert (`ignore-scripts=true`); the ledger is audited inside the gate
  (`cargo-deny`: advisories, licenses, sources; `npm audit`); and the ledger
  changes only by the admission procedure under Amendment. The birth set is
  the first admitted ledger — every birth dependency appears in the
  birth-ledger table below with its reason — so day one and day one-thousand
  obey the same law.
- **Singleton sites.** Backend: one environment read
  (`crates/server/src/config.rs`, fail-fast), one error→response mapping
  (`crates/http/src/error.rs`), one middleware-stack declaration
  (`crates/http/src/lib.rs`), one store client per process (the handle is
  cloned into state), one schema-plus-index declaration beside each model.
  Frontend: one env module (`web/src/env/`, split server/client), one
  client-construction seam (`web/src/lib/`, split browser/server), one rewrite
  table (`web/next.config.ts`). Cross-tier: one contract source (the Rust
  annotations), one generated chain, one store-lifecycle site (the justfile),
  one seam-address value (the orchestrator's `backend_origin`).
- **The core is pure.** `crates/domain` has no runtime, no I/O, and
  dependencies ⊆ {serde, thiserror}. The persistence port (the store trait)
  lives there; the crate graph makes the dependency direction mechanical —
  the adapter depends on the core, never the reverse, and the api boundary
  cannot see the driver.
- **The contract flows one way.** Rust annotations → `contract/openapi.json` →
  `web/src/generated/`, committed and drift-gated. Hand-kept API mirrors are
  banned.
- **Same origin, no CORS.** The browser speaks only its own origin; the
  rewrite in `web/next.config.ts` carries `/api/*` to the backend; cookies
  flow. A CORS layer is a tripwired violation, not a fix.
- **Refusal is opaque outward, precise inward.** Clients get problem-JSON
  without internals; tracing carries detail to the server-side log only.
- **Secrets never live in the tree.** The scan is the control; the `.env`
  entry in `.gitignore` is hygiene. Configuration enters through the
  environment at the two confined sites.
- **Placement follows the concern map.** `module-map.json` names the directory
  for each concern; add a concern there and to the ownership table below
  before inventing a directory.
- **State is explicit.** Caching is opt-in (`cacheComponents` is on: dynamic
  by default, `'use cache'` deliberate); client interactivity is leaf-ward
  within the counted budget; store reads tolerate unknown fields (no
  `deny_unknown_fields` on read models), store writes are schema-validated
  (`$jsonSchema`, strict).
- **Coverage is seam coverage.** The contract stage refuses if any operation
  in the emitted contract is unexercised, and the seam witness proves the
  composed production topology. There is no line-coverage percentage; the
  seams are the promise.

## Who owns what

| Path | Concern |
| --- | --- |
| `justfile` | Orchestration: the gate's ordered stages, the ephemeral store lifecycle, the seam addresses (`backend_origin`, `frontend_origin`), the pinned store image digest, the `cargo-deny` version assertion. |
| `checks/` | The convention verifier — one zero-dependency script, thirteen named rules. |
| `contract/` | The emitted contract artifact. Written only by the emit binary through the drift stage; never by hand. |
| `crates/domain/` | The meaning of the application: entities, invariants, domain errors, the persistence port. Pure — no runtime, no I/O. |
| `crates/store-mongo/` | The persistence adapter: typed collections, `doc!{}`-only queries, the `$jsonSchema` validator beside each read model, named idempotent indexes, `SCHEMA_VERSION` with ordered migrations and the applied-migrations ledger. |
| `crates/http/` | The wire boundary: spec-annotated routes, the validated-body extractor (`deny_unknown_fields` DTOs), the single error→problem-JSON mapping, the middleware stack, the mutation-header check, liveness and readiness. Knows the domain only. |
| `crates/server/` | The composition shell: the one env read, wiring adapter into boundary through the port, graceful shutdown, the emit binary, and the contract tests. |
| `web/` | The server-rendered experience: App Router, server components by default, the env modules, the client seam, the rewrite table, security headers, standalone output. |
| `web/src/generated/` | Written only by openapi-typescript through the drift stage. |
| `e2e/` | The seam witness: the production-topology smoke proof. |
| `Cargo.toml`, `web/package.json` | The manifests: workspace members and lints; pins, engines, scripts. |
| `sdlc.toml` | The build contract; the `dev-loop` label runs `just gate`, the same gate the platform observes. |
| `module-map.json` | The concern map this table mirrors. |

## The development loop

```
just gate
```

Ordered, fail-fast, cheap→expensive; every stage names its meaning:

| Stage | Proof |
| --- | --- |
| `verify` | the thirteen repo-level and cross-tier rules hold |
| `deps` | the frontend dependency ledger realizes exactly (`npm ci`, inert) |
| `format` | no formatting drift (`cargo fmt --check`, `prettier --check`) |
| `lint` | per-tier idiom law (`cargo clippy -D warnings` + workspace lints; `eslint`) |
| `typecheck` | strict TypeScript including `noUncheckedIndexedAccess` |
| `unit` | domain meaning, no I/O (`cargo test --lib`) |
| `build-backend` | the composed shell compiles; the emit binary exists |
| `store-up` | the digest-pinned single-node replica-set store is primary |
| `contract` | the real seam: axum on port 0 against the real store; refusals are problem-JSON; validator, index, and ledger take effect; every contract operation exercised or red |
| `contract-drift` | the contract flows one way and is committed byte-identical |
| `build-frontend` | the experience compiles against the committed client; standalone output |
| `e2e` | the tri-tier seam through the production topology (`e2e/smoke.mjs`) |
| `store-down` | no residue, also on failure (trap) |
| `audit` | the ledger's resting state holds today (`cargo-deny`, `npm audit`) |

Audits run last: they are network-dependent and time-varying; deterministic
failures surface first. A fresh advisory reddening the gate without a code
change is by design — the response is the amendment procedure, never a
weakened stage.

The gate has one machine prerequisite beyond the toolchains: a running
container runtime (Docker), which boots the ephemeral store. `just dev` is
the inner loop — store up, watch mode, no proofs — and is not the gate.

## Capability map — what NOT to add, per tier

- **No ODM/ORM.** Typed collections and `doc!{}` queries are the sanctioned
  persistence path.
- **No second HTTP client in either tier.** The generated client
  (`openapi-fetch` over `web/src/generated/`) is the only way the frontend
  names the API; the contract tests speak to the boundary directly over the
  socket with no client library.
- **No CORS layer.** Same origin by rewrite is the seam; a cross-origin need
  is a design event, not a header.
- **No Next API route handlers.** Rust owns the API surface. A
  backend-for-frontend need is an admission-procedure event.
- **No hand-kept API types.** The generated chain is the only mirror.
- **No second store-boot mechanism.** No compose file, no in-process store;
  the justfile is the one boot site.
- **No state-management or CSS-framework dependency without admission.**
- **`next/image` and `next/font`** are the only asset and font paths
  (lint-enforced by the next presets).

## Integration-seam teachings

- **Server-component reads go direct** to the backend origin through
  `web/src/lib/api-server.ts`, which forwards the caller's cookies explicitly
  — this indirection is why cookies flow and CORS never exists. Browser
  traffic crosses the rewrite instead.
- **Caching is explicit.** `cacheComponents` is on: everything is dynamic
  unless a scope declares `'use cache'`. Request-time reads live under a
  `<Suspense>` boundary, as the notes list does.
- **Mutations carry the custom header.** The boundary refuses non-GET requests
  without `x-requested-by` (403 problem-JSON). This is the CSRF discipline
  from birth, without an auth system; keep sending it from every mutation
  site.
- **axum 0.8 path syntax** is `/{id}`, not `/:id`.
- **Transactions require the replica set** — the harness already boots the
  store as a single-node replica set, so multi-document transactions are
  possible from birth.
- **Reads tolerate, writes validate.** Read models omit
  `deny_unknown_fields`; the `$jsonSchema` validator (strict, error) binds
  writes. Wire DTOs, by contrast, do declare `deny_unknown_fields` — the
  boundary is exact, the store is forward-compatible.
- **The seam address is one value.** The backend origin lives in the justfile
  and is baked into the rewrite at build time; change it in one place.

## Idioms for firsts

- **First auth:** an HttpOnly, Secure, SameSite=Lax cookie issued by the
  backend; keep the custom-header mutation check alongside it.
- **First migration:** bump `SCHEMA_VERSION`, append one ordered step to
  `MIGRATIONS` in `crates/store-mongo/src/migrations.rs`, and let the ledger
  record it; never edit an applied step.
- **First index:** extend the idempotent ensure-indexes beside the model it
  serves, with a name.
- **First log/trace site:** one subscriber initialization (already in the
  shell); redact secret-shaped values before they reach it.
- **First regex:** define it once in the domain core with bounded quantifiers
  — unbounded backtracking over user input is a denial of service.
- **CSP hardening:** the shipped policy allows inline scripts because the
  framework emits them; the named hardening path is a strict nonce-based CSP
  via middleware, not a wider allowlist.
- **Comments:** only for a constraint the code cannot express.

## Amendment procedures

- **Admitting a dependency** requires human sign-off, an exact version pin,
  a stated reason recorded in the birth-ledger table below, an audit at
  admission (`cargo-deny` / `npm audit`), and a cooldown before adopting new
  releases. There are two ledgers — `Cargo.lock` and `web/package-lock.json`
  — and one law.
- **Adding a concern:** add the row to `module-map.json` and to the ownership
  table above in the same change; only then create the directory.
- **Amending the gate is constitutional.** Never weaken a rule to get to
  green. A verifier or linter-config change carries the same justification
  burden as a dependency admission: human sign-off and a stated reason. The
  secret-scan's coded exclusions are exactly these, and only these: the
  `.git/` directory; the literal entries of `.gitignore` (a trailing `/`
  excludes that directory name as a path segment anywhere in the tree, any
  other line excludes that exact relative path or basename — glob patterns
  are not honored and must not be relied on); the verifier itself
  (`checks/verify.mjs`, which embodies the refused patterns — only that file,
  the rest of `checks/` is scanned); and the two lockfiles (integrity hashes
  are key-shaped). The binary guard (files over 1 MiB or with a NUL in the
  leading bytes) bounds the scan. The `size-ceiling` exclusion for
  `web/src/generated/` and the query-injection rule's line-visible
  approximation are likewise coded and carry this burden. Treat every
  mechanical approximation's verdict as binding, not as something to outwit.

## Birth ledger

Every third-party name present at birth, with its reason. Direct dependencies
only; the lockfiles close over the rest.

| Ledger | Name | Reason |
| --- | --- | --- |
| cargo | serde, serde_json | the one serialization vocabulary across wire and store |
| cargo | thiserror | named error types without hand-written boilerplate |
| cargo | tokio | the async runtime the boundary and driver require |
| cargo | axum | the HTTP boundary |
| cargo | mongodb (+ futures for its cursors) | the document-store driver |
| cargo | utoipa, utoipa-axum | spec-and-route unified: the annotations are the contract |
| cargo | tower, tower-http | the middleware stack (trace, timeout, body limit) |
| cargo | tracing, tracing-subscriber | precise-inward observability |
| npm | next, react, react-dom | the server-rendered experience |
| npm | openapi-fetch | the thin typed client over the generated types |
| npm | zod | the env modules' fail-fast validation |
| npm | server-only | the build-time server-secrecy guard |
| npm | typescript, eslint, eslint-config-next, prettier, openapi-typescript, @types/* | the gate's own per-tier tools (dev-only) |
