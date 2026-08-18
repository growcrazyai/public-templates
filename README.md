# GrowCrazyAI Public Templates

Application templates for GrowCrazyAI projects. Each top-level directory is a template **line** — a role-named family of releases. Releases are immutable and content-identified; there are no version numbers.

## Lines

- `general-purpose/` — the standard application template: modular structure, build contract in `sdlc.toml` (including the `dev-loop` build label), agent guidance in `AGENTS.md`.

## Contract

- The build contract is code-borne: `sdlc.toml` declares components and build labels.
- `template.json` carries the release-process designation and template metadata.
- `module-map.json` declares module boundaries so generated code lands in well-defined modules.
- Publication pins a snapshot of a line at a revision by content identity; projects are born from published releases, never from this repository directly.
