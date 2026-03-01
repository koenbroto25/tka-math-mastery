import { supabase } from './supabase.js';

let currentUser = null;
const TARGET_SHARES = 5;

// 1. Copywriting Baru yang Sangat Menarik untuk Facebook/WA
const shareMessage = `🚀 Ayah Bunda, si kecil lagi pusing belajar Matematika?

Saya baru nemu rahasianya! Pakai aplikasi *TKA Math Mastery*, anak-anak diajarin "Jurus Cepat" dan sistemnya seru banget kayak main game (ada Boss Battle, XP & Level).

Yg paling saya suka, kita bisa pantau rapor dan nilai anak langsung dari HP kita secara real-time! 📊

Mumpung aksesnya masih GRATIS, yuk daftarkan pahlawan kecil kita sekarang di:
👉 https://tkamath.com`;

async function checkAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!session || error) {
    window.location.href = '/auth.html';
    return;
  }
  currentUser = session.user;
  loadUserProfile(currentUser.id);
}

async function loadUserProfile(userId) {
  try {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); 

    if (error) throw error;

    if (!profile) {
        console.log("Menunggu data profil...");
        setTimeout(() => loadUserProfile(userId), 1000);
        return; 
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.innerText = profile.nama_lengkap;

    const simRole = sessionStorage.getItem('god_mode_role');
    const simJenjang = sessionStorage.getItem('god_mode_jenjang');
    let activeRole = profile.role;

    if (profile.role === 'admin' && simRole) {
        console.log("⚡ GOD MODE ACTIVE: Simulating role", simRole);
        activeRole = simRole;
        showAdminSimulationBadge();
    }

    if (activeRole === 'student') {
        // GOD MODE: Inject Simulated Jenjang if Admin
        const effectiveJenjang = (profile.role === 'admin' && simRole === 'student') 
            ? (simJenjang || 'SD') 
            : profile.jenjang;

        aturDashboardSiswa({ ...profile, role: activeRole, jenjang: effectiveJenjang });
    } else if (activeRole === 'parent') {
        aturDashboardOrtu({ ...profile, role: activeRole });
    } else if (activeRole === 'admin' && !sessionStorage.getItem('god_mode_role')) {
        // SECURITY: Admin access from public dashboard is now limited.
        // They must use the hidden grandmaster-portal.html for full access.
        aturDashboardAdmin(profile);
    } else if (activeRole === 'teacher') {
        aturDashboardGuru(profile);
    }

  } catch (err) {
    console.error("Gagal memuat profil:", err.message);
  }
}

// ==========================================
// 3. FUNGSI KHUSUS SISWA
// ==========================================
async function aturDashboardSiswa(profile) {
    const navTitle = document.getElementById('navTitle');
    const avatarIcon = document.getElementById('avatarIcon');
    const userRoleText = document.getElementById('userRoleText');
    const userLevel = document.getElementById('userLevel');
    const userXP = document.getElementById('userXP');
    const userHearts = document.getElementById('userHearts');
    const pairingCode = document.getElementById('pairingCode');

    if (navTitle) navTitle.innerText = "🗺️ Peta Petualangan";
    if (avatarIcon) avatarIcon.innerText = profile.jenjang === 'SD' ? "👦" : "🦸‍♂️";
    if (userRoleText) userRoleText.innerText = `Pahlawan Matematika ${profile.jenjang || ''}`;
    
    const statsSiswa = document.getElementById('statsSiswa');
    if (statsSiswa) {
        statsSiswa.classList.remove('d-none');
        statsSiswa.classList.add('d-flex');
    }
    const panelStudent = document.getElementById('panelStudent');
    if (panelStudent) panelStudent.classList.remove('d-none');
    
    if (userLevel) userLevel.innerText = profile.level || 1;
    if (userXP) userXP.innerText = profile.xp_total || 0;
    if (userHearts) userHearts.innerText = profile.hearts !== undefined ? profile.hearts : 5;
    if (pairingCode) pairingCode.innerText = profile.pairing_code || "KODE-BARU";

    const judulDunia = document.getElementById('judulDunia');
    const mapSD = document.getElementById('mapSD');
    const mapSMP = document.getElementById('mapSMP');

    if (profile.jenjang === 'SD') {
        if (judulDunia) judulDunia.innerText = "Dunia 1: Hutan Angka (SD)";
        if (mapSD) mapSD.classList.remove('d-none');
        await syncMapLocks(profile.id, 'SD');
    } else if (profile.jenjang === 'SMP') {
        if (judulDunia) judulDunia.innerText = "Zona 1: Kota Aljabar (SMP)";
        if (mapSMP) mapSMP.classList.remove('d-none');
        document.body.style.backgroundColor = "#e0f2fe";
        await syncMapLocks(profile.id, 'SMP');
    }

    if (profile.hearts === 0) {
        const heartPanel = document.getElementById('heartRecoveryPanel');
        if (heartPanel) heartPanel.classList.remove('d-none');
    }

    const hasSharedKey = `has_shared_parent_${currentUser.id}`;
    if(localStorage.getItem(hasSharedKey) === 'true') {
        const statusText = document.getElementById('statusKirimOrtu');
        if (statusText) {
            statusText.className = "small fw-bold text-success mt-1";
            statusText.innerHTML = "✅ Tembusan Terkirim!";
        }
    }
}

