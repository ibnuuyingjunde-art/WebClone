import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Copy, ExternalLink, Github, Send, Terminal, Zap } from "lucide-react";
import { Link } from "wouter";

const telegram = ["aboutyoen", "yoennakbobo", "yoen0724"];

const EXAMPLE_RESPONSE = {
  status: "ok",
  target: "https://example.com",
  title: "Example Domain",
  recovered: 0,
  stats: {
    files: 3,
    errors: 0,
    totalBytes: 18432,
    sourceMaps: 0,
    durationMs: 1240
  },
  files: [
    {
      id: "f1",
      path: "/index.html",
      name: "index.html",
      kind: "HTML",
      mime: "text/html",
      size: 1256,
      sourceUrl: "https://example.com/",
      status: "captured",
      isText: true
    },
    {
      id: "f2",
      path: "/styles/main.css",
      name: "main.css",
      kind: "CSS",
      mime: "text/css",
      size: 8420,
      sourceUrl: "https://example.com/styles/main.css",
      status: "captured",
      isText: true
    },
    {
      id: "f3",
      path: "/app.js",
      name: "app.js",
      kind: "JS",
      mime: "application/javascript",
      size: 8756,
      sourceUrl: "https://example.com/app.js",
      status: "captured",
      isText: true
    }
  ],
  errors: [],
  zipBase64: "<base64 encoded zip archive>"
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="docs-copy-btn" onClick={handle} aria-label="Copy">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function Docs() {
  const [activeTab, setActiveTab] = useState<"curl" | "js" | "python">("curl");

  const curlSnippet = `curl -X POST https://your-domain.vercel.app/api/crawl \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`;

  const jsSnippet = `const res = await fetch("/api/crawl", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" }),
});
const data = await res.json();
console.log(data.stats); // { files, errors, totalBytes, durationMs }`;

  const pythonSnippet = `import requests

res = requests.post("https://your-domain.vercel.app/api/crawl", json={
    "url": "https://example.com"
})
data = res.json()
print(f"{data['stats']['files']} files captured in {data['stats']['durationMs']}ms")`;

  const snippets = { curl: curlSnippet, js: jsSnippet, python: pythonSnippet };

  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <Link href="/" className="docs-back">
          <ArrowLeft size={15} /> CopyWeb Studio
        </Link>
        <span className="docs-label">DOCUMENTATION</span>
      </header>

      <main className="docs-main">
        {/* Hero */}
        <p className="eyebrow"><span className="eyebrow-line" /> api reference</p>
        <h1>CopyWeb Public API</h1>
        <p className="docs-lead">
          Satu endpoint. Kirim URL, dapatkan arsip lengkap — HTML, CSS, JS, gambar, source map —
          dalam satu response JSON. Gratis, tanpa auth, tanpa rate limit yang aneh-aneh.
        </p>

        {/* Quick stat chips */}
        <div className="docs-chips">
          <span className="chip"><Zap size={12} /> REST · JSON</span>
          <span className="chip"><Terminal size={12} /> No auth required</span>
          <span className="chip chip-green"><ChevronRight size={12} /> 1 endpoint</span>
        </div>

        {/* ── POST /api/crawl ── */}
        <section className="docs-section">
          <div className="endpoint-badge">
            <span className="method-tag">POST</span>
            <code className="endpoint-path">/api/crawl</code>
          </div>

          <div className="docs-grid">
            <article className="docs-card">
              <h2>Request body</h2>
              <div className="param-table">
                <div className="param-row">
                  <code className="param-name">url</code>
                  <span className="param-type">string · required</span>
                  <span className="param-desc">URL publik yang ingin di-crawl. HTTP/HTTPS.</span>
                </div>
              </div>
            </article>
            <article className="docs-card">
              <h2>Response fields</h2>
              <div className="param-table">
                <div className="param-row"><code className="param-name">status</code><span className="param-type">string</span><span className="param-desc">"ok" | "partial" | "error"</span></div>
                <div className="param-row"><code className="param-name">files</code><span className="param-type">array</span><span className="param-desc">Semua file yang berhasil diambil</span></div>
                <div className="param-row"><code className="param-name">stats</code><span className="param-type">object</span><span className="param-desc">files, errors, totalBytes, durationMs</span></div>
                <div className="param-row"><code className="param-name">zipBase64</code><span className="param-type">string</span><span className="param-desc">Arsip ZIP base64 dari semua file</span></div>
                <div className="param-row"><code className="param-name">errors</code><span className="param-type">array</span><span className="param-desc">File yang gagal diambil + alasannya</span></div>
              </div>
            </article>
          </div>
        </section>

        {/* ── Code snippets ── */}
        <section className="docs-section">
          <h2 className="docs-section-title">Cara pakai</h2>
          <div className="code-panel">
            <div className="code-tabs">
              {(["curl", "js", "python"] as const).map(t => (
                <button key={t} className={`code-tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>
                  {t === "js" ? "JavaScript" : t === "python" ? "Python" : "cURL"}
                </button>
              ))}
              <CopyButton text={snippets[activeTab]} />
            </div>
            <pre className="code-block"><code>{snippets[activeTab]}</code></pre>
          </div>
        </section>

        {/* ── Example response ── */}
        <section className="docs-section">
          <h2 className="docs-section-title">Contoh output</h2>
          <div className="code-panel">
            <div className="code-tabs">
              <span className="code-tab-label"><Terminal size={12} /> Response JSON</span>
              <CopyButton text={JSON.stringify(EXAMPLE_RESPONSE, null, 2)} />
            </div>
            <pre className="code-block code-response"><code>{JSON.stringify(EXAMPLE_RESPONSE, null, 2)}</code></pre>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="docs-grid">
          <article className="docs-card">
            <h2>Alur kerja</h2>
            <ol>
              <li>Kirim URL publik seperti <code>https://example.com/docs</code>.</li>
              <li>CopyWeb mengikuti semua link HTML satu origin — <code>/docs</code>, <code>/app</code>, halaman lain yang ditemukan — sampai batas crawl.</li>
              <li>File muncul di response lengkap dengan status per-file dan error.</li>
              <li>Gunakan <code>zipBase64</code> buat download semua sekaligus, atau olah <code>files[]</code> satu per satu.</li>
            </ol>
          </article>
          <article className="docs-card">
            <h2>Batas keamanan</h2>
            <p>Yang diambil <strong>hanya resource HTTP publik</strong> yang bisa diakses tanpa login.</p>
            <p>Tidak mengambil: <code>.env</code>, token, cookie, password, GitHub credential, source backend privat, atau data di private network.</p>
            <p>Kalau resource gagal diambil, tetap muncul di <code>errors[]</code> dengan alasan HTTP, timeout, atau batas ukuran.</p>
          </article>
        </section>

        <section className="docs-card docs-wide">
          <h2>Source map &amp; preview</h2>
          <p>JavaScript <code>.map</code> diproses kalau tersedia. File asli TS, TSX, atau Vue bisa dipulihkan kalau source map publik punya <code>sourcesContent</code>. <code>zipBase64</code> berisi rekonstruksi lokal dari HTML dan asset yang berhasil diambil — route server, login, API privat, dan env tidak ikut.</p>
        </section>

        {/* ── Supabase tracking note ── */}
        <section className="docs-card docs-wide docs-tracking-card">
          <div className="tracking-header">
            <div>
              <p className="section-kicker">usage analytics</p>
              <h2>Setiap request dicatat</h2>
            </div>
          </div>
          <p>Setiap call ke <code>/api/crawl</code> disimpan ke Supabase: endpoint, URL target, status, durasi, jumlah file, total bytes. Page visit juga tercatat via <code>/api/track</code>. Data bisa dilihat langsung di Supabase Table Editor.</p>
          <div className="param-table" style={{ marginTop: "0.75rem" }}>
            <div className="param-row"><code className="param-name">api_requests</code><span className="param-desc">Semua call ke /api/crawl + metadata</span></div>
            <div className="param-row"><code className="param-name">page_views</code><span className="param-desc">Page visit + referrer + user agent</span></div>
          </div>
        </section>

        {/* ── Creator ── */}
        <section className="docs-card docs-wide creator-card">
          <div>
            <p className="section-kicker">created by</p>
            <h2>lianix <span>·</span> yungtg</h2>
          </div>
          <div className="creator-links">
            <a href="https://github.com/ibnuuyingjunde-art" target="_blank" rel="noreferrer">
              <Github size={16} /> GitHub <ExternalLink size={12} />
            </a>
            {telegram.map(handle => (
              <a key={handle} href={`https://t.me/${handle}`} target="_blank" rel="noreferrer">
                <Send size={15} /> @{handle} <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
