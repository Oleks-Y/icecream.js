import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CallSiteEntry {
  args: Array<{ text: string }>;
}

interface CallSiteCache {
  expressions: Map<string, CallSiteEntry>;
}

const fileCache = new Map<string, CallSiteCache>();

function normalizeFilePath(ref: string): string {
  if (/^file:\/\//i.test(ref)) {
    return fileURLToPath(ref);
  }
  if (path.isAbsolute(ref)) {
    return ref;
  }
  return path.resolve(process.cwd(), ref);
}

function loadFileCache(file: string): CallSiteCache {
  const normalized = normalizeFilePath(file);
  if (fileCache.has(normalized)) return fileCache.get(normalized)!;

  let callSite: CallSiteCache | null;
  try {
    const code = readFileSync(normalized, "utf8");
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
        const args = path.node.arguments.map((arg: any) => ({
          text:
            arg.start != null && arg.end != null
              ? code.slice(arg.start, arg.end)
              : "",
        }));
        expressions.set(keyZero, { args });
        expressions.set(keyOne, { args });
      },
    });
    callSite = { expressions };
  } catch {
    callSite = { expressions: new Map() };
  }

  fileCache.set(normalized, callSite);
  return callSite;
}

export function getCallExpressionArgs(
  file: string,
  line: number,
  column: number,
): string[] | null {
  try {
    const cache = loadFileCache(file);
    const entry = cache.expressions.get(`${line}:${column}`);
    if (!entry) return null;
    return entry.args.map((arg) => arg.text);
  } catch {
    return null;
  }
}