async function syncMapLocks(userId, jenjang) {
    const isGodMode = sessionStorage.getItem('god_mode_role') !== null;
    const { data: progress } = await supabase
        .from('progress')
        .select('bab, sub_bab, skor')
        .eq('user_id', userId)
        .eq('jenjang', jenjang);

    // Check if a specific level is passed (Score >= 80)
    const checkPassed = (b, s) => {
        return progress && progress.some(p => p.bab === b && p.sub_bab === s && p.skor >= 80);
    };

    // 1. Get all Standard Nodes (sorted)
    const nodes = Array.from(document.querySelectorAll(`a[id^="node_${jenjang}_"]`))
        .filter(n => !n.id.includes('BOSS'))
        .map(n => {
            const parts = n.id.split('_');
            return {
                el: n,
                bab: parseInt(parts[2]),
                sub: parseInt(parts[3])
            };
        })
        .sort((a, b) => (a.bab - b.bab) || (a.sub - b.sub));

    let previousPassed = true; // First node is always unlocked

    nodes.forEach((nodeObj, index) => {
        const { el, bab, sub } = nodeObj;
        const isCompleted = checkPassed(bab, sub);

        // Unlock conditions: First Node OR Previous Passed OR God Mode
        if (index === 0 || previousPassed || isGodMode) {
            unlockNode(el, jenjang, bab, sub, isCompleted);
        } else {
            lockNode(el, sub);
        }

        previousPassed = isCompleted;
    });

    // 2. Handle Boss Nodes
    const bossNodes = document.querySelectorAll(`a[id^="node_${jenjang}_BOSS_"]`);
    bossNodes.forEach(boss => {
        // Boss Logic: Unlock if all nodes in that BAB are passed? 
        // Or simple heuristic: Unlock if God Mode or if previous standard node is passed.
        // For simplicity in this fix, we assume God Mode opens all.
        if (isGodMode) {
            boss.classList.remove('node-locked');
            boss.classList.add('node-current');
            boss.onclick = null;
        } else {
            boss.onclick = () => alert("👹 Boss belum muncul! Selesaikan semua stage di dunia ini.");
        }
    });
}

function unlockNode(node, jenjang, bab, sub, isCompleted) {
    node.classList.remove('node-locked');
    
    const labelText = node.querySelector('.stage-label')?.innerText || `Misi ${bab}.${sub}`;
    
    if (isCompleted) {
        node.classList.add('node-passed');
        node.classList.remove('node-current');
        node.innerHTML = `⭐<div class="stage-label">${labelText}</div>`;
    } else {
        node.classList.add('node-current');
        node.classList.remove('node-passed');
        // If God Mode, icon is Sword (Ready), otherwise it might be Sword too if it's the current level
        node.innerHTML = `⚔️<div class="stage-label">${labelText}</div>`;
    }

    // IMPORTANT: Set the correct link!
    node.href = `/materi.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
    
    const label = node.querySelector('.stage-label');
    if(label) label.classList.remove('text-muted');
    node.onclick = null; 
}

function lockNode(node, sub) {
    node.classList.add('node-locked');
    node.classList.remove('node-passed', 'node-current');
    
    // Ensure icon is Lock
    const labelText = node.querySelector('.stage-label')?.innerText || `Misi ${sub}`;
    node.innerHTML = `🔒<div class="stage-label text-muted">${labelText}</div>`;
    
    node.href = "#";
    node.onclick = (e) => {
        e.preventDefault();
        alert(`🔒 Stage terkunci! Selesaikan stage sebelumnya dengan skor minimal 80 untuk membuka jalan.`);
    };
}

// AKSI TOMBOL KIRIM KODE ORTU
document.addEventListener('click', async (e) => {
    if (e.target.closest('#btnKirimKodeOrtu')) {
        const kode = document.getElementById('pairingCode').innerText;
        const namaAnak = document.getElementById('userName').innerText;
        
        const pesanOrtu = `Halo Ayah/Ibu! 👋\n\n${namaAnak} sedang belajar matematika pakai aplikasi super seru: *TKA Math Mastery*! Ada jurus cepat dan sistem level kayak main game.\\n\\nBuka web ini: https://tkamath.com/auth.html\\nDaftar sebagai *Orang Tua*, lalu masukkan Kode Tautku: *${kode}*\\n\\nYuk pantau nilaiku! 🚀`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(pesanOrtu)}`, '_blank');

        const hasSharedKey = `has_shared_parent_${currentUser.id}`;
        if(localStorage.getItem(hasSharedKey) !== 'true') {
            setTimeout(async () => {
                try {
                    const { data: profile } = await supabase.from('profiles').select('xp_total').eq('id', currentUser.id).single();
                    if(profile) {
                        const newXP = (profile.xp_total || 0) + 100;
                        await supabase.from('profiles').update({ xp_total: newXP }).eq('id', currentUser.id);
                        const xpDisplay = document.getElementById('userXP');
                        if (xpDisplay) xpDisplay.innerText = newXP;
                        
                        const statusText = document.getElementById('statusKirimOrtu');
                        if (statusText) {
                            statusText.className = "small fw-bold text-success mt-1";
                            statusText.innerHTML = "✅ Tembusan Terkirim! (+100 XP)";
                        }
                        localStorage.setItem(hasSharedKey, 'true');
                        alert("🎉 Hebat! Kamu dapat bonus +100 XP!");
                    }
                } catch (err) {
                    console.error("Gagal menambah XP:", err);
                }
            }, 2000);
        }
    }
});

