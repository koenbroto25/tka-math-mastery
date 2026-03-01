import { supabase } from './supabase.js';

// Cek apakah user sudah login. Jika iya, langsung lempar ke dashboard
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = '/dashboard.html';
  }
}
checkSession();

// Ambil elemen HTML
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authMessage = document.getElementById('authMessage');

// ==========================================
// FUNGSI REGISTER (DAFTAR)
// ==========================================
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault(); // Mencegah halaman reload
  const btn = document.getElementById('btnRegister');
  btn.innerText = 'Memproses...';
  btn.disabled = true;

  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const fullName = document.getElementById('regName').value;

  // Kirim data ke Supabase Auth
// Cari blok supabase.auth.signUp dan ubah menjadi seperti ini:
  const role = document.getElementById('regRole').value;
  const jenjang = document.getElementById('regJenjang').value;

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        nama_lengkap: fullName,
        role: role,
        jenjang: jenjang // Data ini akan ditangkap oleh SQL
      }
    }
  });

  if (error) {
    authMessage.innerHTML = `<span class="text-danger">${error.message}</span>`;
  } else {
    authMessage.innerHTML = `<span class="text-success">Pendaftaran berhasil! Silakan pindah ke tab Login.</span>`;
    registerForm.reset();
  }

  btn.innerText = 'Daftar Sekarang';
  btn.disabled = false;
});

// ==========================================
// FUNGSI LOGIN (MASUK)
// ==========================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnLogin');
  btn.innerText = 'Mengecek...';
  btn.disabled = true;

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    authMessage.innerHTML = `<span class="text-danger">Login gagal: ${error.message}</span>`;
    btn.innerText = 'Masuk';
    btn.disabled = false;
  } else {
    authMessage.innerHTML = `<span class="text-success">Login berhasil! Mengalihkan...</span>`;
    // Pindah ke dashboard setelah login sukses
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1000);
  }
});