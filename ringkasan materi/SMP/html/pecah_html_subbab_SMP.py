# ============================================================
# Script: pecah_html_subbab_SMP.py
# Tujuan: Memecah file HTML rangkuman TKA Matematika SMP
#         menjadi 17 file HTML terpisah per sub-bab
# Cara pakai: Jalankan di Command Prompt:
#             python pecah_html_subbab_SMP.py
# ============================================================

import os          # Library untuk manajemen folder dan path
import re          # Library untuk membersihkan karakter tidak valid pada nama file
from bs4 import BeautifulSoup  # Library untuk parsing HTML

# ── KONFIGURASI ───────────────────────────────────────────────
# Lokasi file HTML sumber (ubah path ini sesuai lokasi file kamu)
FILE_SUMBER = r"D:\Ebook-TKA\ringkasan materi\SMP\rangkuman materi tka matematika SMP.html"

# Folder tujuan tempat 17 file baru akan disimpan
FOLDER_TUJUAN = r"D:\Ebook-TKA\ringkasan materi\SMP\html"
# ──────────────────────────────────────────────────────────────

def bersihkan_nama_file(judul):
    """
    Mengubah judul sub-bab menjadi nama file yang aman untuk Windows.
    Contoh: '1.1 Sifat Bilangan' → '1.1_Sifat_Bilangan.html'
    """
    nama = judul.strip()                          # Hapus spasi di ujung kiri/kanan
    nama = nama.replace(" ", "_")                 # Ganti semua spasi dengan underscore
    nama = re.sub(r'[\\/:*?"<>|]', '', nama)      # Hapus karakter yang tidak boleh ada di nama file Windows
    nama = nama + ".html"                         # Tambahkan ekstensi .html
    return nama

def buat_html_standalone(judul, konten_html, nomor, total):
    """
    Membuat string HTML lengkap yang berdiri sendiri (standalone)
    untuk setiap sub-bab, lengkap dengan inline CSS agar mudah dibaca.
    """
    # Template HTML dengan CSS inline sederhana nan rapi
    template = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{judul} - TKA Matematika SMP</title>
    <style>
        /* CSS dasar agar mudah dibaca di browser */
        body {{
            font-family: 'Segoe UI', Arial, sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            line-height: 1.7;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            padding: 30px 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }}
        h1 {{
            font-size: 1.4rem;
            color: #6b7280;
            margin-bottom: 4px;
        }}
        h2.sub-chapter-title {{
            font-size: 2rem;
            color: #4f46e5;
            margin-top: 0;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 10px;
        }}
        .summary-box {{
            background: #eff6ff;
            border-left: 5px solid #3b82f6;
            border-radius: 8px;
            padding: 18px 22px;
            margin-bottom: 28px;
        }}
        .question-card {{
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 20px;
        }}
        .q-number {{
            display: inline-block;
            background: #4f46e5;
            color: white;
            font-weight: bold;
            border-radius: 6px;
            padding: 2px 12px;
            margin-bottom: 10px;
            font-size: 0.95rem;
        }}
        .fast-method {{
            background: #ecfdf5;
            border-left: 4px solid #10b981;
            border-radius: 6px;
            padding: 14px 18px;
            margin-top: 12px;
        }}
        .fast-method div {{
            margin-bottom: 6px;
        }}
        .step-label {{
            display: inline-block;
            background: #10b981;
            color: white;
            font-size: 0.8rem;
            font-weight: bold;
            border-radius: 4px;
            padding: 1px 8px;
            margin-right: 6px;
        }}
        .pro-tip {{
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            border-radius: 6px;
            padding: 12px 16px;
            margin-top: 10px;
            font-size: 0.92rem;
        }}
        .math-text {{
            font-family: 'Courier New', monospace;
            background: #e0e7ff;
            padding: 1px 5px;
            border-radius: 4px;
            font-weight: bold;
        }}
        .badge-nomor {{
            float: right;
            background: #e0e7ff;
            color: #4f46e5;
            font-size: 0.85rem;
            font-weight: bold;
            border-radius: 20px;
            padding: 4px 14px;
        }}
        /* CSS tambahan agar tabel (jika ada) tampil rapi */
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0;
        }}
        th, td {{
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
        }}
        th {{
            background: #e0e7ff;
            color: #4f46e5;
        }}
    </style>
</head>
<body>
    <div class="container">
        <span class="badge-nomor">Sub Bab {nomor} dari {total}</span>
        <h1>TKA Matematika SMP</h1>
        {konten_html}
        <br>
        <p style="color:#9ca3af; font-size:0.85rem; text-align:center; margin-top:30px;">
            📘 Materi ini merupakan bagian dari Rangkuman TKA Matematika SMP
        </p>
    </div>