// RECOVER HEART LOGIC
window.recoverHeart = async function() {
    const { data: profile } = await supabase.from('profiles').select('hearts').eq('id', currentUser.id).single();
    if(profile) {
        await supabase.from('profiles').update({ hearts: 5 }).eq('id', currentUser.id);
        alert("💖 Energi pulih sepenuhnya! Ayo kembali bertualang.");
        window.location.reload();
    }
}

// ==========================================
// 4. FUNGSI KHUSUS ORANG TUA
// ==========================================
function aturDashboardOrtu(profile) {
    const navTitle = document.getElementById('navTitle');
    const avatarIcon = document.getElementById('avatarIcon');
    const userRoleText = document.getElementById('userRoleText');

    if (navTitle) navTitle.innerText = "👨‍👩‍👧 Panel Orang Tua";
    if (avatarIcon) avatarIcon.innerText = "👨‍👩‍👧";
    if (userRoleText) userRoleText.innerText = "Pemantau Akademi";
    
    const statsPremium = document.getElementById('statsPremium');
    if (statsPremium) statsPremium.classList.remove('d-none');
    const panelParent = document.getElementById('panelParent');
    if (panelParent) panelParent.classList.remove('d-none');

    loadDataAnak();
    cekStatusPremium();
}

async function loadDataAnak() {
    const { data: relasi } = await supabase.from('student_relations').select('student_id').eq('observer_id', currentUser.id);

    if (relasi && relasi.length > 0) {
        const idAnak = relasi[0].student_id; 

        const boxForm = document.getElementById('boxFormTautkan');
        const wadahAnak = document.getElementById('wadahDataAnak');
        if (boxForm) boxForm.classList.add('d-none');
        if (wadahAnak) wadahAnak.classList.remove('d-none');

        const { data: profilAnak } = await supabase.from('profiles').select('*').eq('id', idAnak).single();
        if(profilAnak) {
            const namaAnakView = document.getElementById('namaAnakView');
            const levelAnakView = document.getElementById('levelAnakView');
            const xpAnakView = document.getElementById('xpAnakView');
            if (namaAnakView) namaAnakView.innerText = profilAnak.nama_lengkap;
            if (levelAnakView) levelAnakView.innerText = profilAnak.level;
            if (xpAnakView) xpAnakView.innerText = profilAnak.xp_total;
        }

        const { data: riwayat } = await supabase.from('progress').select('*').eq('user_id', idAnak).order('created_at', { ascending: false }).limit(5);
        const isiTabel = document.getElementById('isiTabelNilai');
        if (isiTabel) {
            isiTabel.innerHTML = ''; 

            if (riwayat && riwayat.length > 0) {
                riwayat.forEach(row => {
                    let warnaSkor = row.skor >= 80 ? 'text-success' : (row.skor >= 60 ? 'text-warning' : 'text-danger');
                    let tanggal = new Date(row.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
                    let tipeFormat = row.tipe_latihan === 'tb' ? 'Terbimbing' : (row.tipe_latihan === 'std' ? 'Standar' : 'Kumulatif');

                    isiTabel.innerHTML += `<tr>
                        <td class="fw-bold text-primary">Bab ${row.bab}.${row.sub_bab} ${row.jenjang}</td>
                        <td><span class="badge bg-light text-dark border">${tipeFormat}</span></td>
                        <td class="fw-bold fs-5 ${warnaSkor}">${row.skor}</td>
                        <td class="text-muted small">${tanggal}</td>
                    </tr>`;
                });
            } else {
                isiTabel.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Anak Anda belum bertarung (latihan).</td></tr>`;
            }
        }
    }
}

// Form Pencarian Kode Ortu
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'formTautkanOrtu') {
        e.preventDefault();
        const btn = document.getElementById('btnTautkanOrtu');
        const msgArea = document.getElementById('msgTautkanOrtu');
        btn.innerText = "Mencari..."; btn.disabled = true;

        const kode = document.getElementById('inputKodeAnak').value.toUpperCase();
        const { data: anak } = await supabase.from('profiles').select('id, nama_lengkap').eq('pairing_code', kode).maybeSingle();

        if(anak) {
            const { error } = await supabase.from('student_relations').insert({ student_id: anak.id, observer_id: currentUser.id, status: 'approved' });
            if(!error) {
                msgArea.className = "mt-2 small fw-bold text-success";
                msgArea.innerText = `Berhasil! Merefresh data...`;
                setTimeout(() => { window.location.reload(); }, 1500);
            } else {
                msgArea.className = "mt-2 small fw-bold text-danger";
                msgArea.innerText = "Gagal. Mungkin akun ini sudah tertaut.";
            }
        } else {
            msgArea.className = "mt-2 small fw-bold text-danger";
            msgArea.innerText = "Kode tidak ditemukan.";
        }
        btn.innerText = "Cari"; btn.disabled = false;
    }
});

// 2. Fungsi Share yang Lebih Cerdas (Update untuk Facebook Auto-Copy)
window.shareToPlatform = function(platform) {
    const encodedMsg = encodeURIComponent(shareMessage);
    const linkWeb = "https://tkamath.com";
    let url = '';

    if(platform === 'whatsapp') {
        url = `https://api.whatsapp.com/send?text=${encodedMsg}`;
    } else if (platform === 'facebook') {
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(linkWeb)}`;
        
        // TRIK: Otomatis salin kalimat promosi ke clipboard
        copyToClipboard(shareMessage);
        alert("✨ Kalimat promosi keren sudah OTOMATIS TERSALIN!\n\nSaat jendela Facebook terbuka, silakan klik kanan atau tahan layar lalu pilih 'PASTE/TEMPEL' untuk membagikan pengalaman Anda.");
    }

    window.open(url, '_blank');

    // Sistem Counter (Tetap 5x untuk unlock)
    setTimeout(() => {
        const shareKey = `share_count_${currentUser.id}`;
        let currentShares = parseInt(localStorage.getItem(shareKey)) || 0;
        currentShares += 1;
        localStorage.setItem(shareKey, currentShares.toString());
        
        updateShareUI(currentShares);

        if(currentShares >= TARGET_SHARES) {
            localStorage.setItem(`is_premium_${currentUser.id}`, 'true');
            alert("🎉 LUAR BIASA! Fitur Pemantauan Premium Anda telah diaktifkan selamanya!");
            window.location.reload(); 
        }
    }, 1500);
}

// Fungsi pembantu untuk menyalin teks
function copyToClipboard(text) {
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
}

function updateShareUI(currentShares) {
    const sisa = Math.max(TARGET_SHARES - currentShares, 0);
    const shareText = document.getElementById('shareCountText');
    const shareBar = document.getElementById('shareProgress');
    if(shareText) shareText.innerText = sisa;
    if(shareBar) shareBar.style.width = `${(currentShares / TARGET_SHARES) * 100}%`;
}

function cekStatusPremium() {
    if(!currentUser) return;
    const shareKey = `share_count_${currentUser.id}`;
    const premiumKey = `is_premium_${currentUser.id}`;

    updateShareUI(parseInt(localStorage.getItem(shareKey)) || 0);

    if(localStorage.getItem(premiumKey) === 'true') {
        const areaTabel = document.getElementById('areaTabel');
        if(areaTabel) areaTabel.classList.remove('locked-blur');
        
        const paywallOrtu = document.getElementById('paywallOrtu');
        if(paywallOrtu) paywallOrtu.remove();

        const statusBadge = document.getElementById('statusPremium');
        if(statusBadge) {
            statusBadge.className = "px-4 py-2 bg-success rounded-pill shadow-sm fw-bold text-white";
            statusBadge.innerHTML = "🌟 Premium Aktif";
        }
    }
}

// ==========================================
// 5. FUNGSI KHUSUS GURU (GUILD MASTER)
// ==========================================
function aturDashboardGuru(profile) {
    const navTitle = document.getElementById('navTitle');
    const avatarIcon = document.getElementById('avatarIcon');
    const userRoleText = document.getElementById('userRoleText');

    if (navTitle) navTitle.innerText = "🧙‍♂️ Akademi Pendidik";
    if (avatarIcon) avatarIcon.innerText = "🧙‍♂️";
    if (userRoleText) userRoleText.innerText = "Master Pendidik (Mentor)";
    
    const panelTeacher = document.getElementById('panelTeacher');
    if (panelTeacher) panelTeacher.classList.remove('d-none');

    loadGuilds();
    applyKingdomSettings();

    document.getElementById('btnManageAd')?.addEventListener('click', openManageAdModal);
}

// AD MANAGEMENT LOGIC
async function openManageAdModal() {
    const modalEl = document.getElementById('modalManageAd');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const content = document.getElementById('adModalContent');
    content.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-warning"></div><p class="mt-2">Mengecek persyaratan...</p></div>';

    try {
        // 1. Get Teacher's Guilds
        const { data: guilds } = await supabase.from('guilds').select('id').eq('teacher_id', currentUser.id);
        const guildIds = guilds.map(g => g.id);

        if (guildIds.length === 0) {
            renderLockedAd(content, 0, 0);
            return;
        }

        // 2. Get Students Count
        const { data: members } = await supabase.from('guild_members').select('student_id').in('guild_id', guildIds);
        const uniqueStudents = [...new Set(members.map(m => m.student_id))]; // Array of Student IDs
        const studentCount = uniqueStudents.length;

        // 3. Get Parents Count (Students connected to parents)
        let parentCount = 0;
        if (studentCount > 0) {
            const { data: relations } = await supabase.from('student_relations').select('student_id').in('student_id', uniqueStudents);
            const uniqueConnectedStudents = [...new Set(relations.map(r => r.student_id))];
            parentCount = uniqueConnectedStudents.length;
        }

        // 4. Check Requirements
        const REQ_STUDENTS = 60;
        const REQ_PARENTS = 30;
        const isUnlocked = studentCount >= REQ_STUDENTS && parentCount >= REQ_PARENTS;

        if (isUnlocked) {
            renderUnlockedAd(content);
        } else {
            renderLockedAd(content, studentCount, parentCount);
        }

    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="alert alert-danger">Gagal memuat data: ${err.message}</div>`;
    }
}

function renderLockedAd(container, currentStudents, currentParents) {
    const pStudent = Math.min((currentStudents / 60) * 100, 100);
    const pParent = Math.min((currentParents / 30) * 100, 100);

    container.innerHTML = `
        <div class="text-center mb-4">
            <h1 class="display-1 text-muted">🔒</h1>
            <h4 class="fw-bold">Marketplace Terkunci</h4>
            <p class="text-muted small">Penuhi syarat berikut untuk menjadi Verified Mentor dan beriklan gratis.</p>
        </div>
        
        <div class="mb-3">
            <div class="d-flex justify-content-between small fw-bold mb-1">
                <span>Total Siswa (Min. 60)</span>
                <span class="${currentStudents >= 60 ? 'text-success' : 'text-danger'}">${currentStudents}/60</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar bg-primary" role="progressbar" style="width: ${pStudent}%"></div>
            </div>
        </div>

        <div class="mb-4">
            <div class="d-flex justify-content-between small fw-bold mb-1">
                <span>Siswa Terkoneksi Ortu (Min. 30)</span>
                <span class="${currentParents >= 30 ? 'text-success' : 'text-danger'}">${currentParents}/30</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar bg-warning" role="progressbar" style="width: ${pParent}%"></div>
            </div>
        </div>

        <div class="alert alert-info small">
            <i class="bi bi-lightbulb-fill"></i> <b>Tips:</b> Bagikan kode Guild ke lebih banyak siswa dan minta mereka mengundang orang tua menggunakan fitur "Kirim ke HP Ortu" di dashboard mereka.
        </div>
        
        <div class="d-grid">
            <a href="/iklanguru.html" target="_blank" class="btn btn-outline-dark rounded-pill btn-sm">Pelajari Selengkapnya</a>
        </div>
    `;
}

async function renderUnlockedAd(container) {
    // Fetch existing ad data
    const { data: ad } = await supabase.from('teacher_ads').select('*').eq('teacher_id', currentUser.id).maybeSingle();
    
    container.innerHTML = `
        <div class="text-center mb-3">
            <h1 class="display-4 text-success">🎉</h1>
            <h5 class="fw-bold text-success">Verified Mentor</h5>
            <p class="small text-muted">Profil Anda memenuhi syarat untuk tampil di Marketplace.</p>
        </div>

        <form id="formTeacherAd">
            <div class="mb-3">
                <label class="fw-bold small">Nama Tampilan</label>
                <input type="text" class="form-control" id="adName" value="${ad?.display_name || ''}" placeholder="Nama Lengkap + Gelar">
            </div>
            <div class="mb-3">
                <label class="fw-bold small">Kota Domisili</label>
                <input type="text" class="form-control" id="adCity" value="${ad?.city || ''}" placeholder="Contoh: Jakarta Selatan">
            </div>
            <div class="mb-3">
                <label class="fw-bold small">Biaya per Sesi (Rp)</label>
                <input type="number" class="form-control" id="adRate" value="${ad?.rate_per_session || ''}" placeholder="Contoh: 150000">
            </div>
            <div class="mb-3">
                <label class="fw-bold small">Bio Singkat & Keahlian</label>
                <textarea class="form-control" id="adBio" rows="3" placeholder="Ceritakan pengalaman dan metode mengajar Anda...">${ad?.bio || ''}</textarea>
            </div>
            <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="adActive" ${ad?.is_active ? 'checked' : ''}>
                <label class="form-check-label fw-bold small" for="adActive">Tampilkan Profil di Marketplace</label>
            </div>
            <div class="d-grid">
                <button type="submit" class="btn btn-primary rounded-pill fw-bold">Simpan Profil</button>
            </div>
        </form>
    `;

    document.getElementById('formTeacherAd').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true; btn.innerText = "Menyimpan...";

        const payload = {
            teacher_id: currentUser.id,
            display_name: document.getElementById('adName').value,
            city: document.getElementById('adCity').value,
            rate_per_session: document.getElementById('adRate').value,
            bio: document.getElementById('adBio').value,
            is_active: document.getElementById('adActive').checked,
            is_verified: true, // Auto-verified by logic
            updated_at: new Date()
        };

        const { error } = await supabase.from('teacher_ads').upsert(payload, { onConflict: 'teacher_id' });

        if (error) {
            alert("Gagal menyimpan: " + error.message);
        } else {
            alert("Profil berhasil diperbarui!");
            // Close modal
            const modalEl = document.getElementById('modalManageAd');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
        }
        btn.disabled = false; btn.innerText = "Simpan Profil";
    });
}

