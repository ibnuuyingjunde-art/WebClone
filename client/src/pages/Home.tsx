import React, { useMemo, useState } from "react";
import {
  Archive, ArrowDownToLine, Check, ChevronDown, ChevronRight, CircleAlert, Clock3,
  Copy, Download, FileArchive, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen,
  Globe2, HardDriveDownload, Image as ImageIcon, Info, Loader2, Map, MoreHorizontal, PanelLeft,
  Eye, FileDown, Play, Search, ShieldCheck, Sparkles, Terminal, Type, X, Palette, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ArchiveFile = {
  id: string; path: string; name: string; kind: string; mime: string; size: number; sourceUrl: string;
  status: "captured" | "recovered" | "error"; note?: string; contentBase64?: string; isText: boolean;
};
type CrawlResult = {
  status: "ok" | "partial" | "error"; target: string; title: string; files: ArchiveFile[]; errors: { url: string; message: string }[];
  recovered: number; stats: { files: number; errors: number; totalBytes: number; sourceMaps: number; durationMs: number }; zipBase64: string;
};

type ExtractedColor = { name: string; value: string; raw: string; kind: "var" | "hex" | "rgb" | "hsl" };
type FoundSecret = { kind: string; key: string; value: string; source: string };

const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const normalizeUrlInput = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
const decodeText = (base64?: string) => {
  if (!base64) return "";
  try { return decodeURIComponent(escape(atob(base64))); } catch { return atob(base64); }
};
const isImage = (file: ArchiveFile) => file.kind === "IMAGE" || file.mime.startsWith("image/");
const filePayload = (file: ArchiveFile) => file.contentBase64 ? Uint8Array.from(atob(file.contentBase64), char => char.charCodeAt(0)) : null;
const fileDataUri = (file: ArchiveFile) => {
  if (file.contentBase64) return `data:${file.mime || "application/octet-stream"};base64,${file.contentBase64}`;
  return null;
};
const iconFor = (file: ArchiveFile | undefined, open = false) => {
  if (!file) return <FileText size={15} />;
  if (file.kind === "IMAGE") return <FileImage size={15} />;
  if (file.kind === "DATA") return <FileJson size={15} />;
  if (file.kind === "SOURCE") return <Sparkles size={15} />;
  if (file.kind === "FONT") return <Type size={15} />;
  if (file.kind === "ERROR") return <CircleAlert size={15} />;
  if (file.kind === "HTML" || file.kind === "CSS" || file.kind === "JS") return <FileCode2 size={15} />;
  return open ? <FolderOpen size={15} /> : <FileText size={15} />;
};

// --- color extraction ---
function extractColors(files: ArchiveFile[]): ExtractedColor[] {
  const seen = new Set<string>();
  const colors: ExtractedColor[] = [];
  const cssAndHtml = files.filter(f => (f.kind === "CSS" || f.kind === "HTML" || f.kind === "JS") && f.isText);
  for (const file of cssAndHtml) {
    const text = decodeText(file.contentBase64);
    // CSS variables
    for (const m of text.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;}{]+)/g)) {
      const raw = m[2].trim();
      if (/(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(raw)) {
        const key = `--${m[1]}:${raw}`;
        if (!seen.has(key)) { seen.add(key); colors.push({ name: `--${m[1]}`, value: raw, raw, kind: "var" }); }
      }
    }
    // hex colors
    for (const m of text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
      const key = m[0].toLowerCase();
      if (!seen.has(key)) { seen.add(key); colors.push({ name: key, value: key, raw: key, kind: "hex" }); }
    }
    // rgb/rgba
    for (const m of text.matchAll(/rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+[^)]*\)/g)) {
      const key = m[0].toLowerCase().replace(/\s+/g, "");
      if (!seen.has(key)) { seen.add(key); colors.push({ name: key, value: m[0], raw: key, kind: "rgb" }); }
    }
    // hsl/hsla
    for (const m of text.matchAll(/hsla?\(\s*[\d.]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+[^)]*\)/g)) {
      const key = m[0].toLowerCase().replace(/\s+/g, "");
      if (!seen.has(key)) { seen.add(key); colors.push({ name: key, value: m[0], raw: key, kind: "hsl" }); }
    }
  }
  return colors.slice(0, 120);
}

