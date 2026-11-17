# Baking Calculator Pro

Website statis untuk home baker dan bakery kecil. Tidak memerlukan akun, backend, atau database server.

## Fitur
- Kalkulator HPP per batch dan per potong, biaya tambahan, target margin, serta harga jual rekomendasi.
- Database bahan dengan harga kemasan, isi kemasan, dan satuan dasar (gram/ml/butir/pcs).
- Input bahan manual pada HPP dengan harga per satuan.
- Konversi loyang bulat ↔ kotak berdasarkan luas dasar; asumsi tinggi loyang sama.
- Konversi gram/kg, ml/liter, sdm/sdt/cup dengan estimasi densitas bahan.
- Scaling resep, buku resep, import resep dokumen/gambar cetak, riwayat, cetak/PDF, dan backup/restore JSON.
- PWA dasar untuk pemasangan ke layar utama dan cache app shell.

## Menjalankan lokal
Buka `index.html` untuk fitur utama. Untuk menguji PWA/service worker, jalankan melalui local web server (misalnya VS Code Live Server).

## Deploy ke GitHub Pages
1. Buat repository GitHub baru.
2. Upload **isi folder** ini ke root repository; `index.html` harus langsung berada di root.
3. Buka **Settings → Pages**.
4. Pilih **GitHub Actions** pada bagian Build and deployment.
5. Workflow `.github/workflows/deploy.yml` akan deploy otomatis setiap push ke branch `main`.

## Data dan privasi
- Data bahan, resep, dan riwayat disimpan di LocalStorage browser pada perangkat tersebut.
- Data tidak otomatis tersinkron antar-browser/perangkat. Unduh backup JSON secara berkala.
- Restore backup mengganti data lokal yang sedang tersimpan.
- File import diproses di browser. Library PDF/OCR/DOCX/XLSX dimuat dari CDN, sehingga fitur import memerlukan koneksi internet.
- OCR hanya untuk teks cetak, bukan tulisan tangan. Hasil ekstraksi harus diperiksa sebelum digunakan.

## Catatan akurasi
- HPP mengonversi kg↔gram dan liter↔ml. Konversi lintas kategori (misalnya gram ke ml) tidak dilakukan otomatis pada HPP karena membutuhkan densitas bahan.
- Konversi volume↔berat menggunakan estimasi densitas per bahan. Nilainya perkiraan, bukan standar laboratorium; hasil dipengaruhi merek dan cara mengisi sendok/cup.
- 1 sdm diasumsikan 15 ml, 1 sdt 5 ml, dan 1 cup 240 ml.
- Konversi loyang menggunakan rasio luas dasar dan mengasumsikan tinggi loyang sama. Jika tinggi berbeda, sesuaikan jumlah resep secara terpisah.
- Scaling resep dapat menghasilkan pecahan telur atau bahan satuan; pembulatan perlu ditentukan baker.

## Batasan versi ini
- Import PDF membaca teks yang tertanam; PDF hasil scan mungkin tidak terbaca sebagai teks. Gunakan JPG/PNG untuk OCR gambar cetak.
- Parser import mengenali format baris sederhana; tabel/format resep kompleks mungkin perlu diedit manual.
- PWA menyimpan app shell, tetapi library CDN untuk import belum disimpan offline.
- Website ini versi awal yang sudah ditingkatkan; lakukan uji hitung dan backup sebelum dipakai sebagai dasar harga jual komersial.
