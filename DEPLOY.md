# Deploy CopyWeb Studio

## Kenapa muncul "Backend API tidak tersedia (HTTP 500)"

Pesan itu muncul karena host yang dipakai cuma menyajikan file statis (HTML/JS hasil
build), bukan menjalankan `server/_core/index.ts` dengan Node. Jadi `/api/health`,
`/api/crawl`, dan `/api/crawl/stream` tidak ada yang mendengarkan — host balas dengan
halaman HTML (404/500), bukan JSON, dan frontend melempar error itu.

Penyebab paling umum: upload ZIP lewat halaman **drag-and-drop** Vercel
(vercel.com/new, tarik folder ke browser). Jalur itu cuma mendukung deploy statis murni
— tidak ada build step, tidak ada serverless functions — walau `vercel.json` sudah benar.
Repo ini butuh runtime Node asli (Express + SSE + crawler), jadi upload statis tidak akan
pernah menjalankan API-nya, berapa kali pun di-upload ulang.

## Cara paling aman: Docker, zero-config

Tidak ada environment variable wajib (DB opsional, auto-fallback kalau `DATABASE_URL`
kosong). Jadi platform mana pun yang membaca `Dockerfile` langsung jalan tanpa isi apa-apa:

### Railway (disarankan — paling sedikit klik)
1. New Project → Deploy from GitHub repo (atau upload folder ini via Railway CLI: `railway up`).
2. Railway otomatis mendeteksi `Dockerfile` + `railway.json` di repo ini — build, start
   command, dan health check (`/api/health`) sudah ditentukan di file itu. Tidak perlu isi field apa pun.
3. Selesai build, Railway kasih URL publik langsung jalan.

### Render
1. Dashboard → New → Blueprint → pilih repo ini.
2. Render membaca `render.yaml` yang sudah disertakan: otomatis `docker`, Dockerfile path,
   health check, dan `PORT=3000`. Klik Apply, tidak ada form manual.

### Fly.io
```bash
fly launch --now
```
`fly.toml` yang sudah disertakan mengisi semua konfigurasi (port, health check, region),
jadi `fly launch --now` langsung build dan deploy dari Dockerfile tanpa prompt interaktif.

### Docker manual / VPS sendiri
```bash
docker build -t copyweb .
docker run --rm -p 3000:3000 copyweb
```
Buka `http://localhost:3000`. Health check: `http://localhost:3000/api/health`.

## Kalau tetap mau Vercel

Harus lewat **Git import** atau **Vercel CLI** (`vercel --prod`), bukan drag-and-drop —
hanya dua jalur itu yang menjalankan build command dan men-deploy isi folder `api/` sebagai
Vercel Functions.

- Framework Preset: **Vite** (bukan "Other"/Static).
- Root directory: folder yang berisi `package.json` dan `vercel.json` ini.
- `vercel.json` sudah menunjuk `api/health.ts`, `api/crawl/index.ts`, `api/crawl/stream.ts`
  sebagai functions — jangan dihapus atau dipindah.
- Catatan: `/api/crawl/stream` pakai Server-Sent Events; di plan Vercel Hobby, function
  timeout dibatasi (default di `vercel.json` sudah diset 60s/1024MB, tapi hobby plan bisa
  memangkas ini). Untuk crawl situs besar/lama, Docker (Railway/Render/Fly) lebih stabil
  daripada Vercel Functions.
- Validasi: buka `/api/health` di domain Vercel — harus balas `{"status":"ok"}` sebelum
  crawler dicoba. Kalau itu juga gagal, berarti masih ke-deploy sebagai static (ulangi
  lewat Git import, bukan upload manual).

## Catatan umum

- Jangan pilih file `.ts` sebagai "entry page" di dashboard mana pun — platform harus
  menjalankan build command (`pnpm build`) lalu start command (`pnpm start` / `node dist/index.js`),
  bukan menyajikan file source-nya langsung.
- Input crawler menerima `example.com`, `example.com/docs`, `https://example.com`, dan
  `https://example.com/docs`.