// --- logo extraction ---
function extractLogos(files: ArchiveFile[]): { label: string; dataUri: string; mime: string }[] {
  const logos: { label: string; dataUri: string; mime: string }[] = [];
  // Extract meta tags from HTML for og:image, apple-touch-icon, icon
  const htmlFiles = files.filter(f => f.kind === "HTML" && f.isText);
  const imgUrls = new Set<string>();
  for (const hf of htmlFiles) {
    const text = decodeText(hf.contentBase64);
    // og:image
    for (const m of text.matchAll(/property=["']og:image["']\s+content=["']([^"']+)["']/gi)) imgUrls.add(m[1]);
    for (const m of text.matchAll(/content=["']([^"']+)["']\s+property=["']og:image["']/gi)) imgUrls.add(m[1]);
    // icon links
    for (const m of text.matchAll(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["']/gi)) imgUrls.add(m[1]);
    for (const m of text.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/gi)) imgUrls.add(m[1]);
  }
  // Match URLs to captured image files
  for (const file of files.filter(f => f.kind === "IMAGE" && f.contentBase64)) {
    const isLogo = file.name.match(/logo|brand|icon|favicon|apple-touch/i) || imgUrls.has(file.sourceUrl);
    if (isLogo) {
      const uri = fileDataUri(file);
      if (uri) logos.push({ label: file.name, dataUri: uri, mime: file.mime });
    }
  }
  return logos.slice(0, 8);
}

// --- secrets/env scanner ---
function scanSecrets(files: ArchiveFile[]): FoundSecret[] {
  const found: FoundSecret[] = [];
  const seen = new Set<string>();
  const add = (kind: string, key: string, value: string, source: string) => {
    const k = `${kind}:${key}:${value.slice(0, 40)}`;
    if (!seen.has(k)) { seen.add(k); found.push({ kind, key, value: value.slice(0, 120), source }); }
  };
  for (const file of files.filter(f => f.isText)) {
    const text = decodeText(file.contentBase64);
    const src = file.path;
    // window.__X__ config blobs
    for (const m of text.matchAll(/window\.__([A-Z_]+)__\s*=\s*({[^;]{0,400}})/g)) add("window.__CONFIG__", `window.__${m[1]}__`, m[2].replace(/\s+/g, " "), src);
    // window.ENV or window.config
    for (const m of text.matchAll(/window\.(ENV|config|CONFIG|settings|SETTINGS)\s*=\s*({[^;]{0,400}})/g)) add("window.config", `window.${m[1]}`, m[2].replace(/\s+/g, " "), src);
    // process.env.X = in bundled JS
    for (const m of text.matchAll(/process\.env\.([A-Z_][A-Z0-9_]+)\s*[=:]\s*["']([^"']{1,200})["']/g)) add("process.env", `process.env.${m[1]}`, m[2], src);
    // API key/token variable assignments: const API_KEY = "..."
    for (const m of text.matchAll(/(?:const|let|var)\s+([A-Z_]*(?:KEY|TOKEN|SECRET|API|AUTH|PASSWORD|PASS|PWD|CREDENTIAL)[A-Z_0-9]*)\s*=\s*["']([^"']{6,200})["']/gi)) add("api-credential", m[1], m[2], src);
    // document.cookie assignments
    for (const m of text.matchAll(/document\.cookie\s*=\s*["']([^"']{0,300})["']/g)) add("cookie-set", "document.cookie", m[1], src);
    // Authorization headers
    for (const m of text.matchAll(/Authorization["']?\s*:\s*["']([^"']{1,200})["']/g)) add("auth-header", "Authorization", m[1], src);
    // localStorage.setItem patterns
    for (const m of text.matchAll(/localStorage\.setItem\(\s*["']([^"']+)["']\s*,\s*["']?([^"',)]{0,120})/g)) add("localStorage", m[1], m[2], src);
    // META env tags (React/Vite inject)
    for (const m of text.matchAll(/VITE_[A-Z_]+/g)) add("vite-env-ref", m[0], "(referenced in bundle)", src);
    // NEXT_PUBLIC env refs
    for (const m of text.matchAll(/NEXT_PUBLIC_[A-Z_]+/g)) add("next-env-ref", m[0], "(referenced in bundle)", src);
  }
  return found.slice(0, 200);
}

function Tree({ files, selected, onSelect }: { files: ArchiveFile[]; selected: string; onSelect: (file: ArchiveFile) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ assets: true, "source-maps": true, src: true, public: true, config: true, fonts: true });
  const tree = useMemo(() => {
    type Node = { name: string; path: string; file?: ArchiveFile; children: Node[] };
    const root: Node = { name: "root", path: "", children: [] };
    files.forEach(file => {
      const parts = file.path.split("/"); let cursor = root;
      parts.forEach((part, index) => {
        const path = parts.slice(0, index + 1).join("/");
        let next = cursor.children.find(child => child.name === part);
        if (!next) { next = { name: part, path, children: [] }; cursor.children.push(next); }
        if (index === parts.length - 1) next.file = file;
        cursor = next;
      });
    });
    const sort = (nodes: Node[]) => nodes.sort((a, b) => Number(Boolean(b.children.length)) - Number(Boolean(a.children.length)) || a.name.localeCompare(b.name)).forEach(node => sort(node.children));
    sort(root.children); return root.children;
  }, [files]);
  const render = (nodes: { name: string; path: string; file?: ArchiveFile; children: { name: string; path: string; file?: ArchiveFile; children: any[] }[] }[], depth = 0): React.ReactNode => nodes.map(node => {
    const isFolder = node.children.length > 0;
    const expanded = open[node.path] ?? true;
    if (isFolder) return <div key={node.path}>
      <button className="tree-row folder-row" style={{ paddingLeft: `${12 + depth * 14}px` }} onClick={() => setOpen(state => ({ ...state, [node.path]: !expanded }))}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {expanded ? <FolderOpen size={15} /> : <Folder size={15} />} <span>{node.name}</span><em>{node.children.length}</em>
      </button>
      {expanded && render(node.children, depth + 1)}
    </div>;
    const file = node.file!;
    return <button key={node.path} className={`tree-row file-row ${selected === file.id ? "selected" : ""}`} style={{ paddingLeft: `${28 + depth * 14}px` }} onClick={() => onSelect(file)}>
      {iconFor(file)} <span>{node.name}</span>{file.status === "recovered" && <span className="recovered-dot" title="Recovered from source map" />}
    </button>;
  });
  return <div className="tree">{render(tree)}</div>;
}

type WorkspaceTab = "archive" | "design" | "secrets";

function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [stage, setStage] = useState("idle");
  const [notice, setNotice] = useState("Paste a public URL to start a real crawl");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [crawlProgress, setCrawlProgress] = useState({ completed: 0, discovered: 0 });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("archive");
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  const selected = files.find(file => file.id === selectedId) || files[0];
  const filteredFiles = useMemo(() => query.trim() ? files.filter(file => file.path.toLowerCase().includes(query.toLowerCase())) : files, [files, query]);
  const stats = result?.stats || { files: files.length, errors: files.filter(file => file.status === "error").length, totalBytes: files.reduce((sum, file) => sum + file.size, 0), sourceMaps: 0, durationMs: 0 };
  const content = decodeText(selected?.contentBase64);

  const extractedColors = useMemo(() => extractColors(files), [files]);
  const logos = useMemo(() => extractLogos(files), [files]);
  const secrets = useMemo(() => scanSecrets(files), [files]);

  const copyColor = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedColor(val);
    setTimeout(() => setCopiedColor(null), 1500);
  };
  const copySecret = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedSecret(val);
    setTimeout(() => setCopiedSecret(null), 1500);
  };

  const runCrawl = async () => {
    const normalizedUrl = normalizeUrlInput(url);
    setUrl(normalizedUrl); setNotice(""); setIsCrawling(true); setStage("validating"); setFiles([]); setResult(null); setSelectedId(""); setCrawlProgress({ completed: 0, discovered: 1 }); setActiveTab("archive");
    const stream = new EventSource(`/api/crawl/stream?url=${encodeURIComponent(normalizedUrl)}`);
    const finish = () => { stream.close(); setIsCrawling(false); };
    const applyComplete = (payload: CrawlResult) => {
      setResult(payload); setFiles(payload.files); setSelectedId(payload.files.find(file => file.status === "recovered" || file.isText)?.id || payload.files[0]?.id || "");
      setNotice(payload.status === "partial" ? `${payload.errors.length} asset(s) could not be reached · partial archive ready` : `Archive ready · ${payload.files.length} files captured`);
      setStage("ready"); finish();
    };
    stream.addEventListener("progress", event => {
      const progress = JSON.parse((event as MessageEvent).data) as { stage: string; completed: number; discovered: number; file?: ArchiveFile };
      setStage(progress.stage); setCrawlProgress({ completed: progress.completed, discovered: progress.discovered });
      if (progress.file) {
        setFiles(current => current.some(file => file.id === progress.file!.id) ? current : [...current, progress.file!]);
        setSelectedId(current => current || progress.file?.id || "");
        setNotice(`${progress.completed} file(s) indexed · ${progress.discovered} resource(s) discovered`);
      }
    });
    stream.addEventListener("complete", event => { applyComplete(JSON.parse((event as MessageEvent).data) as CrawlResult); });
    stream.addEventListener("error", async event => {
      const data = (event as MessageEvent).data;
      if (data) { setStage("error"); setNotice(JSON.parse(data).error || "Crawler backend returned an error"); finish(); return; }
      stream.close(); setStage("discovering"); setNotice("SSE tidak tersedia, mencoba mode crawl biasa…");
      try {
        const response = await fetch("/api/crawl", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: normalizedUrl }) });
        const responseText = await response.text();
        let payload: (CrawlResult & { error?: string }) | null = null;
        try { payload = JSON.parse(responseText) as CrawlResult & { error?: string }; } catch { /* static hosts often return an HTML 404 page */ }
        if (!response.ok || !payload) throw new Error(`Backend API tidak tersedia (HTTP ${response.status}). Host mengembalikan halaman static, bukan JSON API.`);
        applyComplete(payload);
      } catch (fallbackError) {
        setStage("error"); setNotice(fallbackError instanceof Error ? `${fallbackError.message}. Deploy aplikasi sebagai Node/Docker, bukan static upload.` : "Backend crawler tidak tersedia. Deploy aplikasi sebagai Node/Docker, bukan static upload."); finish();
      }
    });
  };

  const downloadZip = () => {
    if (!result?.zipBase64) { setNotice("Run a crawl first to generate a ZIP package"); return; }
    const blob = new Blob([Uint8Array.from(atob(result.zipBase64), char => char.charCodeAt(0))], { type: "application/zip" });
    const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${new URL(result.target).hostname}-copyweb.zip`; anchor.click(); URL.revokeObjectURL(href);
  };
  const downloadFile = (file: ArchiveFile) => {
    const payload = filePayload(file);
    if (!payload) { setNotice("File ini gagal diambil, jadi tidak ada payload untuk diunduh"); return; }
    const blob = new Blob([payload], { type: file.mime || "application/octet-stream" });
    const href = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = href; anchor.download = file.name; anchor.click(); URL.revokeObjectURL(href);
    setNotice(`Downloaded ${file.path}`);
  };
  const buildPreview = () => {
    const htmlFile = files.find(file => file.kind === "HTML" || file.path === "index.html");
    if (!htmlFile) { setNotice("Belum ada HTML yang berhasil diambil untuk dipreview"); return; }
    setIframeLoading(true);
    setPreviewOpen(true);
  };
  const previewHtml = useMemo(() => {
    const htmlFile = files.find(file => file.kind === "HTML" || file.path === "index.html");
    if (!htmlFile) return "<p>No HTML captured.</p>";
    let html = decodeText(htmlFile.contentBase64);

    // Hard cap: if the HTML itself is already huge, skip asset inlining to avoid OOM
    const MAX_HTML_BYTES = 2_000_000;     // 2 MB source HTML
    const MAX_ASSET_BYTES = 300_000;      // skip files whose base64 URI would be enormous
    if (html.length > MAX_HTML_BYTES) return html;

    // Build a lookup: basename → data URI, skipping large assets
    const assetMap = new Map<string, string>();
    for (const file of files) {
      if (file.status === "error" || !file.contentBase64) continue;
      if (file.size > MAX_ASSET_BYTES) continue;
      const uri = fileDataUri(file);
      if (!uri) continue;
      const basename = file.path.split("/").pop() || file.path;
      if (basename) assetMap.set(basename, uri);
    }
    if (assetMap.size === 0) return html;

    // Replace only inside src="…", href="…", url(…) — never blind global replace
    html = html.replace(
      /(\bsrc=["']|href=["']|url\(['"]?)(\.\.?\/)?([^"')>\s]+)(["')])/g,
      (match, prefix, _dot, filename, suffix) => {
        const base = filename.split("/").pop() || filename;
        const uri = assetMap.get(base);
        return uri ? `${prefix}${uri}${suffix}` : match;
      }
    );
    return html;
  }, [files]);

  const generateColorHtml = () => {
    if (!extractedColors.length) return;
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Color Palette — ${result?.title || url}</title>
<style>
  body{margin:0;padding:40px;font-family:system-ui,sans-serif;background:#111;color:#eee}
  h1{font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin:0 0 32px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
  .swatch{border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.1)}
  .color{height:80px}
  .info{padding:10px 12px;background:#1a1a1a}
  .name{font-size:11px;font-family:monospace;color:#ccc;word-break:break-all}
  .val{font-size:10px;color:#666;margin-top:3px;font-family:monospace}
  .kind{display:inline-block;margin-top:5px;font-size:9px;padding:2px 6px;border-radius:3px;background:#2a2a2a;color:#888;text-transform:uppercase;letter-spacing:.06em}
</style></head>
<body>
<h1>Color Palette · ${extractedColors.length} colors · ${result?.title || url}</h1>
<div class="grid">
${extractedColors.map(c => `<div class="swatch"><div class="color" style="background:${c.value}"></div><div class="info"><div class="name">${c.name}</div><div class="val">${c.value}</div><span class="kind">${c.kind}</span></div></div>`).join("\n")}
</div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${result?.title || "palette"}-colors.html`; a.click();
  };

  const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "archive", label: "Archive", icon: <Archive size={13} />, count: files.length },
    { id: "design", label: "Design", icon: <Palette size={13} />, count: extractedColors.length + logos.length },
    { id: "secrets", label: "Secrets", icon: <KeyRound size={13} />, count: secrets.length },
  ];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">&lt;&gt;</span><span>COPYWEB</span><span className="brand-tag">STUDIO</span></div>
      <div className="topbar-meta"><span className="live-dot" /> public asset crawler <span className="version">v0.8.5</span><a className="topbar-docs" href="/docs">docs</a><button className="icon-button" aria-label="More options"><MoreHorizontal size={18} /></button></div>
    </header>

    <main className="main-wrap">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> inspect the whole tree</div>
          <h1>Paste a URL.<br /><span>See everything.</span></h1>
          <p>Capture the public source surface — assets, inline code, fonts, and the original files hidden inside source maps.</p>
          <div className="target-form">
            <div className="url-input-wrap"><Globe2 size={17} /><input aria-label="Target website URL" value={url} onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void runCrawl(); }} placeholder="example.com atau example.com/docs" /><button className="clear-input" onClick={() => setUrl("")} aria-label="Clear URL"><X size={15} /></button></div>
            <Button className="crawl-button" onClick={() => void runCrawl()} disabled={isCrawling || !url.trim()}>{isCrawling ? <Loader2 size={16} className="spin" /> : <Play size={15} fill="currentColor" />} {isCrawling ? "Crawling" : "Copy website"}</Button>
          </div>
          <div className="under-form"><ShieldCheck size={14} /> Only crawl websites you own or have permission to analyze <span className="boundary-note">· private env, tokens, GitHub credentials, and server source are never fetched</span></div>
        </div>
        <div className="hero-signal">
          <div className="signal-head"><span>capture profile</span><span className="signal-code">CW / PUBLIC</span></div>
          <div className="signal-grid"><div><strong>ALL</strong><span>file formats</span></div><div><strong>MAP</strong><span>source recovery</span></div><div><strong>ZIP</strong><span>one-click export</span></div></div>
          <div className="signal-foot"><span className="pulse-bar" /> <span>{isCrawling ? `stage.${stage}` : result ? `archive.${result.status}` : "archive.ready"}</span><span className="signal-time">{isCrawling ? `${crawlProgress.completed}/${crawlProgress.discovered} indexed` : `${stats.files} files indexed`}</span></div>
        </div>
      </section>

      <section className="stats-row" aria-label="Archive statistics">
        <div className="stat-card accent"><span>captured files</span><strong>{String(stats.files).padStart(2, "0")}</strong><small><Archive size={13} /> all formats</small></div>
        <div className="stat-card"><span>total weight</span><strong>{formatBytes(stats.totalBytes)}</strong><small><HardDriveDownload size={13} /> payload size</small></div>
        <div className="stat-card"><span>source maps</span><strong>{String(stats.sourceMaps).padStart(2, "0")}</strong><small><Map size={13} /> {files.filter(file => file.status === "recovered").length} files recovered</small></div>
        <div className="stat-card"><span>crawl time</span><strong>{result ? `${(stats.durationMs / 1000).toFixed(1)}s` : "—"}</strong><small><Clock3 size={13} /> server-side fetch</small></div>
      </section>

      <div className={`notice ${stage === "error" ? "error" : notice.includes("partial") ? "warn" : ""}`}>
        {stage === "error" ? <CircleAlert size={15} /> : notice.includes("ready") || notice.includes("captured") ? <Check size={15} /> : <Info size={15} />}<span>{notice || `stage.${stage} · collecting public resources`}</span>
        {notice && <button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={14} /></button>}
      </div>

      <section className="workspace">
        <div className="workspace-head">
          <div><span className="section-kicker">archive workspace</span><h2>{result?.title || "No archive yet"}</h2></div>
          <div className="workspace-actions">
            <div className="ws-tabs">
              {TABS.map(tab => (
                <button key={tab.id} className={`ws-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                  {tab.icon} {tab.label}
                  {(tab.count ?? 0) > 0 && <span className="ws-tab-count">{tab.count}</span>}
                </button>
              ))}
            </div>
            <div className="search-wrap"><Search size={14} /><input placeholder="Filter files" value={query} onChange={event => setQuery(event.target.value)} /></div>
            <Button variant="outline" size="sm" onClick={buildPreview} disabled={!files.length}><Eye size={14} /> Preview site</Button>
            <Button variant="outline" size="sm" onClick={downloadZip} disabled={!result?.zipBase64}><Download size={14} /> Download .zip</Button>
          </div>
        </div>

        {/* ARCHIVE TAB */}
        {activeTab === "archive" && (
          <div className="workspace-body">
            <aside className="file-sidebar"><div className="pane-title"><span><PanelLeft size={14} /> file tree</span><span className="muted-count">{filteredFiles.length}/{files.length}</span></div><Tree files={filteredFiles} selected={selected?.id || ""} onSelect={file => setSelectedId(file.id)} /><div className="sidebar-foot"><span className="legend-dot captured" /> captured <span className="legend-dot recovered" /> source map <span className="legend-dot failed" /> failed</div></aside>
            <div className="code-pane"><div className="pane-title"><span>{iconFor(selected)} <strong>{selected?.path || "No file selected"}</strong></span><div className="pane-title-actions"><span className={`file-status ${selected?.status || ""}`}>{selected?.status || "—"}</span><button className="small-icon" title="Copy file" onClick={() => content && navigator.clipboard?.writeText(content)}><Copy size={14} /></button></div></div>{selected && isImage(selected) ? <div className="image-stage">{selected.contentBase64 ? <img src={`data:${selected.mime};base64,${selected.contentBase64}`} alt={selected.name} /> : <div className="empty-preview"><ImageIcon size={32} /><span>Preview unavailable</span></div>}</div> : <div className="code-viewer">{content ? content.split("\n").map((line: string, index: number) => <div className="code-line" key={`${selected?.id}-${index}`}><span className="line-number">{String(index + 1).padStart(3, "0")}</span><code>{line || " "}</code></div>) : <div className="empty-preview"><FileArchive size={30} /><span>Binary asset · no inline preview</span><small>{selected?.mime || "unknown type"}</small></div>}</div>}</div>
            <aside className="inspector"><div className="pane-title"><span><Terminal size={14} /> inspector</span><button className="small-icon"><MoreHorizontal size={14} /></button></div>{selected ? <div className="inspector-content"><div className="file-heading"><div className="large-file-icon">{iconFor(selected)}</div><div><h3>{selected.name}</h3><span>{selected.kind} · {formatBytes(selected.size)}</span></div></div><div className="meta-group"><span>source URL</span><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceUrl}</a></div><div className="meta-group"><span>mime type</span><code>{selected.mime || "not available"}</code></div><div className="meta-group"><span>archive path</span><code>{selected.path}</code></div>{selected.note && <div className={`map-callout ${selected.status === "error" ? "failed-callout" : ""}`}>{selected.status === "error" ? <CircleAlert size={15} /> : <Sparkles size={15} />}<div><strong>{selected.status === "error" ? "Capture failed" : "Source recovered"}</strong><p>{selected.note}</p></div></div>}<div className="inspector-actions"><Button variant="outline" size="sm" onClick={() => content && navigator.clipboard?.writeText(content)} disabled={!content}><Copy size={14} /> Copy code</Button><Button variant="outline" size="sm" onClick={() => downloadFile(selected)}><FileDown size={14} /> Download file</Button></div></div> : <div className="empty-inspector">Select a file to inspect</div>}</aside>
          </div>
        )}

        {/* DESIGN TAB */}
        {activeTab === "design" && (
          <div className="design-panel">
            {!files.length && (
              <div className="design-empty"><Palette size={36} /><span>Run a crawl first to extract the design system</span></div>
            )}
            {files.length > 0 && (
              <>
                {logos.length > 0 && (
                  <div className="design-section">
                    <div className="design-section-head">
                      <span><ImageIcon size={13} /> Logos & Icons</span>
                      <small>{logos.length} found</small>
                    </div>
                    <div className="logo-grid">
                      {logos.map((logo, i) => (
                        <div key={i} className="logo-card">
                          <div className="logo-preview-bg">
                            <img src={logo.dataUri} alt={logo.label} />
                          </div>
                          <div className="logo-meta">
                            <span>{logo.label}</span>
                            <small>{logo.mime}</small>
                            <button className="dl-logo-btn" onClick={() => {
                              const a = document.createElement("a"); a.href = logo.dataUri; a.download = logo.label; a.click();
                            }}><ArrowDownToLine size={12} /> PNG</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="design-section">
                  <div className="design-section-head">
                    <span><Palette size={13} /> Color Palette</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <small>{extractedColors.length} colors extracted</small>
                      {extractedColors.length > 0 && (
                        <button className="export-colors-btn" onClick={generateColorHtml}>
                          <ArrowDownToLine size={12} /> Export HTML
                        </button>
                      )}
                    </div>
                  </div>
                  {extractedColors.length === 0 ? (
                    <div className="design-empty-inline"><span>No colors found in CSS/HTML files</span></div>
                  ) : (
                    <>
                      {/* CSS Variables first */}
                      {extractedColors.filter(c => c.kind === "var").length > 0 && (
                        <div className="color-group">
                          <div className="color-group-label">CSS Variables</div>
                          <div className="color-swatches">
                            {extractedColors.filter(c => c.kind === "var").map((color, i) => (
                              <button key={i} className={`color-swatch ${copiedColor === color.value ? "copied" : ""}`} onClick={() => copyColor(color.value)} title={`${color.name}: ${color.value}`}>
                                <span className="swatch-color" style={{ background: color.value }} />
                                <span className="swatch-name">{color.name}</span>
                                <span className="swatch-val">{color.value.length > 22 ? color.value.slice(0, 22) + "…" : color.value}</span>
                                <span className="swatch-copy">{copiedColor === color.value ? "copied" : "copy"}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Hex colors */}
                      {extractedColors.filter(c => c.kind === "hex").length > 0 && (
                        <div className="color-group">
                          <div className="color-group-label">Hex Colors</div>
                          <div className="color-swatches hex-swatches">
                            {extractedColors.filter(c => c.kind === "hex").map((color, i) => (
                              <button key={i} className={`color-swatch hex-swatch ${copiedColor === color.value ? "copied" : ""}`} onClick={() => copyColor(color.value)}>
                                <span className="swatch-color" style={{ background: color.value }} />
                                <span className="swatch-hex">{color.value}</span>
                                <span className="swatch-copy">{copiedColor === color.value ? "✓" : "⎘"}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* rgb/hsl */}
                      {extractedColors.filter(c => c.kind === "rgb" || c.kind === "hsl").length > 0 && (
                        <div className="color-group">
                          <div className="color-group-label">rgb / hsl</div>
                          <div className="color-swatches">
                            {extractedColors.filter(c => c.kind === "rgb" || c.kind === "hsl").map((color, i) => (
                              <button key={i} className={`color-swatch ${copiedColor === color.raw ? "copied" : ""}`} onClick={() => copyColor(color.raw)}>
                                <span className="swatch-color" style={{ background: color.value }} />
                                <span className="swatch-name">{color.kind}</span>
                                <span className="swatch-val">{color.value.length > 28 ? color.value.slice(0, 28) + "…" : color.value}</span>
                                <span className="swatch-copy">{copiedColor === color.raw ? "copied" : "copy"}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SECRETS / ENV TAB */}
        {activeTab === "secrets" && (
          <div className="secrets-panel">
            {!files.length && (
              <div className="design-empty"><KeyRound size={36} /><span>Run a crawl first to scan for exposed config</span></div>
            )}
            {files.length > 0 && secrets.length === 0 && (
              <div className="design-empty"><Check size={36} style={{ color: "var(--signal)" }} /><span>No exposed env vars, tokens, or config blobs found</span></div>
            )}
            {secrets.length > 0 && (
              <>
                <div className="secrets-header">
                  <span><KeyRound size={13} /> {secrets.length} item{secrets.length !== 1 ? "s" : ""} found in public bundle</span>
                  <small style={{ color: "var(--warn)" }}>These are public — no server-side secrets are accessible via crawl</small>
                </div>
                {(["window.__CONFIG__", "window.config", "process.env", "api-credential", "auth-header", "cookie-set", "localStorage", "vite-env-ref", "next-env-ref"] as const).map(kind => {
                  const group = secrets.filter(s => s.kind === kind);
                  if (!group.length) return null;
                  const kindLabels: Record<string, string> = {
                    "window.__CONFIG__": "window.__CONFIG__ blobs",
                    "window.config": "window.config / ENV injections",
                    "process.env": "process.env references",
                    "api-credential": "API keys / tokens / secrets",
                    "auth-header": "Authorization headers",
                    "cookie-set": "document.cookie assignments",
                    "localStorage": "localStorage.setItem calls",
                    "vite-env-ref": "VITE_* env references",
                    "next-env-ref": "NEXT_PUBLIC_* env references",
                  };
                  return (
                    <div key={kind} className="secret-group">
                      <div className="secret-group-label">{kindLabels[kind] || kind} <em>{group.length}</em></div>
                      {group.map((s, i) => (
                        <div key={i} className="secret-row">
                          <div className="secret-row-head">
                            <code className="secret-key">{s.key}</code>
                            <code className="secret-src">{s.source}</code>
                            <button className="secret-copy" onClick={() => copySecret(s.value)}>{copiedSecret === s.value ? "✓ copied" : "copy"}</button>
                          </div>
                          <code className="secret-value">{s.value}</code>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </section>

      <footer className="footer"><span><span className="footer-mark">&lt;/&gt;</span> Built for the curious.</span><span>Public resources only · secrets and private server source are never fetched · <a href="/api/health">system status</a></span></footer>
    </main>

    {previewOpen && (
      <div className="preview-modal" role="dialog" aria-modal="true" aria-label="Website snapshot preview">
        <div className="preview-modal-head">
          <div><span className="section-kicker">local reconstruction</span><h2>Snapshot preview</h2></div>
          <button className="preview-close" onClick={() => setPreviewOpen(false)} aria-label="Close preview"><X size={18} /></button>
        </div>
        <div className="preview-warning"><Info size={14} /> This is a local reconstruction of captured public files. Server routes, login flows, private APIs, env values, and external services are not included.</div>
        <div className="preview-iframe-wrap">
          {iframeLoading && (
            <div className="preview-loading-overlay">
              <div className="preview-loading-inner">
                <Loader2 size={28} className="spin" />
                <span>Rendering snapshot…</span>
                <small>Assembling captured assets into a local reconstruction</small>
              </div>
            </div>
          )}
          <iframe
            title="Captured website preview"
            sandbox="allow-scripts"
            srcDoc={previewHtml}
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    )}
  </div>;
}

export default Home;