</body>
</html>"""
    return template  # Kembalikan string HTML lengkap

def main():
    """Fungsi utama yang menjalankan seluruh proses pemecahan file."""

    print("=" * 60)
    print("  PEMECAH HTML - TKA MATEMATIKA SMP")
    print("  Script akan membuat 17 file HTML sub-bab")
    print("=" * 60)

    # ── LANGKAH 1: Baca file HTML sumber ──────────────────────
    print(f"\n📂 Membaca file sumber:\n   {FILE_SUMBER}")
    try:
        # Buka file dengan encoding UTF-8 agar karakter Indonesia terbaca benar
        with open(FILE_SUMBER, "r", encoding="utf-8") as f:
            isi_html = f.read()  # Baca seluruh isi file sebagai string
        print("✅ File berhasil dibaca.")
    except FileNotFoundError:
        # Tampilkan pesan error jika file tidak ditemukan di path yang ditentukan
        print(f"\n❌ ERROR: File tidak ditemukan di path:\n   {FILE_SUMBER}")
        print("   Pastikan nama file dan lokasi folder sudah benar, lalu coba lagi.")
        return  # Hentikan script jika file tidak ada

    # ── LANGKAH 2: Parse HTML dengan BeautifulSoup ────────────
    print("\n🔍 Mem-parsing struktur HTML...")
    soup = BeautifulSoup(isi_html, "html.parser")  # Buat objek parser HTML dari string
    print("✅ Parsing selesai.")

    # ── LANGKAH 3: Temukan semua div sub-bab ──────────────────
    # Setiap sub-bab dibungkus dalam <div class="chapter-card"> dengan id="sub1" dst.
    daftar_subbab = soup.find_all("div", class_="chapter-card")  # Cari semua div sub-bab
    jumlah = len(daftar_subbab)  # Hitung total sub-bab yang ditemukan

    print(f"\n📊 Ditemukan {jumlah} sub-bab dalam file.")

    if jumlah == 0:
        # Jika tidak ada sub-bab ditemukan, tampilkan pesan dan hentikan proses
        print("❌ Tidak ada sub-bab yang ditemukan. Periksa struktur HTML file sumber.")
        return

    # Informasikan jika jumlah berbeda dari yang diharapkan (17)
    if jumlah != 17:
        print(f"  ⚠️  Catatan: Jumlah sub-bab ditemukan ({jumlah}) berbeda dari target (17).")
        print(f"       Script tetap akan membuat {jumlah} file sesuai yang ditemukan.")

    # ── LANGKAH 4: Buat folder tujuan jika belum ada ──────────
    print(f"\n📁 Menyiapkan folder tujuan:\n   {FOLDER_TUJUAN}")
    os.makedirs(FOLDER_TUJUAN, exist_ok=True)  # Buat folder beserta parent-nya; abaikan jika sudah ada
    print("✅ Folder siap.")

    # ── LANGKAH 5: Loop setiap sub-bab dan buat file HTML ─────
    print("\n🚀 Memulai pembuatan file...\n")

    for nomor, div_subbab in enumerate(daftar_subbab, start=1):
        # Cari tag judul h2 di dalam div sub-bab yang sedang diproses
        tag_judul = div_subbab.find("h2", class_="sub-chapter-title")

        if tag_judul:
            # Ambil teks judul bersih dari tag h2 (tanpa tag HTML)
            judul_bersih = tag_judul.get_text(strip=True)
        else:
            # Jika tag h2 tidak ditemukan, gunakan nama default
            judul_bersih = f"Sub_Bab_{nomor}"
            print(f"  ⚠️  Sub-bab {nomor} tidak memiliki judul h2, menggunakan nama default.")

        # Ubah judul menjadi nama file yang aman untuk Windows
        nama_file = bersihkan_nama_file(judul_bersih)

        # Gabungkan path folder tujuan dengan nama file menggunakan os.path.join
        path_file = os.path.join(FOLDER_TUJUAN, nama_file)

        # Ambil seluruh konten HTML dari div sub-bab (termasuk semua tag di dalamnya)
        konten_subbab = str(div_subbab)

        # Bungkus konten dengan template HTML standalone lengkap dengan CSS
        html_final = buat_html_standalone(judul_bersih, konten_subbab, nomor, jumlah)

        # Tulis konten HTML final ke file baru dengan encoding UTF-8
        with open(path_file, "w", encoding="utf-8") as f_out:
            f_out.write(html_final)  # Simpan string HTML ke dalam file

        # Tampilkan konfirmasi proses di Command Prompt
        print(f"  ✅ [{nomor:02d}/{jumlah}] Berhasil membuat file: {nama_file}")

    # ── LANGKAH 6: Tampilkan ringkasan akhir ──────────────────
    print("\n" + "=" * 60)
    print(f"  🎉 SELESAI! {jumlah} file HTML berhasil dibuat.")
    print(f"  📂 Lokasi penyimpanan:")
    print(f"     {FOLDER_TUJUAN}")
    print("=" * 60)

# Jalankan fungsi main() hanya jika script dieksekusi langsung
# (bukan diimpor sebagai modul Python lain)
if __name__ == "__main__":
    main()