async function loadGuilds() {
    const container = document.getElementById('guildListContainer');
    container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

    const { data: guilds, error } = await supabase
        .from('guilds')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="alert alert-danger">Gagal memuat guild: ${error.message}</div>`;
        return;
    }

    if (!guilds || guilds.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <h1 class="display-4 text-muted">📜</h1>
                <p class="text-muted">Anda belum memiliki Guild (Kelas).</p>
                <button class="btn btn-primary rounded-pill fw-bold" data-bs-toggle="modal" data-bs-target="#modalCreateGuild">Buat Guild Pertama</button>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    guilds.forEach(guild => {
        // Fetch member count (async inside loop is okay for small sets, but ideally use Supabase count or join)
        // For simplicity, we just render the card and maybe fetch count later or show "..."
        const card = document.createElement('div');
        card.className = 'col-md-6';
        card.innerHTML = `
            <div class="card h-100 border-0 shadow-sm rounded-4">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h5 class="fw-bold text-primary mb-1">${guild.name}</h5>
                            <span class="badge bg-light text-dark border font-monospace">KODE: ${guild.code}</span>
                        </div>
                        <div class="bg-primary bg-opacity-10 p-2 rounded-circle text-primary">
                            <i class="bi bi-shield-fill-check fs-4"></i>
                        </div>
                    </div>
                    <p class="text-muted small">${guild.description || 'Tidak ada deskripsi.'}</p>
                    <button class="btn btn-outline-primary w-100 rounded-pill fw-bold btn-view-guild" data-id="${guild.id}">
                        <i class="bi bi-eye-fill"></i> Lihat Anggota & Nilai
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // Attach event listeners
    document.querySelectorAll('.btn-view-guild').forEach(btn => {
        btn.addEventListener('click', () => openGuildDetail(btn.getAttribute('data-id')));
    });
}

