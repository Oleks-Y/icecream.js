import type { CallerPos, OriginalPos } from "./types";
import { isNode } from "./stack";
import { SourceMapConsumer } from "source-map-js";
import type { RawSourceMap } from "source-map-js";

const mapJsonCache = new Map<string, Promise<RawSourceMap | null>>();
const consumerCache = new Map<string, Promise<SourceMapConsumer | null>>();

function tryDecodeDataUrl(dataUrl: string): RawSourceMap | null {
  // data:application/json;base64,XXXX
  try {
    const m = /^data:application\/json(?:;charset=[^;]+)?;base64,(.+)$/i.exec(
      dataUrl.trim()
    );
    if (!m) return null;
    const json = Buffer.from(m[1] as any, "base64").toString("utf-8");
    return JSON.parse(json) as RawSourceMap;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function readNodeText(pathOrUrl: string): Promise<string> {
  // If it's http(s), use fetch; otherwise use fs
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return fetchText(pathOrUrl);
  }
  // file: URL → convert to path
  let fsPath = pathOrUrl;
  if (/^file:\/\//i.test(pathOrUrl)) {
    const { fileURLToPath } = await import("node:url");
    fsPath = fileURLToPath(pathOrUrl);
  }
  const fs = await import("node:fs/promises");
  return fs.readFile(fsPath, "utf-8");
}

function joinUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    // Fallback
    if (base.startsWith("http")) {
      const slash = base.lastIndexOf("/");
      return base.slice(0, slash + 1) + relative;
    }
    return relative; // Node path will be resolved separately
  }
}

async function resolveMapUrlOrInline(fileUrlOrPath: string): Promise<{
  inlineMap: RawSourceMap | null;
  mapUrl: string | null;
}> {
  // Read the generated file’s trailing sourceMappingURL
  const text = isNode
    ? await readNodeText(fileUrlOrPath)
    : await fetchText(fileUrlOrPath);
    
  const m =
    /\/\/# sourceMappingURL=(.+)\s*$/m.exec(text) ||
    /\/\*# sourceMappingURL=(.+)\s*\*\/\s*$/m.exec(text);
  if (!m) return { inlineMap: null, mapUrl: null };

  const val = m[1]!.trim();

  if (/^data:application\/json/i.test(val)) {
    const inline = tryDecodeDataUrl(val);
    return { inlineMap: inline, mapUrl: null };
  }

  // If a plain URL or relative path
  if (/^https?:\/\//i.test(val) || /^file:\/\//i.test(val)) {
    return { inlineMap: null, mapUrl: val };
  }

  // Relative; resolve against file
  if (!isNode && /^https?:\/\//i.test(fileUrlOrPath)) {
    return { inlineMap: null, mapUrl: joinUrl(fileUrlOrPath, val) };
  }

  if (isNode) {
    const path = await import("node:path");
    let basePath = fileUrlOrPath;
    if (/^file:\/\//i.test(fileUrlOrPath)) {
      const { fileURLToPath } = await import("node:url");
      basePath = fileURLToPath(fileUrlOrPath);
    }
    const dir = path.dirname(basePath);
    const abs = path.resolve(dir, val);
    return { inlineMap: null, mapUrl: abs };
  }

  return { inlineMap: null, mapUrl: val };
}

async function loadMapJson(
  fileUrlOrPath: string
): Promise<RawSourceMap | null> {
  if (mapJsonCache.has(fileUrlOrPath)) return mapJsonCache.get(fileUrlOrPath)!;

  const promise = (async () => {
    try {
      const { inlineMap, mapUrl } = await resolveMapUrlOrInline(fileUrlOrPath);
      if (inlineMap) return inlineMap;
      if (!mapUrl) return null;

      if (isNode && !/^https?:\/\//i.test(mapUrl)) {
        const txt = await readNodeText(mapUrl);
        return JSON.parse(txt) as RawSourceMap;
      } else {
        const txt = await fetchText(mapUrl);
        return JSON.parse(txt) as RawSourceMap;
      }
    } catch {
      return null;
    }
  })();

  mapJsonCache.set(fileUrlOrPath, promise);
  return promise;
}

async function getConsumer(
  fileUrlOrPath: string
): Promise<SourceMapConsumer | null> {
  if (consumerCache.has(fileUrlOrPath))
    return consumerCache.get(fileUrlOrPath)!;

  const promise = (async () => {
    const mapJson = await loadMapJson(fileUrlOrPath);
    if (!mapJson) return null;
    // SourceMapConsumer.fromObject is available in source-map-js
    return await new SourceMapConsumer(mapJson as any);
  })();

  consumerCache.set(fileUrlOrPath, promise);
  return promise;
}

export async function originalPosition(pos: CallerPos): Promise<OriginalPos> {
  if (!pos.file || !pos.line || !pos.col) return pos;
  const consumer = await getConsumer(pos.file);
  if (!consumer) return pos;

  const mapped = consumer.originalPositionFor({
    line: pos.line,
    column: pos.col,
    bias: SourceMapConsumer.GREATEST_LOWER_BOUND,
  });
  return {
    file: mapped.source ?? pos.file,
    line: mapped.line ?? pos.line,
    col: mapped.column ?? pos.col,
    fn: pos.fn,
  };
}
