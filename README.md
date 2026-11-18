# Baking Calculator Pro

Versi **1.3.0** — oleh **Bang Doned**

Aplikasi web statis bergaya **Warm Modern** untuk home baker, UMKM kue, dan bakery kecil. Tidak memerlukan akun, backend, database server, maupun proses build.

## Fitur Utama

- **Dashboard**: Ringkasan resep, bahan baku, riwayat terbaru, resep terakhir digunakan, akses cepat, dan panduan singkat.
- **Buku Resep (Pusat Data)**: Tambah resep manual (`+ Tambah Resep`), edit tanpa mengganti ID, hapus dengan konfirmasi, cari, filter kategori, input bahan dinamis tanpa batas (desimal, pecahan `1/2`, `1/4`, `3/4`, satuan khusus, catatan opsional).
- **Smart Recipe Import & OCR**: Ekstrak nama resep dan daftar bahan otomatis dari foto/screenshot (OCR), PDF (multi-baris), DOCX, XLSX, CSV, atau teks tempel langsung. Hasil ekstraksi otomatis mengisi form Buku Resep yang sama dengan input manual; baris yang belum dikenali tetap ditampilkan untuk diperiksa manual tanpa pernah diisi nol.
- **Scaling Resep**: Hitung ulang takaran berdasarkan target hasil produksi tanpa mengubah resep asli; dapat disimpan sebagai resep baru atau langsung ke HPP/Riwayat.
- **Konversi Ukuran Loyang**: Khusus kue/bolu/sponge cake berbasis luas dasar loyang bulat (`(d₂/d₁)²`) atau persegi/persegi panjang (`L₂/L₁`) dengan peringatan penyesuaian suhu & waktu panggang.
- **Kalkulator HPP**: Terintegrasi dengan Buku Resep & Database Bahan Baku; konversi presisi (`kg↔gram`, `mg↔gram`, `liter↔ml`, `sdt/sdm/cup↔ml`), penandaan jelas bahan tanpa harga (tidak pernah dihitung Rp 0 diam-diam), simpan harga langsung ke Database Bahan, biaya tambahan, margin kustom, harga jual rekomendasi, dan cetak/PDF.
- **Database Bahan Baku**: CRUD bahan lengkap dengan kategori, harga beli, satuan pembelian, satuan penggunaan, konversi satuan, pencarian, dan peringatan duplikasi.
- **Konversi Satuan**: Mendukung `gram`, `kg`, `mg`, `ml`, `liter`, `sdt`, `sdm`, `cup`, `pcs`, `butir`. Konversi berat ↔ volume selalu memakai densitas bahan (tersedia 24+ bahan + input densitas manual).
- **Riwayat Perhitungan**: Mencatat HPP, Scaling, Konversi Loyang, dan Konversi Satuan; klik untuk melihat detail, hapus satuan atau semua dengan konfirmasi.
- **Backup & Restore JSON**: Ekspor bertanggal, validasi ketat saat impor, pilihan **Gabung (Merge)** atau **Timpa Semua (Replace)**, serta migrasi otomatis data lama (`v1` & `v2`).
- **PWA & Offline**: `manifest.json`, `service-worker.js` (*network-first* untuk file kode agar update GitHub Pages langsung tampil), ikon aplikasi di `assets/`.

## Struktur File

```text
├── index.html
├── styles.css
├── app.js
├── social-links.js          # Edit tautan media sosial Bang Doned di sini (Notepad++)
├── manifest.json
├── service-worker.js
├── sw.js                    # Stub pembersih cache SW versi lama
├── .nojekyll
├── .github/workflows/deploy.yml
├── assets/
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── js/
    ├── utils.js
    ├── storage.js
    ├── ingredient-database.js
    ├── recipe-book.js
    ├── recipe-import.js
    ├── recipe-scaling.js
    ├── pan-converter.js
    ├── hpp-calculator.js
    ├── unit-converter.js
    └── history.js
```

## Mengubah Tautan Media Sosial (Bang Doned)

Buka `social-links.js` menggunakan Notepad++ atau editor teks biasa, lalu isi URL lengkap (`https://...`) pada platform yang diinginkan. Platform yang dibiarkan kosong otomatis disembunyikan agar tidak menampilkan tautan kosong.

## Cara Menjalankan di Komputer Lokal

1. **Cara cepat**: Klik ganda `index.html` untuk membuka langsung di browser (fitur utama, penyimpanan lokal, dan kalkulator tetap berjalan penuh).
2. **Untuk menguji PWA / Service Worker**: Jalankan lewat local web server (mis. ekstensi *Live Server* di VS Code) dan buka `http://localhost:<port>/`.

## Cara Deploy ke GitHub Pages

1. Buat repository GitHub baru (mis. `baking-calculator-pro`).
2. Upload seluruh isi folder ini ke **root** repository (pastikan `index.html` berada di root dan branch utama bernama `main`).
3. Buka **Settings → Pages** pada repository GitHub Anda.
4. Pada bagian **Build and deployment → Source**, pilih **GitHub Actions**.
5. Workflow `.github/workflows/deploy.yml` akan otomatis mempublikasikan aplikasi setiap kali ada push ke branch `main`.
6. Semua path aset bersifat relatif (`./...`), sehingga langsung berfungsi baik di domain utama maupun subfolder repository (`https://<username>.github.io/<nama-repo>/`).

## Batasan & Catatan Akurasi

- OCR bekerja optimal pada teks cetak atau screenshot digital yang jelas dan **belum mendukung tulisan tangan**.
- Library OCR/PDF/DOCX/XLSX dimuat gratis dari CDN secara *lazy-load* saat fitur import file digunakan (memerlukan koneksi internet; untuk offline gunakan fitur *Tempel Teks Langsung*).
- Data tersimpan secara lokal di `localStorage` browser perangkat Anda dan tidak dikirim ke server eksternal. Unduh backup JSON secara berkala.