// CREATE GUILD
document.getElementById('btnSubmitGuild')?.addEventListener('click', async () => {
    const name = document.getElementById('inputGuildName').value;
    const desc = document.getElementById('inputGuildDesc').value;
    const btn = document.getElementById('btnSubmitGuild');

    if (!name) return alert("Nama Guild wajib diisi!");

    btn.disabled = true; btn.innerText = "Memproses...";
    
    // Generate Random 6-char Code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { error } = await supabase.from('guilds').insert({
        name: name,
        description: desc,
        code: code,
        teacher_id: currentUser.id
    });

    if (error) {
        alert("Gagal membuat guild: " + error.message);
        btn.disabled = false; btn.innerText = "Bentuk Guild!";
    } else {
        // Close modal manually
        const modalEl = document.getElementById('modalCreateGuild');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        // Reset form
        document.getElementById('inputGuildName').value = '';
        document.getElementById('inputGuildDesc').value = '';
        
        loadGuilds();
        alert(`🎉 Guild "${name}" berhasil dibentuk dengan kode: ${code}`);
        btn.disabled = false; btn.innerText = "Bentuk Guild!";
    }
});

// VIEW GUILD DETAIL
let currentGuildId = null; // Store for export function

async function openGuildDetail(guildId) {
    currentGuildId = guildId;
    const { data: guild } = await supabase.from('guilds').select('*').eq('id', guildId).single();
    if (!guild) return;

    document.getElementById('detailGuildName').innerText = guild.name;
    document.getElementById('detailGuildCode').innerText = guild.code;
    
    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('modalGuildDetail'));
    modal.show();

    loadGuildMembers(guildId);
}

