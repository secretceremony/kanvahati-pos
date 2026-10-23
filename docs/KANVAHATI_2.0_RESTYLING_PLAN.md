# Rencana Implementasi: Re-styling Tema Kanvahati POS (Kanvahati 2.0)

Dokumen spesifikasi desain menyeluruh untuk Kanvahati POS dengan tema **Retro Pastel OS + Sticker Neobrutalism (Opsi B)**.

---

## 1. Sistem Warna & Token Desain (Sesuai `color palette.png`)

### A. Palet Warna Inti (`src/index.css` via Tailwind `@theme`)
- **Teks, Border, & Drop-Shadow**: `#181818` (Jet Black neobrutalisme kontras tinggi).
- **Latar Card & Kontainer**: `#FFFFFF` (Putih bersih).
- **Latar Belakang Global Base**: `#FFFDF7` / `#FFFDF9` (Krem hangat).
- **Aksen Pastel Kuning (Jasmine)**: `#FDE29A` (Light: `#FFF9E6`) — Navigasi aktif, highlight, dot tengah window.
- **Aksen Pastel Pink (Carnation)**: `#FA8EC0` (Light: `#FDE8F3`) — Tombol CTA aksi utama, badge diskon/promo, dot kiri window.
- **Aksen Pastel Biru (Sky Blue)**: `#7DB2E9` (Light: `#EBF4FC`) — Title bar Retro OS, header kolom, variasi produk, dot kanan window.

### B. Hard Shadow & Stroke Neobrutalisme
- Button Shadow: `3px 3px 0px #181818`
- Card Container Shadow: `4px 4px 0px #181818` s.d. `5px 5px 0px #181818`
- Window Border: `2.5px solid #181818`
- Button / Input Border: `2px solid #181818`

---

## 2. Tipografi 3-Peran (Opsi B: Y2K Sticker Pop)

1. **`--font-title` (DynaPuff)**:
   - Digunakan untuk: Judul halaman, logo teks Kanvahati, nama produk utama, header modal, tombol CTA utama, dan window bar title.
   - Sifat: Bubbly, melengkung tebal, kartun retro pop.
2. **`--font-body` (Fredoka)**:
   - Digunakan untuk: Isi teks, deskripsi bantuan, angka harga IDR, nominal rupiah kasir, input placeholder.
   - Sifat: Rounded geometric, keterbacaan tinggi untuk operasional kasir.
3. **`--font-tag` (Plus Jakarta Sans, Weight 800/900)**:
   - Digunakan untuk: Badge SKU, label stiker potong, status transaksi, chip role (`SUPER ADMIN`, `USER`), tab filter, tag promo (`SALE!`, `#OFFICIAL POS`, `★ KANVAHATI`).
   - Sifat: Uppercase bold/extrabold, tegas dan presisi seperti stiker die-cut Y2K.

---

## 3. Karakteristik Komponen Visual Utama

### A. Background Halftone Polka-Dot Grid
- Menggantikan gradien ungu lama.
- Pola titik teratur radial-gradient halus (`#E8DFD0` 1.5px, grid interval 20px) di atas latar dasar krem `#FFFDF9`.

### B. Retro OS Window Container
Semua kontainer modul utama (Katalog, Keranjang, Tabel Stok, Riwayat, Admin Hub, Rekapan) menggunakan frame Retro OS:
- **Title Bar**: Tinggi ~32px, warna dasar `#7DB2E9` atau `#FDE29A`, border bawah `2px solid #181818`.
- **Window Controls (3 Bulatan OS)**:
  - Bulat 1 (Kiri): Pink `#FA8EC0`
  - Bulat 2 (Tengah): Kuning `#FDE29A`
  - Bulat 3 (Kanan): Biru `#7DB2E9`
- **Body Window**: Latar putih, border keliling `2.5px solid #181818`, rounded 16px (`rounded-2xl`).

### C. Komponen Interaktif & Tombol
- **Tombol Utama (CTA Bayar / Simpan / Tambah)**:
  - Background `#FA8EC0` (Pink), font `DynaPuff`, border `2.5px solid #181818`, teks `#181818`.
  - Animasi tekan tactile: Saat ditekan bergeser `translate-y-[2px]` dengan bayangan hilang.
- **Tab & Filter**:
  - Tombol filter aktif menggunakan `#FDE29A` (Kuning) dengan hard-shadow `1.5px 1.5px 0px #181818`.
  - Filter kategori pada mobile mendukung horizontal scroll lancar (`scrollbar-none`).
- **Input Field**:
  - Border tebal `2px solid #181818`, font `Fredoka`, focus background `#FFFDF7`.

### D. Die-Cut Sticker Tags
- Komponen chip badge dibuat menyerupai stiker potong dengan hard offset shadow `2px 2px 0px #181818`.

---

## 4. Cakupan Halaman & Komponen (Full Web & Mobile)

1. **Struktur Shell (`src/App.jsx`)**:
   - Sidebar navigasi berkategori:
     - Kasir (Terminal POS)
     - User / Kasir (Buka/Tutup Kas, identitas kasir)
     - Laporan Penjualan (Dropdown: Riwayat Transaksi, Statistik Performa, Rekapan Omset)
     - Arcade Zone (Host Console & Bank Soal)
     - Super Admin Hub (Khusus `super_admin`)
   - Header top bar responsif dengan badge role dan chip User.
2. **Katalog & Keranjang (`src/pages/Register.jsx`)**:
   - Grid 2-kolom mobile/desktop, tombol toggle tab mobile bersih dari karakter rusak, filter kategori scrollable.
3. **Riwayat Transaksi (`src/pages/Logs.jsx`)**:
   - Mode tabel untuk layar desktop, card vertikal individual untuk mobile, struk thermal effect.
4. **Inventaris / Stok (`src/pages/Inventory.jsx`)**:
   - Retro window katalog stok, modal restock dan edit produk.
5. **Super Admin Hub (`src/pages/SuperAdminHub.jsx`)**:
   - Layout grid 1:2 (Form akun staf di kiri, tabel staf & audit log di kanan).
6. **Laporan & Rekapan (`src/pages/Stats.jsx`, `src/pages/Rekapan.jsx`)**:
   - Rekap omset per hari/minggu/bulan dengan ekspor file Excel (.xlsx).
7. **Bundle Promo & Kasir (`src/pages/Bundles.jsx`, `src/pages/CashDrawer.jsx`)**.
8. **Otentikasi & Arcade (`src/pages/Login.jsx`, `src/arcade/*`)**.

---

## 5. Batasan & Aturan Keamanan Sistem

1. **Integritas Logic & RBAC**:
   - Tidak mengubah kalkulasi harga, diskon bundle, rumus keranjang, maupun logika Firestore.
   - Hak Super Admin (`neptuniistars@gmail.com`, `ansellmatita@gmail.com`) dan Admin Kasir (`jun`, `shu`, `rara`) tetap terikat pada Firestore `staff_roles` dan `firestore.rules`.
2. **Standard Verifikasi Kualitas**:
   - 97 Unit Test wajib passing (`npm test`).
   - Production bundle wajib lolos compile (`npm run build`).
   - Audit visual headless browser via Camoufox pada viewport desktop (1440x900) dan mobile (390x844).
