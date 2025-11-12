import { describe, expect, test } from "bun:test";

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

function runPyExample(): string[] {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "example/py-example.ts"],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`example/py-example.ts exited with code ${result.exitCode}: ${result.stderr.toString()}`);
  }

  const lines = stripAnsi(result.stdout.toString()).trim().split(/\r?\n/);
  return lines
    .map((line) => {
      const idx = line.indexOf("ic| ");
      return idx >= 0 ? line.slice(idx) : line;
    })
    .filter((line) => line.startsWith("ic|"));
}

describe("py-example parity", () => {
  test("matches the Python icecream sample output order and labels", () => {
    const segments = runPyExample();

    expect(segments.length).toBe(8);

    expect(segments[0]).toBe("ic| 'Hello from example 1'");
    expect(segments[1]).toBe("ic| x: 42");
    expect(segments[2]).toBe("ic| data: { a: 1, b: 2 }");

    expect(segments[3]).toMatch(/ic\| example\/py-example\.ts:\d+ in example_4\(\) at \d{2}:\d{2}:\d{2}\.\d{3}/);

    expect(segments[4]).toBe("ic| example_1: [Function: example_1]");
    expect(segments[5]).toBe("ic| example_4: [Function: example_4]");

    expect(segments[6]).toMatch(/ic\| example\/py-example\.ts:\d+ in example_4\(\) at \d{2}:\d{2}:\d{2}\.\d{3}/);

    expect(segments[7]).toBe("ic| example_4(10): undefined");
  });
});