async function loadGuildMembers(guildId) {
    const listBody = document.getElementById('listGuildMembers');
    listBody.innerHTML = '<tr><td colspan="4" class="text-center">Memuat ksatria...</td></tr>';

    // Join guild_members -> profiles
    const { data: members, error } = await supabase
        .from('guild_members')
        .select(`
            joined_at,
            status,
            profiles:student_id (nama_lengkap, level, xp_total, jenjang)
        `)
        .eq('guild_id', guildId);

    if (error || !members) {
        listBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Gagal memuat anggota.</td></tr>';
        return;
    }

    if (members.length === 0) {
        listBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada anggota. Bagikan kode guild!</td></tr>';
        return;
    }

    listBody.innerHTML = '';
    members.forEach(m => {
        const p = m.profiles;
        listBody.innerHTML += `
            <tr>
                <td>
                    <div class="fw-bold">${p.nama_lengkap}</div>
                    <div class="small text-muted">${p.jenjang || '-'}</div>
                </td>
                <td><span class="badge bg-warning text-dark">${p.level || 1}</span></td>
                <td class="fw-bold text-success">${p.xp_total || 0} XP</td>
                <td><span class="badge bg-success bg-opacity-10 text-success border border-success">${m.status}</span></td>
            </tr>
        `;
    });
}

