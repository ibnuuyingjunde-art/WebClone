import { Buffer } from "node:buffer";
import { URL } from "node:url";

export type CrawlStatus = "ok" | "partial" | "error";
export type ArchiveFile = {
  id: string;
  path: string;
  name: string;
  kind: string;
  mime: string;
  size: number;
  sourceUrl: string;
  status: "captured" | "recovered" | "error";
  note?: string;
  contentBase64?: string;
  isText: boolean;
};

type QueueItem = { url: string; hint?: string; parent?: string };

export type CrawlProgress = {
  stage: "validating" | "discovering" | "mapping" | "packaging";
  completed: number;
  discovered: number;
  file?: ArchiveFile;
};

type CrawlOptions = {
  maxFiles?: number;
  maxBytesPerFile?: number;
  timeoutMs?: number;
  onProgress?: (progress: CrawlProgress) => void;
};

const DEFAULTS = {
  maxFiles: 250,
  maxBytesPerFile: 2_500_000,
  timeoutMs: 8_000,
};

const TEXT_EXTENSIONS = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".vue",
  ".json", ".webmanifest", ".map", ".xml", ".txt", ".md", ".svg", ".scss", ".less",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html", ".htm": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".map": "application/json",
};

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "0.0.0.0") return true;
  if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length === 4 && parts.every(Number.isInteger)) {
    const [a, b] = parts;
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  return false;
};

const normalizeTarget = (value: string) => {
  const raw = value.trim();
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(candidate);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http:// and https:// URLs are supported");
  if (isPrivateHostname(parsed.hostname)) throw new Error("Private or local network targets are not allowed");
  parsed.hash = "";
  return parsed;
};

const safeDecode = (value: string) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

const safePathPart = (value: string) => safeDecode(value).replace(/[\\:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+$/, "_");

const extensionOf = (value: string) => {
  const clean = value.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot).toLowerCase() : "";
};

const inferMime = (url: string, header: string | null) => {
  const fromHeader = header?.split(";")[0]?.trim();
  if (fromHeader && fromHeader !== "application/octet-stream") return fromHeader;
  return MIME_BY_EXT[extensionOf(url)] || "application/octet-stream";
};

const isTextLike = (mime: string, url: string) => mime.startsWith("text/") || mime.includes("json") || mime.includes("javascript") || mime.includes("xml") || TEXT_EXTENSIONS.has(extensionOf(url));

const pathFromUrl = (resourceUrl: string, rootHost: string, hint?: string) => {
  const parsed = new URL(resourceUrl);
  const hostPart = parsed.hostname === rootHost ? "" : `${safePathPart(parsed.hostname)}/`;
  let pathname = parsed.pathname || "/";
  if (pathname.endsWith("/")) pathname += "index.html";
  if (pathname === "/") pathname = "/index.html";
  const segments = pathname.split("/").filter(Boolean).map(safePathPart);
  let result = `${hostPart}${segments.join("/")}` || "index.html";
  if (!extensionOf(result) && hint) result += hint;
  if (parsed.search) result = result.replace(/([^/]+)$/, `$1__${Buffer.from(parsed.search).toString("hex").slice(0, 10)}`);
  return result;
};

const uniqueArchivePath = (candidate: string, used: Set<string>) => {
  if (!used.has(candidate)) { used.add(candidate); return candidate; }
  const dot = candidate.lastIndexOf(".");
  const stem = dot > candidate.lastIndexOf("/") ? candidate.slice(0, dot) : candidate;
  const extension = dot > candidate.lastIndexOf("/") ? candidate.slice(dot) : "";
  let index = 2;
  let next = `${stem}__${index}${extension}`;
  while (used.has(next)) { index += 1; next = `${stem}__${index}${extension}`; }
  used.add(next);
  return next;
};

const absoluteUrl = (raw: string, base: URL) => {
  const value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!value || value.startsWith("#") || value.startsWith("data:") || value.startsWith("blob:") || value.startsWith("javascript:") || value.startsWith("mailto:")) return null;
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol) || isPrivateHostname(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
};

