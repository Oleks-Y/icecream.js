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
      const idx = line.indexOf("🐍 ");
      return idx >= 0 ? line.slice(idx) : line;
    })
    .filter((line) => line.startsWith("🐍"));
}

describe("py-example parity", () => {
  test("matches the Python icecream sample output order and labels", () => {
    const segments = runPyExample();

    expect(segments.length).toBe(9);

    expect(segments[0]).toBe("🐍 example/py-example.ts:9 in example_1()- 'Hello from example 1'");
    expect(segments[1]).toBe("🐍 example/py-example.ts:14 in example_2()- x: 42");
    expect(segments[2]).toBe("🐍 example/py-example.ts:19 in example_3()- data: { a: 1, b: 2 }");

    expect(segments[3]).toMatch(/🐍 example\/py-example\.ts:\d+ in example_4\(\) at \d{2}:\d{2}:\d{2}\.\d{3}/);

    expect(segments[4]).toMatch(/🐍 example\/py-example\.ts:\d+ in example_5\(\)- error: Error: division by zero/);
    expect(segments[5]).toBe("🐍 example/py-example.ts:42 in ()- example_1: [Function: example_1]");
    expect(segments[6]).toBe("🐍 example/py-example.ts:43 in ()- example_4: [Function: example_4]");

    expect(segments[7]).toMatch(/🐍 example\/py-example\.ts:\d+ in example_4\(\) at \d{2}:\d{2}:\d{2}\.\d{3}/);

    expect(segments[8]).toBe("🐍 example/py-example.ts:44 in ()- example_4(10): undefined");
  });
});
