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

## Configuration

`ic.configureOutput()` allows you to customize ic's behavior to match your workflow. All configuration options mirror the Python icecream API.

### Custom Prefix

Change the output prefix from `ic|` to something else:

```ts
import { ic } from "icecream-js";

// String prefix
ic.configureOutput({ prefix: "debug >> " });
ic("hello"); // debug >> 'hello'

// Function prefix (e.g., timestamps)
ic.configureOutput({
  prefix: () => `${Date.now()} |> `
});
ic("world"); // 1763385680123 |> 'world'
```

### Custom Output Function

Redirect ic's output to your own logger or capture it:

```ts
const logs: string[] = [];
ic.configureOutput({
  outputFunction: (s: string) => {
    logs.push(s);
    console.log(`[CAPTURED] ${s}`);
  }
});
ic("test"); // [CAPTURED] ic| 'test'
```

### Custom Serialization

Control how values are converted to strings:

```ts
ic.configureOutput({
  argToStringFunction: (obj: unknown) => {
    if (typeof obj === "string") {
      return `[string: length=${obj.length}]`;
    }
    return String(obj);
  }
});
ic("hello"); // ic| 'hello': [string: length=5]
```

### Include Context

Add filename, line number, and function name to every output:

```ts
ic.configureOutput({ includeContext: true });

function foo() {
  const x = 42;
  ic(x); // ic| example.ts:3 in foo()- x: 42
}
```

Use absolute paths with `contextAbsPath`:

```ts
ic.configureOutput({
  includeContext: true,
  contextAbsPath: true
});
// ic| /full/path/to/example.ts:3 in foo()- x: 42
```

### Format Without Logging

Use `ic.format()` to get formatted output as a string without logging:

```ts
const formatted = await ic.format(someValue);
console.log(`[DEBUG] ${formatted}`);
```

This is useful for integrating with logging frameworks like Winston or Pino.

See `example/config-example.ts` for a complete demonstration.

## Development

- `bun install` – install deps (Bun is used for local dev + tests).
- `bun test` – run the Bun-powered test matrix (parity + integration suites).
- `bun run build` – generate the publishable `dist/` bundle via `tsup`.

Publishing is handled through GitHub Actions + release-please; set `NPM_TOKEN` in your repo secrets to enable automated releases.
