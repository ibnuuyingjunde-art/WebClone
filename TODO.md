# CopyWeb Studio — Outcome

## Dashboard crawl dengan validasi dan status proses
- [x] Pengguna dapat memasukkan URL target publik.
- [x] Sistem memvalidasi URL tidak valid sebelum crawl.
- [x] UI menampilkan status bertahap untuk validasi, discovery, source map, dan packaging.
- [x] Catatan penggunaan bertanggung jawab menyatakan pengguna hanya boleh mengarsipkan atau menganalisis website yang dimiliki atau telah mendapat izin.

## Penangkapan semua format file dan inline code
- [x] Sistem menemukan HTML, CSS, JavaScript, inline style/script, PNG, JPG/JPEG, WebP, SVG, JSON, webmanifest, WOFF2, TTF, dan asset publik lain yang dirujuk.
- [x] Sistem menampilkan status akses per resource dan melaporkan CORS, timeout, asset tidak dapat diakses, nonpublik, serta batas ukuran secara jelas.
- [x] Sistem menghormati batas jumlah file, ukuran respons, dan waktu crawl.

## Source map recovery dan struktur folder
- [x] Sistem mendeteksi source map JavaScript.
- [x] Sistem memulihkan sumber `.ts`, `.tsx`, dan `.vue` dari Source Map v3 ketika `sourcesContent` tersedia.
- [x] Hasil disusun dalam hirarki direktori terorganisir yang dapat ditelusuri.
- [x] Statistik jumlah file, total ukuran, format, dan jumlah source map terlihat.

## Workspace inspeksi file
- [x] Pengguna dapat memilih folder/file dari tree.
- [x] Code viewer menampilkan nomor baris dan isi kode.
- [x] Gambar memiliki preview visual; file font/data memiliki metadata dan fallback viewer yang sesuai.
- [x] Metadata menampilkan MIME type, ukuran, URL asal, status, dan catatan source map bila relevan.

## Paket ZIP satu klik
- [x] Tombol unduh membuat atau mengunduh satu paket ZIP setelah crawl selesai.
- [x] ZIP mempertahankan hirarki folder hasil arsip.
- [x] Empty/error state tidak mengklaim paket tersedia sebelum crawl selesai.

## Kualitas dan delivery
- [x] `pnpm check` lulus.
- [x] `pnpm build` lulus.
- [x] `/manus-routes.json` mendeklarasikan route dashboard dan disajikan sebagai JSON nyata.

## Real-only archive controls
- [x] State awal tidak lagi memuat demo archive; hasil hanya muncul setelah URL publik benar-benar dicrawl.
- [x] Pengguna dapat menyalin kode/file text dari viewer.
- [x] Pengguna dapat mengunduh file individual yang berhasil diambil.
- [x] Pengguna dapat membuka local reconstruction preview dari HTML dan aset yang berhasil diambil.
- [x] Error resource tetap terlihat sebagai item `ERROR` di file tree dan inspector.

## Security boundary
- [x] Aplikasi tidak mencoba mengambil `.env`, token, cookie, private GitHub credentials, server-side source, atau resource di private network.
- [x] UI menjelaskan bahwa preview adalah snapshot lokal dari resource publik, bukan runtime server asli.

## Multi-page crawl and live progress
- [x] Link HTML satu origin seperti `/docs`, `/app`, dan path lain yang ditemukan dimasukkan ke queue crawl sampai batas maksimum.
- [x] Endpoint SSE mengirim progress `validating`, `discovering`, `mapping`, dan `packaging`.
- [x] File tree menerima file/error satu per satu selama proses, bukan menunggu hasil final.
- [x] Route `/docs` terdaftar di manifest dan memiliki halaman dokumentasi nyata.
- [x] Metadata Open Graph, Twitter card, deskripsi, dan gambar SVG preview tersedia.
- [x] Identitas pencipta lianix/yungtg, GitHub, dan tiga tautan Telegram ditampilkan di docs.

## Deployment and ZIP validation
- [x] `pnpm check`, `pnpm build`, dan seluruh test Vitest lulus.
- [x] Server hasil build production berhasil start pada port uji.
- [x] `/api/health` merespons 200 dan `/docs` merespons 200 pada production build.
- [x] SSE crawl menghasilkan progress event dan complete event pada production build.
- [x] ZIP hasil crawl root lulus `unzip -t` tanpa error.
- [x] ZIP target `/docs` mempertahankan path `docs`, lulus `unzip -t`, dan tidak memiliki duplicate entry.
- [x] Path arsip dibuat unik untuk mencegah benturan halaman, inline file, error file, dan source map.
