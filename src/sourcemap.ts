import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { CallerPos, OriginalPos } from "./types";
import { isNode } from "./stack";
import { SourceMapConsumer } from "source-map-js";
import type { RawSourceMap } from "source-map-js";

const mapJsonCache = new Map<string, RawSourceMap | null>();
const consumerCache = new Map<string, SourceMapConsumer | null>();

function tryDecodeDataUrl(dataUrl: string): RawSourceMap | null {
  // data:application/json;base64,XXXX
  try {
    const m = /^data:application\/json(?:;charset=[^;]+)?;base64,(.+)$/i.exec(
      dataUrl.trim(),
    );
    if (!m) return null;
    const json = Buffer.from(m[1], "base64").toString("utf-8");
    return JSON.parse(json) as RawSourceMap;
  } catch {
    return null;
  }
}

function readNodeText(fsPath: string): string {
  return fs.readFileSync(fsPath, "utf-8");
}

function joinUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    if (base.startsWith("http")) {
      const slash = base.lastIndexOf("/");
      return base.slice(0, slash + 1) + relative;
    }
    return relative;
  }
}

function resolveMapUrlOrInline(fileUrlOrPath: string): {
  inlineMap: RawSourceMap | null;
  mapUrl: string | null;
} {
  // Read the generated file’s trailing sourceMappingURL
  const text = readNodeText(fileUrlOrPath);

  const m =
    /\/\/# sourceMappingURL=(.+)\s*$/m.exec(text) ||
    /\/\*# sourceMappingURL=(.+)\s*\*\/\s*$/m.exec(text);
  if (!m) return { inlineMap: null, mapUrl: null };

  const val = m[1].trim();

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
    let basePath = fileUrlOrPath;
    if (/^file:\/\//i.test(fileUrlOrPath)) {
      basePath = fileURLToPath(fileUrlOrPath);
    }
    const dir = path.dirname(basePath);
    const abs = path.resolve(dir, val);
    return { inlineMap: null, mapUrl: abs };
  }

  return { inlineMap: null, mapUrl: val };
}

function loadMapJson(fileUrlOrPath: string): RawSourceMap | null {
  if (mapJsonCache.has(fileUrlOrPath)) return mapJsonCache.get(fileUrlOrPath)!;

  try {
    const { inlineMap, mapUrl } = resolveMapUrlOrInline(fileUrlOrPath);
    if (inlineMap) return inlineMap;
    if (!mapUrl) return null;

    const txt = readNodeText(mapUrl);
    const sourceMap = JSON.parse(txt) as RawSourceMap;
    mapJsonCache.set(fileUrlOrPath, sourceMap);
    return sourceMap;
  } catch {
    return null;
  }
}

function getConsumer(fileUrlOrPath: string): SourceMapConsumer | null {
  if (consumerCache.has(fileUrlOrPath))
    return consumerCache.get(fileUrlOrPath)!;
  const mapJson = loadMapJson(fileUrlOrPath);

  if (!mapJson) return null;

  const consumer = new SourceMapConsumer(mapJson as any);
  consumerCache.set(fileUrlOrPath, consumer);
  return consumer;
}

export function originalPosition(pos: CallerPos): OriginalPos {
  if (!pos.file || !pos.line || !pos.col) return pos;
  const consumer = getConsumer(pos.file);
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
