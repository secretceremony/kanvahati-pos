# 🌸 Kanvahati POS (Point of Sale)

[![React](https://img.shields.io/badge/React-19.0-blue.svg?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-10.0-FFCA28.svg?logo=firebase&logoColor=black)](https://firebase.google.com/)

**Kanvahati POS** adalah terminal kasir modern yang dirancang khusus dengan estetika *Neobrutalism* yang lucu, interaktif, dan penuh warna. Aplikasi ini dirancang untuk menyederhanakan transaksi toko ritel, melacak stok barang secara real-time, mengelola modal kas harian, serta menampilkan analitik penjualan yang informatif.

Aplikasi ini menggunakan **React 19**, **Tailwind CSS v4**, dan **Firebase** (Authentication & Firestore) untuk performa cepat, sinkronisasi data real-time, serta keamanan data kasir.

---

## ✨ Fitur Utama

- 🛒 **Terminal Kasir (Register)**: Keranjang belanja interaktif, validasi limit stok produk, kalkulator pajak otomatis, serta metode pembayaran **Tunai** dan **QRIS** (dilengkapi generator QR dinamis).
- 🧾 **Struk Belanja Digital**: Cetak struk cantik dengan kustomisasi nama kasir menggunakan modal interaktif.
- 💰 **Akun Kasir & Modal (Cash Drawer)**: Lacak modal awal kasir, pencatatan transaksi kas masuk/keluar, dan penyesuaian saldo kasir per shift.
- 📦 **Manajemen Stok (Inventory)**: Kelola katalog produk (tambah, edit, hapus), pantau stok kritis, dan filter produk berdasarkan kategori/kode barang.
- 📊 **Statistik & Laporan**: Visualisasi analitik pendapatan harian, jumlah pesanan, produk terlaris, serta distribusi kategori produk.
- 🕒 **Riwayat Transaksi (Logs)**: Daftar lengkap transaksi masa lalu lengkap dengan pencarian, filter, detail item, dan opsi cetak ulang (*reprint*) struk.
- 🔐 **Autentikasi Aman**: Didukung oleh **Firebase Authentication** untuk mengamankan akses terminal dari pihak yang tidak berwenang.

---

## 🎨 Desain & Estetika

Aplikasi ini didesain dengan konsep **Playful Neobrutalism**:
- Sudut rounded yang tegas (`rounded-2xl`, `rounded-full`).
- Warna pastel yang kontras dan menyenangkan (*Pink, Yellow, Blue Light*).
- Garis tepi tebal berwarna gelap dengan efek bayangan retro (*Drop Shadows* / *Retro Borders*).
- Animasi mikro yang halus untuk meningkatkan interaktivitas kasir.

---

## ⚙️ Persyaratan Sistem

Pastikan Anda memiliki tools berikut sebelum memulai instalasi:
- [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan)
- [npm](https://www.npmjs.com/) atau [bun](https://bun.sh/)
- Akun Firebase (untuk database dan autentikasi)

---

## 🚀 Cara Instalasi dan Menjalankan Aplikasi

### 1. Klon Repositori
```bash
git clone https://github.com/username/kanvahati-pos.git
cd kanvahati-pos
```

### 2. Instal Dependensi
Anda dapat menggunakan npm atau bun:
```bash
npm install
# atau jika menggunakan bun
bun install
```

### 3. Konfigurasi Firebase & Environment Variables
Buat berkas `.env` di direktori utama (*root*) proyek dan masukkan konfigurasi Firebase Anda:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Jalankan Server Dev Lokal
```bash
npm run dev
# atau jika menggunakan bun
bun dev
```
Aplikasi akan berjalan di `http://localhost:5173`.

---

## 🔒 Konfigurasi Firebase Authentication

Untuk mengaktifkan fitur login pada terminal kasir:
1. Masuk ke [Firebase Console](https://console.firebase.google.com/).
2. Pilih proyek Firebase Anda (`kanvahati-pos`).
3. Buka menu **Authentication** di panel samping kiri.
4. Di tab **Sign-in method**, aktifkan penyedia **Email/Password**.
5. Buka tab **Users**, klik **Add User**, lalu masukkan email dan password terdaftar untuk akun kasir Anda (misalnya: `folks@itk.ac.id` dengan kata sandi pilihan Anda).

---

## 📂 Struktur Folder Proyek

```text
kanvahati-pos/
├── public/                 # Aset statis (logo, ikon, gambar)
├── src/
│   ├── components/         # Komponen UI global (ReceiptModal.jsx, dll.)
│   ├── pages/              # Halaman rute utama
│   │   ├── CashDrawer.jsx  # Halaman modal kas & pembukuan kasir
│   │   ├── Inventory.jsx   # Pengelolaan produk & stok barang
│   │   ├── Login.jsx       # Layar autentikasi kasir
│   │   ├── Logs.jsx        # Riwayat transaksi POS
│   │   ├── Register.jsx    # Terminal pembayaran & keranjang belanja
│   │   └── Stats.jsx       # Laporan & grafik statistik penjualan
│   ├── services/
│   │   ├── db.js           # Query Firestore untuk inventaris & transaksi
│   │   └── translations.js # Kamus bahasa Indonesia lokal untuk POS
│   ├── App.jsx             # Rute dan manajemen state otorisasi utama
│   ├── firebase.js         # Konfigurasi & Inisialisasi Firebase SDK
│   ├── index.css           # Integrasi Tailwind CSS v4 & custom variables
│   └── main.jsx            # Entry point aplikasi React
├── .env                    # Variabel konfigurasi Firebase (diabaikan oleh git)
├── eslint.config.js        # Konfigurasi ESLint untuk standarisasi kode
├── package.json            # Daftar pustaka dependensi & skrip npm
└── vite.config.js          # Konfigurasi Vite bundler
```

---

## 🛠️ Tech Stack Lainnya

- **React Router Dom (v7)**: Manajemen navigasi antar halaman yang cepat secara Client-side.
- **FontAwesome**: Pustaka ikon grafis berkualitas untuk antarmuka terminal kasir.
- **Firebase Firestore**: Database real-time NoSQL untuk menyimpan transaksi harian dan data inventaris secara instan.

---

## 🤝 Kontribusi

Kontribusi selalu diterima hangat! Jika Anda ingin meningkatkan antarmuka, menambah fitur baru, atau membenahi bug:
1. *Fork* repositori ini.
2. Buat branch fitur baru (`git checkout -b fitur/fitur-baru`).
3. Lakukan commit pada perubahan Anda (`git commit -m 'Menambahkan fitur baru yang keren'`).
4. *Push* ke branch Anda (`git push origin fitur/fitur-baru`).
5. Kirimkan *Pull Request* (PR).

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi MIT. Silakan gunakan dan kembangkan sesuai kebutuhan toko Anda!
🌸 *Kanvahati POS - Designed for folks.*