async function readLimited(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`Response exceeds ${Math.round(maxBytes / 1_000_000)} MB limit`);
  if (!response.body) return Buffer.from(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds ${Math.round(maxBytes / 1_000_000)} MB limit`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchResource(url: string, options: typeof DEFAULTS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "CopyWebStudio/1.0 (+public-asset-inspector)", accept: "*/*" },
    });
    const body = await readLimited(response, options.maxBytesPerFile);
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

const decodeText = (buffer: Buffer) => buffer.toString("utf8").replace(/^\uFEFF/, "");
const normalizeRelativeSource = (source: string) => source.replace(/^webpack:\/\//, "").replace(/^\.\//, "").split("/").filter(Boolean).map(safePathPart).join("/");

function extractUrls(text: string, base: URL) {
  const values = new Set<string>();
  const add = (raw: string) => { const url = absoluteUrl(raw, base); if (url) values.add(url); };
  for (const match of text.matchAll(/(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
  for (const match of text.matchAll(/url\(\s*["']?([^\)"']+)["']?\s*\)/gi)) add(match[1]);
  for (const match of text.matchAll(/(?:srcset|imagesrcset)\s*=\s*["']([^"']+)["']/gi)) {
    match[1].split(",").forEach(part => add(part.trim().split(/\s+/)[0]));
  }
  return [...values];
}

function kindFor(url: string, mime: string) {
  const ext = extensionOf(url);
  if (mime.includes("html") || ext === ".html" || ext === ".htm") return "HTML";
  if (mime.includes("css") || ext === ".css") return "CSS";
  if (mime.includes("javascript") || [".js", ".mjs", ".cjs"].includes(ext)) return "JS";
  if (mime.includes("json") || ext === ".json" || ext === ".webmanifest" || ext === ".map") return "DATA";
  if (mime.startsWith("image/") || [".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return "IMAGE";
  if (mime.startsWith("font/") || [".woff", ".woff2", ".ttf", ".otf"].includes(ext)) return "FONT";
  return "ASSET";
}

function dataUriToBuffer(value: string) {
  const match = value.match(/^data:application\/json(?:;charset=[^;]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  return match[1] ? Buffer.from(match[2], "base64") : Buffer.from(decodeURIComponent(match[2]), "utf8");
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(files: ArchiveFile[]) {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files.filter(item => item.contentBase64 && item.status !== "error")) {
    const name = Buffer.from(file.path, "utf8");
    const payload = Buffer.from(file.contentBase64!, "base64");
    const crc = crc32(payload);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    chunks.push(local, payload);

    const directory = Buffer.alloc(46 + name.length);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(0, 10);
    directory.writeUInt16LE(0, 12);
    directory.writeUInt16LE(0, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(payload.length, 20);
    directory.writeUInt32LE(payload.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt16LE(0, 30);
    directory.writeUInt16LE(0, 32);
    directory.writeUInt16LE(0, 34);
    directory.writeUInt16LE(0, 36);
    directory.writeUInt32LE(0, 38);
    directory.writeUInt32LE(offset, 42);
    name.copy(directory, 46);
    central.push(directory);
    offset += local.length + payload.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuffer, end]).toString("base64");
}

export async function crawlWebsite(target: string, custom: CrawlOptions = {}) {
  const options = { ...DEFAULTS, ...custom };
  const root = normalizeTarget(target);
  const queue: QueueItem[] = [{ url: root.toString() }];
  const queued = new Set(queue.map(item => item.url));
  const seen = new Set<string>();
  const files: ArchiveFile[] = [];
  const usedPaths = new Set<string>();
  const mapSources = new Set<string>();
  const errors: { url: string; message: string }[] = [];
  let recovered = 0;
  let rootTitle = root.hostname;
  options.onProgress?.({ stage: "validating", completed: 0, discovered: queue.length });

  while (queue.length && files.length < options.maxFiles) {
    const item = queue.shift()!;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    let response: Response;
    let body: Buffer;
    try {
      const result = await fetchResource(item.url, options);
      response = result.response;
      body = result.body;
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "Request timed out" : error instanceof Error ? error.message : "Request failed";
      errors.push({ url: item.url, message });
      const errorPath = uniqueArchivePath(pathFromUrl(item.url, root.hostname, item.hint), usedPaths);
      const errorFile = { id: `error-${files.length}`, path: errorPath, name: errorPath.split("/").pop() || "asset", kind: "ERROR", mime: "", size: 0, sourceUrl: item.url, status: "error" as const, note: message, isText: false };
      files.push(errorFile);
      options.onProgress?.({ stage: "discovering", completed: files.length, discovered: seen.size + queue.length, file: errorFile });
      continue;
    }

    if (!response.ok) {
      const message = `HTTP ${response.status} ${response.statusText || "response"}`;
      const failedPath = uniqueArchivePath(pathFromUrl(item.url, root.hostname, item.hint), usedPaths);
      errors.push({ url: item.url, message });
      const errorFile = { id: `error-${files.length}`, path: failedPath, name: failedPath.split("/").pop() || "asset", kind: "ERROR", mime: inferMime(item.url, response.headers.get("content-type")), size: body.length, sourceUrl: item.url, status: "error" as const, note: message, contentBase64: body.length ? body.toString("base64") : undefined, isText: false };
      files.push(errorFile);
      options.onProgress?.({ stage: "discovering", completed: files.length, discovered: seen.size + queue.length, file: errorFile });
      continue;
    }

    const mime = inferMime(item.url, response.headers.get("content-type"));
    const isText = isTextLike(mime, item.url);
    const path = uniqueArchivePath(pathFromUrl(item.url, root.hostname, item.hint), usedPaths);
    const name = path.split("/").pop() || path;
    const status: ArchiveFile["status"] = item.hint === ".recovered" ? "recovered" : "captured";
    const file: ArchiveFile = { id: `file-${files.length}`, path, name, kind: kindFor(item.url, mime), mime, size: body.length, sourceUrl: item.url, status, contentBase64: body.toString("base64"), isText };
    files.push(file);
    options.onProgress?.({ stage: "discovering", completed: files.length, discovered: seen.size + queue.length, file });

    if (files.length === 1 && mime.includes("html")) {
      const title = decodeText(body).match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
      if (title) rootTitle = title;
    }

    const text = isText ? decodeText(body) : "";
    if (text) {
      const base = new URL(item.url);
      if (mime.includes("html") || path === "index.html") {
        const inlineStyles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
        inlineStyles.forEach((match, index) => {
          const content = Buffer.from(match[1].trim(), "utf8");
          const inlinePath = uniqueArchivePath(`inline/${path}/style-${String(index + 1).padStart(2, "0")}.css`, usedPaths);
          files.push({ id: `inline-style-${files.length}`, path: inlinePath, name: inlinePath.split("/").pop() || "style.css", kind: "CSS", mime: "text/css", size: content.length, sourceUrl: item.url, status: "captured", contentBase64: content.toString("base64"), isText: true });
        });
        const inlineScripts = [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
        inlineScripts.forEach((match, index) => {
          const content = Buffer.from(match[1].trim(), "utf8");
          const inlinePath = uniqueArchivePath(`inline/${path}/script-${String(index + 1).padStart(2, "0")}.js`, usedPaths);
          files.push({ id: `inline-script-${files.length}`, path: inlinePath, name: inlinePath.split("/").pop() || "script.js", kind: "JS", mime: "text/javascript", size: content.length, sourceUrl: item.url, status: "captured", contentBase64: content.toString("base64"), isText: true });
        });
      }
      const discovered = extractUrls(text, base);
      for (const url of discovered) {
        if (queued.has(url) || seen.has(url) || queue.length + files.length >= options.maxFiles) continue;
        queued.add(url);
        const ext = extensionOf(url);
        const sameOrigin = new URL(url).origin === root.origin;
        if (sameOrigin || [".css", ".js", ".mjs", ".json", ".webmanifest", ".map", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff2", ".ttf", ".woff"].includes(ext)) queue.push({ url });
      }

      const sourceMapMatches = [...text.matchAll(/[#@]\s*sourceMappingURL\s*=\s*([^\s*]+)/g)];
      for (const match of sourceMapMatches) {
        const rawMap = match[1].trim();
        const inlineMap = dataUriToBuffer(rawMap);
        if (inlineMap) {
          try {
            const map = JSON.parse(decodeText(inlineMap)) as { sources?: string[]; sourcesContent?: (string | null)[] };
            const baseName = path.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9/_-]/g, "_");
            map.sources?.forEach((source, index) => {
              const content = map.sourcesContent?.[index];
              if (typeof content !== "string") return;
              const sourcePathCandidate = `source-maps/${baseName}/${normalizeRelativeSource(source) || `source-${index + 1}.ts`}`;
              if (mapSources.has(sourcePathCandidate)) return;
              const sourcePath = uniqueArchivePath(sourcePathCandidate, usedPaths);
              mapSources.add(sourcePathCandidate);
              const sourceBuffer = Buffer.from(content, "utf8");
              files.push({ id: `recovered-${recovered}`, path: sourcePath, name: sourcePath.split("/").pop() || sourcePath, kind: "SOURCE", mime: "text/plain", size: sourceBuffer.length, sourceUrl: item.url, status: "recovered", note: "Recovered from inline source map", contentBase64: sourceBuffer.toString("base64"), isText: true });
              recovered += 1;
            });
          } catch { /* keep the bundle available even if inline map is malformed */ }
        } else {
          const mapUrl = absoluteUrl(rawMap, base);
          if (mapUrl && !queued.has(mapUrl)) {
            queued.add(mapUrl);
            queue.push({ url: mapUrl });
          }
        }
      }

      if (path.endsWith(".map")) {
        try {
          const map = JSON.parse(text) as { sources?: string[]; sourcesContent?: (string | null)[] };
          const baseName = path.replace(/\.map$/, "").replace(/[^a-zA-Z0-9/_-]/g, "_");
          map.sources?.forEach((source, index) => {
            const content = map.sourcesContent?.[index];
            if (typeof content !== "string") return;
            const sourcePathCandidate = `source-maps/${baseName}/${normalizeRelativeSource(source) || `source-${index + 1}.ts`}`;
            if (mapSources.has(sourcePathCandidate)) return;
            const sourcePath = uniqueArchivePath(sourcePathCandidate, usedPaths);
            mapSources.add(sourcePathCandidate);
            const sourceBuffer = Buffer.from(content, "utf8");
            files.push({ id: `recovered-${recovered}`, path: sourcePath, name: sourcePath.split("/").pop() || sourcePath, kind: "SOURCE", mime: "text/plain", size: sourceBuffer.length, sourceUrl: item.url, status: "recovered", note: "Recovered from JavaScript source map", contentBase64: sourceBuffer.toString("base64"), isText: true });
            recovered += 1;
          });
        } catch {
          file.note = "Source map detected but could not be parsed";
        }
      }
    }
    options.onProgress?.({ stage: path.endsWith(".map") ? "mapping" : "discovering", completed: files.length, discovered: seen.size + queue.length, file });
  }

  const successful = files.filter(file => file.status !== "error");
  const totalBytes = successful.reduce((sum, file) => sum + file.size, 0);
  const sourceMapsFound = successful.filter(file => file.path.endsWith(".map")).length;
  options.onProgress?.({ stage: "packaging", completed: successful.length, discovered: seen.size });
  const zipBase64 = makeZip(successful);
  const status: CrawlStatus = errors.length === 0 ? "ok" : successful.length ? "partial" : "error";
  return {
    status,
    target: root.toString(),
    title: rootTitle,
    files,
    errors,
    recovered,
    stats: { files: successful.length, errors: errors.length, totalBytes, sourceMaps: sourceMapsFound, durationMs: 0 },
    zipBase64,
  };
}
