import type { CallerPos } from "./types";

export const isNode =
  typeof process !== "undefined" &&
  typeof process.versions === "object" &&
  typeof process.versions?.node === "string" &&
  typeof window === "undefined";

export function getCaller(depth = 2): CallerPos {
  try {
    if (isNode) {
      // Node: use CallSite objects for stability
      const orig = (Error as any).prepareStackTrace;
      (Error as any).prepareStackTrace = (_: any, stack: any[]) => stack;
      const err = new Error();
      Error.captureStackTrace(err, getCaller);
      const cs = (err as any).stack[depth];
      (Error as any).prepareStackTrace = orig;
      return cs
        ? {
            file: cs.getFileName?.() ?? undefined,
            line: cs.getLineNumber?.() ?? undefined,
            col: cs.getColumnNumber?.() ?? undefined,
            fn: cs.getFunctionName?.() ?? undefined,
          }
        : {};
    } else {
      // Browser: parse stack string (Chrome/Edge/Firefox patterns)
      const e = new Error();
      const lines = (e.stack || "").split("\n").slice(depth + 1);
      const line = lines[0] || "";
      // ... at fn (http://host/app.js:12:34)
      // ... at http://host/app.js:12:34
      const m =
        /\s+at\s+(?:(\S+)\s+\()?([^()\s]+):(\d+):(\d+)\)?$/.exec(line) ||
        /\(?([^()\s]+):(\d+):(\d+)\)?$/.exec(line);
      if (!m) return {};
      if (m.length === 5) {
        return {
          fn: m[1],
          file: m[2],
          line: Number(m[3]),
          col: Number(m[4]),
        };
      }
      return { file: m[1], line: Number(m[2]), col: Number(m[3]) };
    }
  } catch {
    return {};
  }
}
