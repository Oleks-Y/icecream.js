import fs from "node:fs";
import path from "node:path";
import type {
  CallerPos,
  OriginalPos,
  IcConfiguration,
  PrefixFunction,
  OutputFunction,
  ArgToStringFunction,
} from "./types";
import { getCaller, isNode } from "./stack";
import { originalPosition } from "./sourcemap";
import { getCallExpressionArgs } from "./callsite";

function ts() {
  const now = new Date();
  const time = now.toTimeString().split(" ")[0] ?? "";
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
}

function inspectValue(v: unknown): string {
  if (v instanceof Error) {
    const name = v.name || "Error";
    const message = v.message || "";
    return message ? `${name}: ${message}` : name;
  }
  try {
    if (isNode) {
      // Lazy require so this file stays browser-safe
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const util = require("node:util") as typeof import("node:util");
      return util.inspect(v, { depth: 3, colors: false });
    }
    // Browser fallback: safe-ish stringify
    const seen = new WeakSet();
    return JSON.stringify(
      v,
      (_k, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        return val;
      },
      2,
    );
  } catch {
    try {
      return String(v);
    } catch {
      return "[Unprintable]";
    }
  }
}

export function shortenBrowserPath(file?: string) {
  if (!file) return "";
  try {
    const url = new URL(file);
    return url.pathname.replace(/^\/+/, ""); // e.g. "src/components/Button.tsx"
  } catch {
    return file.replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "");
  }
}

let enabled = true;
let logQueue: Promise<void> = Promise.resolve();

// Default configuration
const defaultConfig: IcConfiguration = {
  prefix: "ic| ",
  outputFunction: (s: string) => console.log(s),
  argToStringFunction: inspectValue,
  includeContext: false,
  contextAbsPath: false,
};

let config: IcConfiguration = { ...defaultConfig };

function findProjectRoot(startDir = process.cwd()): string {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return startDir; // fallback: cwd
}

export const PROJECT_ROOT = findProjectRoot();

function shortenPath(file?: string, useAbsPath = false): string {
  if (!file) return "";
  if (useAbsPath) return file; // Return absolute path if requested
  if (isNode) {
    const rel = path.relative(PROJECT_ROOT, file);
    // if outside project (e.g., node_modules), keep basename
    if (rel.startsWith("..")) return path.basename(file);
    return rel;
  } else {
    return shortenBrowserPath(file);
  }
}

function normalizeLiteralExpression(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1).replace(/'/g, "\\'");
    return `'${inner}'`;
  }
  return trimmed.replace(/\s+/g, " ").trim();
}

function formatEntry(label: string | null, value: string): string {
  if (label && label !== value) {
    return `${label}: ${value}`;
  }
  return label ?? value;
}

function resolveExpressionLabels(
  pos: OriginalPos,
  valueCount: number,
  skipFirst: boolean,
): Array<string | null> {
  if (
    !isNode ||
    !pos.file ||
    pos.line == null ||
    pos.col == null ||
    valueCount === 0
  ) {
    return new Array(valueCount).fill(null);
  }
  const columns = [pos.col, pos.col - 1, pos.col + 1].filter(
    (col): col is number => typeof col === "number" && col >= 0,
  );
  let exprs: string[] | null = null;
  for (const column of columns) {
    exprs = getCallExpressionArgs(pos.file, pos.line, column);
    if (exprs && exprs.length) break;
  }
  if (!exprs || exprs.length === 0) {
    return new Array(valueCount).fill(null);
  }
  const trimmed = (skipFirst ? exprs.slice(1) : exprs).map(
    (expr) => normalizeLiteralExpression(expr) || null,
  );
  const labels: (string | null)[] = [];
  for (let i = 0; i < valueCount; i++) {
    labels.push(trimmed[i] ?? null);
  }
  return labels;
}

function formatContext(pos: OriginalPos, fnName?: string): string {
  const shortFile = shortenPath(pos.file, config.contextAbsPath);
  const linePart = pos.line
    ? `${shortFile || pos.file}:${pos.line}`
    : shortFile || pos.file || "<unknown>";
  const fnPart = fnName ?? "<anonymous>";
  return `${linePart} in ${fnPart}()`;
}

