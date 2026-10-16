# Rencana CopyWeb Studio

## Ruang lingkup implementasi
CopyWeb Studio adalah dashboard web terkelola untuk mengarsipkan website publik berdasarkan URL. Frontend React menampilkan alur ingest, statistik, pohon folder, daftar file, viewer kode bernomor baris, preview gambar, metadata, dan tombol unduh ZIP. Backend Express menyediakan `/api/health` serta endpoint `/api/crawl` yang mengambil URL target secara server-side, membatasi ukuran/waktu, menemukan HTML/CSS/JS dan asset publik, mendeteksi source map, memulihkan sourcesContent `.ts/.tsx/.vue`, lalu mengembalikan paket hasil dalam memori sebagai JSON dengan data URI dan ZIP base64. Implementasi tidak menyimpan data permanen karena database tidak dibutuhkan.

URL akan dinormalisasi dan hanya skema `http`/`https` yang diizinkan. Crawler memproses halaman utama dan asset yang dirujuk langsung, menjaga host/origin yang relevan, menghindari private-network target, membatasi jumlah file serta ukuran respons, dan mencatat status/penyebab kegagalan per resource. HTML dipindai untuk `src`, `href`, `srcset`, inline `<style>` dan `<script>`, serta komentar `sourceMappingURL`; CSS dan JS dipindai untuk URL asset dan source map. Source map v3 diparse dari JSON dan seluruh `sourcesContent` yang tersedia ditulis ke struktur folder hasil. ZIP writer kecil berbasis Node built-in dipakai agar tidak menambah dependency baru.

## Struktur project
- `client/src/pages/Home.tsx`: dashboard utama dan state interaksi.
- `client/src/index.css`: sistem visual gelap, panel, tabel, viewer dan responsive behavior.
- `server/crawler.ts`: validasi URL, fetch dengan timeout/limit, discovery asset, source map extraction, ZIP generation.
- `server/_core/index.ts`: route Express `/api/crawl` dan wiring existing server.
- `public/manus-routes.json`: manifest route dashboard.
- `TODO.md`: outcome dan acceptance scope.

## Desain

### Kandidat gaya
- **Terminal editorial / developer console** — probabilitas 0.04: dashboard gelap dengan panel tegas, label teknis, dan aksen lime.
- **Soft SaaS workspace** — probabilitas 0.07: kanvas terang dengan kartu pastel dan grafik ringan.
- **Neo-brutalist lab** — probabilitas 0.03: bidang kontras, border hitam, dan tombol oversized.

### Gaya terpilih: Terminal editorial / developer console
- **Design Movement**: terminal editorial modern yang memadukan inspeksi source-code dengan layout jurnal teknis.
- **Core Principles**: information-dense but legible; hierarchy through monospaced labels; honest progress and errors; restrained motion.
- **Color Philosophy**: charcoal blue-black memberi rasa alat kerja yang serius; off-white menjaga teks panjang tetap nyaman; acid lime menjadi signature state/action color, bukan dekorasi.
- **Layout Paradigm**: header tipis, hero asimetris dengan rail metadata di kanan, lalu workspace split-pane yang mendahulukan pohon folder dan preview file.
- **Signature Elements**: micro-label uppercase, status dots seperti terminal, dan garis grid tipis yang hanya muncul sebagai latar panel.
- **Interaction Philosophy**: setiap klik memperlihatkan status konkret; selection selalu terasa seperti cursor aktif; error menjelaskan apa yang bisa dilakukan berikutnya.
- **Animation**: fade/slide ringan 160–220ms, shimmer hanya pada progress crawl, tidak memakai animasi dekoratif yang mengganggu viewer kode.
- **Typography System**: Space Grotesk untuk headline/UI, IBM Plex Mono untuk path, statistik, code, dan metadata.
- **Brand Essence**: "The fast lane from URL to inspectable source" untuk developer dan auditor yang perlu memahami aset publik secara cepat; precise, transparent, capable.
- **Brand Voice**: singkat, teknis, tidak hiperbolis. Contoh: “Paste a public URL. See the whole tree.” dan “Maps found? We’ll surface the source.”
- **Wordmark & Logo**: simbol kurung siku `<>` yang dipotong garis vertikal seperti cursor, dipasangkan dengan wordmark COPYWEB.
- **Signature Brand Color**: acid lime `#C8F169`, dipakai untuk tombol utama, selection, dan status sukses.

## Batasan dan trade-off
- Hanya resource publik yang dapat diakses server; login/paywall, robots/auth, CORS upstream, timeout, private network, dan asset terlalu besar akan dilaporkan, bukan dipaksa.
- Source map hanya dapat memulihkan `sourcesContent` atau sumber yang masih publik; UI membedakan “recovered” dan “map unavailable”.
- ZIP dibuat dari hasil crawl saat ini dan diunduh dari browser; belum ada retensi permanen.
- Pengguna diingatkan untuk hanya menyalin website yang dimiliki atau telah mendapat izin.

## Pembaruan real-only
State awal dashboard tidak lagi berisi data demo. Hasil hanya dibuat setelah endpoint crawl menerima URL publik dan mengembalikan payload nyata. Workspace menampilkan item error secara eksplisit, menyediakan salin kode serta download individual, dan membuat preview snapshot lokal dari HTML + aset yang berhasil diambil melalui `iframe sandbox`. Preview diberi label sebagai rekonstruksi lokal karena tidak dapat menjalankan route server privat, login, API internal, env, token, atau credential.

## Pembaruan multi-page dan dokumentasi
Crawl sekarang memakai SSE agar dashboard menerima setiap ArchiveFile saat diproses. Discovery tetap mengikuti seluruh URL HTTP satu origin yang ditemukan dari HTML/CSS, termasuk route tanpa ekstensi seperti `/docs` dan `/app`, dengan batas maksimum untuk mencegah crawl tak terbatas. Halaman `/docs` ditambahkan ke router dan route manifest, dilengkapi metadata Open Graph/Twitter serta identitas pencipta dan tautan sosial.
