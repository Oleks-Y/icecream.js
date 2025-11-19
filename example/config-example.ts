#!/usr/bin/env bun
/**
 * Example demonstrating ic() configuration options
 */

import { ic } from "../src/index";

// Type assertion to access configuration methods
const configuredIc = ic as typeof ic & {
  configureOutput: (options?: {
    prefix?: string | (() => string);
    outputFunction?: (output: string) => void;
    argToStringFunction?: (value: unknown) => string;
    includeContext?: boolean;
    contextAbsPath?: boolean;
  }) => void;
  format: (...args: any[]) => Promise<string>;
};

// Helper to wait for ic() queue to flush
const wait = () => new Promise((resolve) => setTimeout(resolve, 50));

console.log("=== Default ic() behavior ===");
const x = 42;
ic(x);
await wait();

console.log("\n=== Custom string prefix ===");
configuredIc.configureOutput({ prefix: "debug >> " });
ic("world");
await wait();

console.log("\n=== Custom function prefix (timestamp) ===");
function unixTimestamp() {
  return `${Math.floor(Date.now() / 1000)} |> `;
}
configuredIc.configureOutput({ prefix: unixTimestamp });
ic("world");
await wait();

console.log("\n=== Custom output function (logging) ===");
const logs: string[] = [];
configuredIc.configureOutput({
  prefix: "ic| ",
  outputFunction: (s: string) => {
    logs.push(s);
    console.log(`[LOGGED] ${s}`);
  },
});
ic("captured");
await wait();
console.log(`Total logs captured: ${logs.length}`);

console.log("\n=== Custom argToStringFunction ===");
configuredIc.configureOutput({
  outputFunction: (s: string) => console.log(s), // Reset to default
  argToStringFunction: (obj: unknown) => {
    if (typeof obj === "string") {
      return `[!string '${obj}' with length ${obj.length}!]`;
    }
    if (typeof obj === "number") {
      return `[number: ${obj}]`;
    }
    return String(obj);
  },
});
ic(7, "hello");
await wait();

console.log("\n=== Include context (filename, line, function) ===");
configuredIc.configureOutput({
  argToStringFunction: undefined, // Reset to default
  includeContext: true,
});

function foo() {
  const i = 3;
  ic(i);
}
foo();
await wait();

console.log("\n=== Context with absolute paths ===");
configuredIc.configureOutput({
  includeContext: true,
  contextAbsPath: true,
});

function bar() {
  const j = 5;
  ic(j);
}
bar();
await wait();

console.log("\n=== Multiple configuration options ===");
configuredIc.configureOutput({
  prefix: ">>> ",
  includeContext: true,
  contextAbsPath: false,
});

function baz() {
  const msg = "complex example";
  ic(msg);
}
baz();
await wait();

console.log("\n=== Using ic.format() ===");
configuredIc.configureOutput({
  prefix: "ic| ",
  includeContext: false,
  contextAbsPath: false,
});

async function demoFormat() {
  const value = 123;
  const formatted = await configuredIc.format(value);
  console.log("Formatted (not logged automatically):", formatted);
}

await demoFormat();

console.log("\n=== Using format() with custom logger integration ===");
async function integrateWithLogger() {
  const data = { user: "alice", id: 42 };
  const debugLine = await configuredIc.format(data);
  // Simulate integrating with a logging framework
  console.log(`[DEBUG] ${debugLine}`);
  console.log(`[INFO] Processing user request...`);
}

await integrateWithLogger();
