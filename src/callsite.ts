import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CallSiteEntry {
  args: Array<{ text: string }>;
}

interface CallSiteCache {
  expressions: Map<string, CallSiteEntry>;
}

const fileCache = new Map<string, Promise<CallSiteCache>>();

function normalizeFilePath(ref: string): string {
  if (/^file:\/\//i.test(ref)) {
    return fileURLToPath(ref);
  }
  if (path.isAbsolute(ref)) {
    return ref;
  }
  return path.resolve(process.cwd(), ref);
}

async function loadFileCache(file: string): Promise<CallSiteCache> {
  const normalized = normalizeFilePath(file);
  if (fileCache.has(normalized)) return fileCache.get(normalized)!;
  const promise = (async () => {
    try {
      const code = await readFile(normalized, "utf8");
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
        errorRecovery: true,
        ranges: true,
      });
      const expressions = new Map<string, CallSiteEntry>();
      traverse(ast, {
        CallExpression(path: NodePath<t.CallExpression>) {
          const callee = path.get("callee");
          if (!callee.isIdentifier({ name: "ic" })) return;
          const loc = path.node.loc?.start;
          if (!loc) return;
          const keyZero = `${loc.line}:${loc.column}`;
          const keyOne = `${loc.line}:${loc.column + 1}`;
          const args = path.node.arguments.map((arg) => ({
            text:
              arg.start != null && arg.end != null
                ? code.slice(arg.start, arg.end)
                : "",
          }));
          expressions.set(keyZero, { args });
          expressions.set(keyOne, { args });
        },
      });
      return { expressions };
    } catch {
      return { expressions: new Map() };
    }
  })();
  fileCache.set(normalized, promise);
  return promise;
}

export async function getCallExpressionArgs(
  file: string,
  line: number,
  column: number
): Promise<string[] | null> {
  try {
    const cache = await loadFileCache(file);
    const entry = cache.expressions.get(`${line}:${column}`);
    if (!entry) return null;
    return entry.args.map((arg) => arg.text);
  } catch {
    return null;
  }
}
