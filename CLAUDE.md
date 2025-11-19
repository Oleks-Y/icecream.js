
## Project overview

`icecream-js` is a Node-first reimplementation of the Python [`icecream`](https://github.com/gruns/icecream) debugger. It exposes a single `ic()` helper that logs expressions, automatically infers labels, and returns the original value so you can drop it anywhere in an expression chain. The codebase is small (~700 LOC) and split by responsibility:

- `src/ic.ts`, `src/ic-core.ts`, `src/env-*.ts` – runtime for Node and browser/Turbopack builds
- `src/callsite.server.ts` – re-opens TypeScript source in Node via Babel to recover argument text
- `src/sourcemap.server.ts` / `.browser.ts` – resolves stack frames through sourcemaps
- `src/stack.ts`, `src/types.ts` – helper utilities for stack parsing & shared types
- `tests/` – Bun test suites covering ic() behaviour, sourcemap lookups, and the Python parity example
- `example/` – demo scripts mirroring the upstream Python usage
- CI/release: `.github/workflows/*.yml`, `release-please-*`, `tsup.config.ts`

The package ships dual bundles (Node + browser) via `tsup`; conditional exports ensure that Node imports get the full filesystem-backed experience and browser bundles rely on `fetch`.

## Development workflow

- Install deps with `bun install`.
- Build bundles with `bun run build` (tsup outputs to `dist/`).
- Run tests with `bun test`. The suite uses `bun:test`; we keep tests black-box by executing the sample scripts and asserting on their stdout, plus unit tests for expression labelling and sourcemap resolution.
- Release automation is handled via release-please; merge to `main`, let the release PR bump versions, and GitHub Actions publishes to npm once a GitHub release is created (requires `NPM_TOKEN` secret).

## Testing philosophy

1. **Black-box parity tests** – `tests/py-parity.test.ts` shells out to `bun run example/py-example.ts` and compares the emitted `ic| …` lines to the Python reference. This ensures we keep behaviour identical for standard use cases without peeking into internals.
2. **Unit-style runtime tests** – `tests/ic.test.ts` captures each console log and asserts labelling, multi-arg handling, tuple return values, and enabling/disabling.
3. **Integration tests** – `tests/example.integration.test.ts` invokes the simpler `example/example.ts` script, verifying the ordering and formatting in a scenario closer to real usage (Next.js-style logging).
4. **Sourcemap unit tests** – `tests/sourcemap.test.ts` writes temporary files and inline maps to make sure the resolver falls back gracefully and respects inline data URLs.

Keep new tests in Bun’s `bun:test` framework, default to the “capture stdout” approach for behaviour verification, and prefer high-level integration when feasible (e.g., run a script rather than mocking internals).

## Code organisation tips

- Keep Node-specific filesystem logic in `src/env-node.ts` or `src/sourcemap.server.ts`; browser-specific implementations live alongside them (e.g., `env-browser`, `sourcemap.browser`).
- Only `src/index.ts` re-exports the public API (`ic` and types). Everything else should stay internal to avoid accidental bundling.
- When adding runtime features:
  - Update both environments (`env-node` and `env-browser`) or guard with `isNode` checks.
  - If you need new build artefacts, extend `tsup.config.ts` and the `package.json` exports map accordingly.
- Remember that expression label inference depends on Babel; any new syntax should be supported via parser plugins in `callsite.server.ts`.

## Running tests & linting

- `bun test` – runs the entire suite (unit + parity + sourcemap).
- `bun run example/py-example.ts` – quick check that parity sample still matches the Python expectations.
- `bun run build && npm pack` – dry run of the distributable bundle.

There’s no separate linter task yet; rely on TypeScript and the test suite. Keep contributions focused, include relevant Bun tests, and prefer capturing logs rather than mocking implementation details.