// DELETE GUILD
document.getElementById('btnDeleteGuild')?.addEventListener('click', async () => {
    if (!currentGuildId) return;
    if (!confirm("⚠️ Yakin ingin membubarkan Guild ini? Semua data keanggotaan akan terhapus permanen!")) return;

    const { error } = await supabase.from('guilds').delete().eq('id', currentGuildId);
    if (!error) {
        alert("Guild telah dibubarkan.");
        window.location.reload();
    } else {
        alert("Gagal menghapus: " + error.message);
    }
});

// EXPORT TO EXCEL (CSV)
document.getElementById('btnExportExcel')?.addEventListener('click', async () => {
    if (!currentGuildId) return;
    alert("⏳ Sedang menyiapkan data nilai... (Fitur ini akan mengunduh CSV)");
    
    // Fetch members
    const { data: members } = await supabase.from('guild_members').select('student_id, profiles(nama_lengkap)').eq('guild_id', currentGuildId);
    if (!members || members.length === 0) return alert("Tidak ada data siswa.");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Siswa,Bab,Sub-Bab,Tipe,Skor,Waktu\n";

    for (const m of members) {
        const { data: progress } = await supabase.from('progress').select('*').eq('user_id', m.student_id);
        if (progress) {
            progress.forEach(p => {
                const date = new Date(p.created_at).toLocaleDateString('id-ID');
                csvContent += `"${m.profiles.nama_lengkap}",${p.bab},${p.sub_bab},${p.tipe_latihan},${p.skor},${date}\n`;
            });
        }
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nilai_guild_${currentGuildId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// GLOBAL HELPER
window.copyGuildCode = function() {
    const code = document.getElementById('detailGuildCode').innerText;
    navigator.clipboard.writeText(code).then(() => alert("Kode Guild disalin!"));
}

// ==========================================
// 6. STUDENT JOIN GUILD LOGIC
// ==========================================
document.getElementById('btnJoinGuild')?.addEventListener('click', async () => {
    const codeInput = document.getElementById('inputGuildCode');
    const msgArea = document.getElementById('msgJoinGuild');
    const code = codeInput.value.trim().toUpperCase();

    if (!code) return;

    msgArea.innerHTML = "🔍 Mencari Guild...";
    
    // 1. Find Guild
    const { data: guild, error: findError } = await supabase
        .from('guilds')
        .select('id, name, teacher_id')
        .eq('code', code)
        .maybeSingle();

    if (!guild || findError) {
        msgArea.className = "small fw-bold text-danger mt-2";
        msgArea.innerHTML = "❌ Kode Guild tidak ditemukan.";
        return;
    }

    // 2. Join Guild
    const { error: joinError } = await supabase.from('guild_members').insert({
        guild_id: guild.id,
        student_id: currentUser.id
    });

    if (joinError) {
        if (joinError.code === '23505') { // Unique violation
            msgArea.className = "small fw-bold text-warning mt-2";
            msgArea.innerHTML = `⚠️ Kamu sudah bergabung di <b>${guild.name}</b>!`;
        } else {
            msgArea.className = "small fw-bold text-danger mt-2";
            msgArea.innerHTML = "Gagal bergabung: " + joinError.message;
        }
    } else {
        msgArea.className = "small fw-bold text-success mt-2";
        msgArea.innerHTML = `✅ Berhasil bergabung ke <b>${guild.name}</b>!`;
        // Optional: Refresh page or UI to show mentor info
        setTimeout(() => alert(`Selamat datang ksatria! Mentor ${guild.name} kini memantau progresmu.`), 500);
    }
});

// ==========================================
// 6. FUNGSI KHUSUS ADMIN
// ==========================================
function aturDashboardAdmin(profile) {
    const navTitle = document.getElementById('navTitle');
    const avatarIcon = document.getElementById('avatarIcon');
    const userRoleText = document.getElementById('userRoleText');

    if (navTitle) navTitle.innerText = "🏰 Citadel Center";
    if (avatarIcon) avatarIcon.innerText = "👑";
    if (userRoleText) userRoleText.innerText = "Grandmaster Admin";
    
    // Create Admin Quick Access Panel (Minimalist for security)
    const dashboardRoot = document.querySelector('.container.mt-4');
    if (dashboardRoot) {
        const adminPanel = document.createElement('div');
        adminPanel.className = 'card shadow-lg border-0 rounded-4 p-5 text-center mt-5';
        adminPanel.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)';
        adminPanel.style.color = 'white';
        adminPanel.innerHTML = `
            <h1 class="display-4 mb-4" style="font-family: 'Cinzel', serif; color: #d4af37;">Restricted Area</h1>
            <p class="lead mb-5">Please use the official authentication portal for Citadel access.</p>
            <div class="d-grid gap-3 col-md-6 mx-auto">
                <div class="btn-group w-100">
                    <button onclick="sessionStorage.setItem('god_mode_role', 'student'); sessionStorage.setItem('god_mode_jenjang', 'SD'); window.location.reload();" class="btn btn-outline-success">
                        <i class="bi bi-backpack-fill"></i> Sim SD
                    </button>
                    <button onclick="sessionStorage.setItem('god_mode_role', 'student'); sessionStorage.setItem('god_mode_jenjang', 'SMP'); window.location.reload();" class="btn btn-outline-primary">
                        <i class="bi bi-calculator-fill"></i> Sim SMP
                    </button>
                </div>
                <button id="btnLogoutAdmin" class="btn btn-outline-danger rounded-pill">Logout Session</button>
            </div>
        `;
        dashboardRoot.appendChild(adminPanel);

        document.getElementById('btnLogoutAdmin')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/auth.html';
        });
    }
}

async function applyKingdomSettings() {
    const { data: settings } = await supabase.from('site_settings').select('*');
    if (!settings) return;

    settings.forEach(s => {
        if (s.key === 'b2b_config') {
            if (!s.value.enable_marketplace) {
                document.querySelectorAll('a[href*="iklanguru.html"]').forEach(el => el.remove());
                document.querySelectorAll('a[href*="marketplace.html"]').forEach(el => el.remove());
            }
            if (!s.value.enable_social_share) document.getElementById('btnKirimKodeOrtu')?.remove();
            if (s.value.maintenance_mode && currentUser.role !== 'admin') {
                document.body.innerHTML = '<div class="text-center mt-5"><h1>🧙‍♂️ Sang Bijak sedang bertapa...</h1><p>Aplikasi sedang dalam pemeliharaan.</p></div>';
            }
        }
    });
}

function showAdminSimulationBadge() {
    if (document.getElementById('sim-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'sim-badge';
    // Fix: Wrapper div was potentially blocking clicks. Removed wrapper, injected fixed element directly.
    badge.style.position = 'fixed';
    badge.style.bottom = '20px';
    badge.style.right = '20px';
    badge.style.zIndex = '9999';
    badge.style.pointerEvents = 'auto'; // Ensure button is clickable, but badge itself implies limited area
    
    const role = sessionStorage.getItem('god_mode_role').toUpperCase();
    const jenjang = sessionStorage.getItem('god_mode_jenjang') || '';

    badge.innerHTML = `
        <div style="background:#e94560; color:white; padding:10px 20px; border-radius:50px; font-weight:900; box-shadow:0 0 20px rgba(0,0,0,0.5); border:2px solid #d4af37; display: flex; align-items: center;">
            ⚡ GOD MODE: ${role} ${jenjang}
            <button id="btnCloseGodMode" style="background:white; color:black; border:none; border-radius:50%; margin-left:10px; width:24px; height:24px; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `;
    document.body.appendChild(badge);

    // Use event listener instead of inline onclick to ensure execution in module scope
    document.getElementById('btnCloseGodMode').addEventListener('click', () => {
        sessionStorage.removeItem('god_mode_role');
        sessionStorage.removeItem('god_mode_jenjang');
        window.location.reload();
    });
}

// ==========================================
// FUNGSI UMUM (LOGOUT)
// ==========================================
document.addEventListener('click', async (e) => {
    if (e.target.id === 'btnLogout') {
        await supabase.auth.signOut();
        window.location.href = '/auth.html';
    }
});

checkAuth();