function formatNoArgLocation(pos: OriginalPos, fnName?: string): string {
  if (config.includeContext) {
    return `${formatContext(pos, fnName)} at ${ts()}`;
  }
  const shortFile = shortenPath(pos.file, config.contextAbsPath);
  const linePart = pos.line
    ? `${shortFile || pos.file}:${pos.line}`
    : shortFile;
  const fnPart = fnName ?? "<anonymous>";
  return `${linePart ?? "<unknown>"} in ${fnPart}() at ${ts()}`;
}

function formatOutput(
  pos: OriginalPos,
  workArgs: unknown[],
  explicitLabel: string | null,
): string {
  const prefix =
    typeof config.prefix === "function" ? config.prefix() : config.prefix;
  const contextPart = config.includeContext
    ? `${formatContext(pos, pos.fn)}- `
    : "";

  if (workArgs.length === 0) {
    return `${prefix}${formatNoArgLocation(pos, pos.fn)}`;
  }

  const labels = resolveExpressionLabels(
    pos,
    workArgs.length,
    Boolean(explicitLabel),
  );
  const entries = workArgs.map((value, idx) => {
    const label =
      idx === 0 && explicitLabel ? explicitLabel : (labels[idx] ?? null);
    const valueString = config.argToStringFunction(value);
    return formatEntry(label, valueString);
  });
  return `${prefix}${contextPart}${entries.join(", ")}`;
}

/**
 * Debug print that returns the passed value(s).
 * If used with the transform plugin, the first arg may be a label string (expression text).
 */
export function ic<T extends unknown[]>(
  ...args: T
): T extends [infer U] ? U : T {
  if (!enabled)
    return (args.length === 1 ? (args[0] as any) : (args as any)) as any;

  const workArgs = [...args] as unknown[];

  let explicitLabel: string | null = null;
  if (workArgs.length >= 2 && typeof workArgs[0] === "string") {
    explicitLabel = workArgs.shift() as unknown as string;
  }

  const ret = (
    workArgs.length === 1 ? (workArgs[0] as any) : (workArgs as any)
  ) as any;

  const genPos: CallerPos = getCaller(1);

  const pos = originalPosition(genPos);
  if (!pos.fn && genPos.fn) pos.fn = genPos.fn;
  const output = formatOutput(pos, workArgs, explicitLabel);
  config.outputFunction(output);

  return ret;
}

(ic as any).enable = () => {
  enabled = true;
};
(ic as any).disable = () => {
  enabled = false;
};

/**
 * Configure ic()'s output behavior
 */
(ic as any).configureOutput = (options?: {
  prefix?: string | PrefixFunction;
  outputFunction?: OutputFunction;
  argToStringFunction?: ArgToStringFunction;
  includeContext?: boolean;
  contextAbsPath?: boolean;
}) => {
  if (options?.prefix !== undefined) config.prefix = options.prefix;
  if (options?.outputFunction !== undefined)
    config.outputFunction = options.outputFunction;
  if (options?.argToStringFunction !== undefined) {
    config.argToStringFunction = options.argToStringFunction;
  } else if (options && "argToStringFunction" in options) {
    // Explicitly set to undefined, reset to default
    config.argToStringFunction = inspectValue;
  }
  if (options?.includeContext !== undefined)
    config.includeContext = options.includeContext;
  if (options?.contextAbsPath !== undefined)
    config.contextAbsPath = options.contextAbsPath;
};

/**
 * Format values like ic() would, but return the string instead of printing it
 */
async function format<T extends unknown[]>(...args: T): Promise<string> {
  const workArgs = [...args] as unknown[];

  let explicitLabel: string | null = null;
  if (workArgs.length >= 2 && typeof workArgs[0] === "string") {
    explicitLabel = workArgs.shift() as unknown as string;
  }

  // Use depth 2 to skip both format() and the getCaller frame
  const genPos: CallerPos = getCaller(2);
  const pos = await originalPosition(genPos);
  if (!pos.fn && genPos.fn) pos.fn = genPos.fn;

  return formatOutput(pos, workArgs, explicitLabel);
}

(ic as any).format = format;
