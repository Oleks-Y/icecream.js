import { describe, expect, test } from "bun:test";

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

function runExample(): string[] {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "example/example.ts"],
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);

  return stripAnsi(result.stdout.toString())
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.startsWith("ic|"));
}

describe("example script integration", () => {
  test("emits lines similar to the Python package sample", () => {
    const segments = runExample();

    const checkpoints = [
      "ic| 'Hello from example1'",
      /^ic\| example\/example\.ts:\d+ in example2\(\) at \d{2}:\d{2}:\d{2}\.\d{3}$/,
      "ic| 42",
      "ic| example1: [Function: example1]",
      /^ic\| example\/example\.ts:\d+ in example2\(\) at \d{2}:\d{2}:\d{2}\.\d{3}$/,
      "ic| example2(10): undefined",
    ];

    let cursor = 0;
    for (const line of segments) {
      if (cursor >= checkpoints.length) break;
      const match = checkpoints[cursor];
      if (typeof match === "string" ? line === match : match.test(line)) {
        cursor += 1;
      }
    }

    expect(cursor).toBe(checkpoints.length);
  });
});
