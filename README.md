# ⏱️ Time Sync - Accurate NTP Clock

![Version](https://img.shields.io/badge/version-1.2.4-blue.svg)
![Platform](https://img.shields.io/badge/platform-Firefox-FF7139?logo=firefox)
![License](https://img.shields.io/badge/license-MIT-green.svg)

> **Validasi waktu yang presisi untuk setiap tangkapan layar Anda.**

Sering ragu apakah _timestamp_ di _screenshot_ Anda sudah valid? **Time Sync** adalah ekstensi Firefox ringan yang menyinkronkan waktu lokal komputer Anda dengan server NTP (_Network Time Protocol_) global secara _real-time_.

Alat ini sangat cocok digunakan untuk memastikan keabsahan waktu pada dokumentasi laporan administratif (seperti penyusunan bukti Aktualisasi/Latsar), investigasi OSINT (_Open-Source Intelligence_), forensik digital, atau sekadar pengujian sistem yang sensitif terhadap waktu.

---

## ✨ Fitur Unggulan

- 🌍 **Multi-Server API:** Mengambil data waktu dengan presisi tinggi dari _provider_ tepercaya (WorldTimeAPI, NIST, Google, dan TimeAPI.io).
- 📌 **Floating Window (Detach mode):** Lepas panel ekstensi menjadi jendela melayang yang praktis. Sangat mudah disandingkan di pojok layar saat Anda bersiap mengambil _screenshot_.
- 🔒 **Smart Resize Lock:** Jendela _floating_ akan selalu mengunci pada ukuran proporsional yang rapi. Tidak perlu khawatir jendela tidak sengaja membesar atau merusak estetika _screenshot_.
- ⚡ **Cerdas Membaca Latensi:** Dilengkapi dengan indikator warna (_diff_) yang menoleransi _Round-Trip Time_ (RTT) jaringan internet Anda.

---

## 🚀 Cara Pemasangan (Mode Developer)

Saat ini ekstensi berada dalam tahap pengujian (_development_). Ikuti langkah singkat ini untuk memasangnya di Firefox Anda:

1. Unduh atau _clone_ _repository_ ini ke komputer Anda.
2. Buka Firefox dan ketik `about:debugging#/runtime/this-firefox` di kolom URL.
3. Klik tombol **Load Temporary Add-on...**
4. Arahkan ke folder proyek ini, lalu pilih file `manifest.json`.
5. _Voila!_ 🎉 Ikon ekstensi Time Sync kini sudah terpasang di _toolbar_ kanan atas Anda.

---

## 📖 Panduan Penggunaan

1. **Buka Ekstensi:** Klik ikon **Time Sync** di _toolbar_.
2. **Pantau Waktu:** Anda akan melihat **Server Time (UTC)** bersanding dengan **Local PC Time** (menyesuaikan zona waktu lokal Anda, misalnya GMT+7).
3. **Sinkronisasi:** Klik tombol **Sync Now** untuk menyamakan waktu secara manual, atau gunakan fitur **Auto Sync**.
4. **Mode Tangkapan Layar:** Klik **Detach** untuk mengubahnya menjadi jendela kecil melayang. Posisikan di dekat area yang ingin Anda potret.

---

## 🚦 Membaca Indikator Status

Jangan biarkan latensi internet merusak validasi Anda! Ekstensi ini memberi tahu Anda kapan waktu terbaik untuk mengambil _screenshot_:

- 🟢 **`● Synced Perfectly` (Selisih ≤ 1.0s):** Waktu sangat akurat. Kondisi paling ideal untuk dokumentasi.
- 🔵 **`● Acceptable` (Selisih 1.0s - 3.0s):** Waktu masih valid, selisih murni disebabkan oleh jeda jaringan.
- 🟠 **`● Time Late` (Selisih > 3.0s):** Ada _delay_ dari server. Sebaiknya klik _Sync Now_ sekali lagi sebelum mengambil gambar.

---

## ⚙️ Pengaturan Tambahan

Anda memegang kendali penuh. Masuk ke menu **Settings** untuk:

- Mengganti alamat server NTP secara manual (Tersedia opsi instan: `pool.ntp.org`, `time.google.com`, `time.nist.gov`).
- Mengatur interval _Auto Sync_ (Minimal 10 detik).
- Mengaktifkan/menonaktifkan _Resize Lock_ (Izinkan _Fullscreen_).

---

_Dibuat untuk memastikan setiap detik dokumentasi Anda dapat dipertanggungjawabkan._
