# Baking Calculator Pro

Website statis untuk kalkulator HPP, database bahan, konversi ukuran loyang, konversi takaran dapur, scaling resep, import resep, buku resep, riwayat, dan backup/restore.

## Jalankan lokal
Buka `index.html` di browser. Untuk menguji PWA/service worker, gunakan local web server (misalnya VS Code Live Server).

## Deploy ke GitHub Pages
1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke branch `main` (pastikan `index.html` berada di root).
3. Buka **Settings → Pages**.
4. Pada Build and deployment, pilih **GitHub Actions**.
5. Workflow `.github/workflows/deploy.yml` akan deploy otomatis setiap push ke `main`.
6. Tunggu workflow selesai; URL website muncul pada Settings → Pages atau tab Actions.

## Catatan
- Data disimpan lokal di browser menggunakan LocalStorage. Data tidak tersinkron antarperangkat.
- Download backup JSON secara berkala.
- Import PDF berbasis teks, DOCX, XLSX/CSV, dan OCR gambar cetak menggunakan library CDN. Pemrosesan file dilakukan di browser; library CDN perlu diunduh saat pertama kali digunakan.
- OCR tulisan tangan tidak didukung. Hasil ekstraksi perlu diperiksa dan dikoreksi pengguna.
- Konversi sendok/cup merupakan estimasi per bahan. Konversi ml ke gram tidak universal; angka volume-ke-berat pada versi awal ini perlu diperlakukan sebagai perkiraan.
- Kalkulator HPP saat ini menghitung biaya otomatis untuk bahan yang terdaftar pada database. Bahan manual perlu dimasukkan ke database agar biaya terhitung.
- PWA cache dasar; library eksternal memerlukan koneksi internet pada penggunaan awal.
