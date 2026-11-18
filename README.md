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
- OCR bekerja optimal pada teks cetak atau screenshot digital yang jelas dan **belum mendukung tulisan tangan**.
- Library OCR/PDF/DOCX/XLSX dimuat gratis dari CDN secara *lazy-load* saat fitur import file digunakan (memerlukan koneksi internet; untuk offline gunakan fitur *Tempel Teks Langsung*).
- Data tersimpan secara lokal di `localStorage` browser perangkat Anda dan tidak dikirim ke server eksternal. Unduh backup JSON secara berkala.
