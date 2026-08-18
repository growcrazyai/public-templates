# Working in this project

This project was born from template `v1`. The layout below is a discipline, not a
mechanism: nothing enforces it automatically, so honour it deliberately.

## Who owns what

| Directory / file | Owns |
| --- | --- |
| `src/` | Application code. The HTTP entry point is `src/index.mjs`. |
| `public/` | Static assets served verbatim at the site root. |
| `package.json` | The dependency and script manifest. |
| `sdlc.toml` | The build contract — component entries and their labelled builds. |
| `module-map.json` | The map from concern to directory, so generated code lands where it belongs. |

Generated code goes in the directory that `module-map.json` names for its concern.
Do not scatter generated files beside unrelated code, and do not invent a parallel
layout — add a concern to `module-map.json` first if a new one is genuinely needed.

## The development loop

```
npm run dev-loop
```

That runs `node --test`, which discovers every `*.test.mjs` file. It is the same
command the `dev-loop` build label in `sdlc.toml` runs, so what passes locally is
what the platform observes. Keep it green: it gates the template's conformance
proof and it is the fastest signal you have while working.

To run the app itself:

```
npm start
```

The server listens on `PORT`, defaulting to 3000.

## Adding a build

Builds are labelled tables in `sdlc.toml` under the component they belong to, for
example `[app.build.dev-loop]`. Add a label there with its `build_cmd`; the
platform learns your components and their builds by observing this file, so it is
the only place a build becomes real.
