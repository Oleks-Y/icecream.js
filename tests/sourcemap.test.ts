import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { SourceMapGenerator } from "source-map-js";
import { originalPosition } from "../src/sourcemap";
import type { CallerPos } from "../src/types";

async function withTempFile(
  name: string,
  contents: string
): Promise<{ path: string; dispose: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "icecream-tests-"));
  const filePath = join(dir, name);
  await writeFile(filePath, contents);
  return {
    path: filePath,
    dispose: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

describe("originalPosition", () => {
  test("falls back to the generated position when no map exists", async () => {
    const temp = await withTempFile("no-map.js", "console.log('hello');\n");
    const pos: CallerPos = {
      file: temp.path,
      line: 5,
      col: 9,
    };

    const mapped = await originalPosition(pos);
    await temp.dispose();

    expect(mapped.file).toBe(pos.file);
    expect(mapped.line).toBe(pos.line);
    expect(mapped.col).toBe(pos.col);
  });

  test("uses inline source maps embedded as data URLs", async () => {
    const generator = new SourceMapGenerator({ file: "compiled.js" });
    generator.addMapping({
      generated: { line: 1, column: 9 },
      original: { line: 3, column: 1 },
      source: "original.ts",
    });

    const inlineMap = Buffer.from(
      JSON.stringify(generator.toJSON()),
      "utf-8"
    ).toString("base64");

    const temp = await withTempFile(
      "compiled.js",
      `console.log("compiled");\n//# sourceMappingURL=data:application/json;base64,${inlineMap}\n`
    );

    const mapped = await originalPosition({
      file: temp.path,
      line: 1,
      col: 9,
    });
    await temp.dispose();

    expect(mapped.file).toBe("original.ts");
    expect(mapped.line).toBe(3);
    expect(mapped.col).toBe(1);
  });
});
