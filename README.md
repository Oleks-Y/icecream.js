# icecream-js

> A Node-first fork of [python-icecream](https://github.com/gruns/icecream) that mirrors the beloved `ic()` debugging workflow for JavaScript.

## Status

- ✅ Forked from `gruns/icecream`; API parity for the most common patterns.
- ✅ Designed for Node.js runtimes (18+) today — browser support is on the roadmap.
- ⚠️ Alpha-quality: expect breaking changes while we shape the ergonomics.

## Install

```bash
npm install icecream-js
# or
yarn add icecream-js
# or
pnpm add icecream-js
```

## Use It

```ts
import { ic } from "icecream-js";

function example(a: number) {
  ic(a);          // ic| a: 42
  ic();           // ic| src/example.ts:4 in example() at 12:34:56.789
  ic(example);    // ic| example: [Function: example]
  ic(example(7)); // ic| example(7): undefined
}

example(42);
```

`ic()` automatically:

1. Prints literal strings, variables, and expressions with their source names.
2. Shows where your code is executing when you call `ic()` without arguments.
3. Returns the incoming value(s) unchanged, making it safe to drop anywhere in a pipeline.

## Development

- `bun install` – install deps (Bun is used for local dev + tests).
- `bun test` – run the Bun-powered test matrix (parity + integration suites).
- `bun run build` – generate the publishable `dist/` bundle via `tsup`.

Publishing is handled through GitHub Actions + release-please; set `NPM_TOKEN` in your repo secrets to enable automated releases.
