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

| Rule | Strength | Exact scope |
| --- | --- | --- |
| `dependency-emptiness` | refusal | every top-level `package.json` section whose name ends in `dependencies` (object keys and array members), plus every resolved package in `package-lock.json` while the allowlist is empty |
| `lockfile-presence` | refusal | `package-lock.json` exists at the root |
| `install-script-refusal` | refusal | `.npmrc` contains the line `ignore-scripts=true` (CRLF and surrounding whitespace tolerated) |
| `engine-pin` | refusal | `engines.node` is exactly `>=22.13` |
| `inspector-refusal` | refusal | no manifest script contains `--inspect` |
| `secret-scan` | refusal | every file in the committed tree except the coded exclusions named under Amendment; files over 1 MiB or with a NUL in the leading bytes are skipped as binary |
| `size-ceilings` (file half) | refusal | every `src/**/*.mjs` file is at most 300 lines |
| `size-ceilings` (function half) | tripwire | recognized function and method spans in `src/**/*.mjs` are at most 60 lines; brace-count approximation |
| `environment-site` | tripwire | the names `process` and `globalThis` and the `node:process` specifier appear nowhere in `src/**/*.mjs` outside `src/index.mjs`, test files included |
| `dynamic-code` | tripwire | the names `eval` and `Function`, `constructor` member or computed access, the `node:vm` specifier, computed dynamic `import(...)`, and shell-string exec, anywhere in `src/**/*.mjs` |
| `module-system` | tripwire | no CommonJS constructs in `src/**/*.mjs` |
| `layering` | tripwire | production files under `src/core/`: static imports resolve only within core, and dynamic `import(...)` is refused entirely |

## Invariants

- **One gate, one meaning.** `npm run dev-loop` is the single definition of
  done: the convention verifier, then every test under the coverage floor. There
  is no second gate and no alias.
- **The template obeys its own law.** The gate passed at the template's own
  publication; keep it green from the first change.
- **The map is honest.** Every enforcement claim in this document is true of
  the verifier's code. Amending the verifier re-verifies this document;
  amending this document re-verifies the verifier.
- **Zero dependencies is the resting state.** The dependency sets are empty and
  the verifier refuses undocumented names in every dependency section of the
  manifest — and any resolved lockfile package while the allowlist is empty.
- **Singleton sites.** One environment read (`src/index.mjs`), one response
  writer (`src/http/respond.mjs`), one inbound body reader
  (`src/http/read-body.mjs`), one markup-interpolation site
  (`src/http/html.mjs`). Extend these; never duplicate them. The gate confines
  the names `process`, `globalThis`, and `node:process` to the shell; hiding
  those names behind an alias or a computed access is a violation the gate
  cannot see, not a permission.
- **The core is pure.** Production files under `src/core/` import only within
  core — not even Node builtins — and never dynamically. Logic that needs no
  I/O belongs there. Colocated `*.test.mjs` files are verification code,
  outside the purity surface, and may import the test runner.
- **Placement follows the concern map.** `module-map.json` names the directory
  for each concern; add a concern there before inventing a directory.
- **Refusal is opaque outward, precise inward.** Clients get generic bodies and
  statuses; detail goes to the server-side log only.
- **Capability is granted, not assumed.** `npm start` runs under Node's
  permission model with read access only to `src/`, `public/`, and
  `package.json`. A new capability means widening the start act deliberately.
- **Secrets never live in the tree.** The verifier refuses the named key
  shapes everywhere in the committed tree except the coded exclusions listed
  under Amendment; configuration enters through the environment (`.env` is
  git-ignored as hygiene, the scan is the control).

## Who owns what

| Path | Concern |
| --- | --- |
| `src/index.mjs` | The shell: process lifecycle, the sole `process.env` read (read once, validated, frozen, passed down), server limits. |
| `src/http/` | The request boundary: declarative route table (`router.mjs`; each route is `{ method, pathname, handler(request, url) -> outcome }`, handlers as data returning outcome values), the sole response writer (`respond.mjs`, security headers on every response), bounded body reader, escaping `html` tag, hardened static fallback. The origin never terminates TLS; transport security belongs to the platform edge. |
| `src/core/` | Pure logic. No imports outside core in production files; colocated tests may import the test runner. |
| `checks/` | The convention verifier — one script, eleven named rules. |
| `public/` | Static assets, served through the MIME allowlist, clean under the shipped content-security-policy (no inline style or script). |
| `package.json` | The manifest: engines pin, empty dependency sets, the `dev-loop` and permissioned `start` scripts. |
| `sdlc.toml` | The build contract; the `dev-loop` label runs the same gate the platform observes. |
| `module-map.json` | The concern map this table mirrors. |

## The development loop

```
npm run dev-loop
```

That is `node checks/verify.mjs` followed by
`node --test --experimental-test-coverage --test-coverage-lines=80
--test-coverage-exclude='**/*.test.mjs'`. It is the same command the
`dev-loop` build label in `sdlc.toml` runs, so what passes locally is what the
platform observes. The coverage floor binds the production-code aggregate —
test files are excluded from the metric — not any single file.

To run the app: `npm start` (listens on `PORT`, defaulting to 3000).

## Reach for the platform before a dependency

Node ships what most first needs reach for: `fetch`, `structuredClone`,
`URLPattern`, `AbortSignal.timeout`, `util.parseArgs`, `node:sqlite`,
`fs.glob`, and `node:crypto` primitives — prefer these before hand-rolling or
requesting a dependency.

## Idioms for firsts

- **Validation at the boundary:** allowlist expected fields into a
  null-prototype copy and check with `Object.hasOwn` — never spread untrusted
  input onward.
- **Passwords and secrets:** derive with `crypto.scrypt` and compare with
  `crypto.timingSafeEqual` — never a fast hash, never `===`.
- **First session cookie:** set `HttpOnly; Secure; SameSite=Lax; Path=/` from
  the response composer, nowhere else.
- **First log statement:** create one logging site that redacts secret-shaped
  values, and route all logging through it.
- **Regexes:** define them once in `src/core/` with bounded quantifiers —
  unbounded backtracking over user input is a denial of service.
- **Comments:** only for a constraint the code cannot express.

## Amendment procedures

- **Admitting a dependency** requires human sign-off, an exact version pin, an
  `npm audit` at admission, and a cooldown before adoption of new releases;
  record the name and reason in the verifier's `ALLOWED_DEPENDENCIES` map —
  the gate refuses undocumented additions in every dependency section and,
  while the map is empty, any resolved lockfile package.
- **Adding a concern:** add the row to `module-map.json` and to the table
  above in the same change; only then create the directory.
- **Amending the gate is constitutional.** Never weaken a rule to get to
  green. A verifier change carries the same justification burden as a
  dependency admission: human sign-off and a stated reason. The secret-scan's
  coded exclusions are exactly these, and only these: the `.git/` directory;
  the literal entries of `.gitignore` (a trailing `/` excludes that directory
  as a prefix, any other line excludes that exact relative path — glob
  patterns are not honored and must not be relied on); the verifier itself
  (`checks/verify.mjs`, which embodies the refused patterns — only that file,
  the rest of `checks/` is scanned); `package-lock.json` (integrity hashes are
  key-shaped); and the binary guard (files over 1 MiB or with a NUL in the
  leading bytes). One further coded exclusion belongs to the layering rule:
  `*.test.mjs` under `src/core/` may import the test runner; purity binds the
  production surface. All of these exclusions are covered by this amendment
  burden. The function-size rule is a mechanical brace-count approximation —
  treat its verdicts as binding, not as something to outwit.
