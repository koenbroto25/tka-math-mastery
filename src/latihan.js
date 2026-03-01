import { supabase } from './supabase.js';

const urlParams = new URLSearchParams(window.location.search);
const jenjang = urlParams.get('jenjang');
const bab = urlParams.get('bab');
const sub = urlParams.get('sub');
const tipe = urlParams.get('tipe');

let currentUser = null;
let dataSoal = [];
let currentIndex = 0;
let jawabanBenar = 0;
let waktuSisa = 10 * 60; 
let intervalTimer;

// HP & Energy System
let playerHP = 100;
let monsterHP = 100;
let damagePerBenar = 0;
let currentHearts = 5;
let isHintUsedThisSession = false;

const wadahSoal = document.getElementById('wadahSoal');
const btnSerang = document.getElementById('btnSerang');
const timerDisplay = document.getElementById('timerDisplay');
const barPlayer = document.getElementById('hpPlayer');
const barMonster = document.getElementById('hpMonster');

document.getElementById('btnKembali').addEventListener('click', () => {
    if(confirm("Yakin ingin kabur dari pertempuran?")) {
        window.location.href = `/materi.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
    }
});

async function initLatihan() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/auth.html';
    currentUser = session.user;

    // Load Hearts from Profile
    const { data: profile } = await supabase.from('profiles').select('hearts, role').eq('id', currentUser.id).single();
    const isGodMode = sessionStorage.getItem('god_mode_role') !== null;
    
    if (profile) {
        currentHearts = profile.hearts;
        // God Mode bypass hearts check
        if (currentHearts <= 0 && !isGodMode) {
            alert("⚠️ Kamu kehabisan energi (Hearts)! Selesaikan misi sosial di Dashboard untuk memulihkan diri.");
            window.location.href = '/dashboard.html';
            return;
        }
    }

    if (isGodMode) showAdminSimulationBadge();

    document.getElementById('badgeTipe').innerText = tipe === 'tb' ? "🛡️ Shadow Training" : (tipe === 'std' ? "⚔️ Guardian's Skirmish" : "🌀 The Time Rift");
    
    // Adaptive UI based on Tipe
    if (tipe === 'tb') {
        document.getElementById('timerContainer').classList.add('d-none');
        document.getElementById('hpStatsRow').classList.add('d-none');
        document.getElementById('avatarMonster').innerText = "🧘";
        // Drill Mode uses separate container
        document.getElementById('wadahSoal').classList.add('d-none');
        document.getElementById('drillContainer').classList.remove('d-none');
        document.getElementById('btnSerang').innerText = "⏩ LANJUT SOAL BERIKUTNYA";
        document.getElementById('btnSerang').classList.add('d-none'); // Hide initially
    } else {
        document.getElementById('hintControls').classList.remove('d-none');
        setupHintListeners();
    }

    if(tipe === 'kum') waktuSisa = 20 * 60;

    setupReportSystem();
    await fetchSoal();
}

// --- DRILL MODE ENGINE (SHADOW TRAINING) ---
let currentDrillStep = 0;
let drillSteps = [];

function startDrillMode(soal) {
    const drillContainer = document.getElementById('drillSteps');
    drillContainer.innerHTML = '';
    currentDrillStep = 0;

    // Update Persistent Question Text
    const qText = document.getElementById('drillQuestionText');
    if(qText) qText.innerHTML = marked.parse(soal.pertanyaan); // Use innerHTML to support MathJax if needed
    
    // Update Technique Info
    const techniqueEl = document.getElementById('textTechnique');
    if(techniqueEl) {
        // Use hint or generate a default one based on question type
        techniqueEl.innerText = soal.hint || "Ikuti langkah-langkah audio untuk menemukan pola.";
    }

    // 1. Generate Steps based on Content
    drillSteps = generateDrillSteps(soal);
    
    // 2. Render First Step
    renderDrillStep(0);
    
    // 3. Start Audio
    playDrillAudio(drillSteps[0].audio);

    // Replay Button Logic
    document.getElementById('btnReplayAudio').onclick = () => playDrillAudio(drillSteps[currentDrillStep].audio);
}

function generateDrillSteps(soal) {
    const steps = [];

    // STRATEGI 1: PARSING LANGKAH CEPAT (PRIORITAS)
    // Jika soal memiliki field 'langkah_cepat', kita gunakan itu sebagai sumber kebenaran.
    if (soal.langkah_cepat && soal.langkah_cepat.length > 10) {
        // Split berdasarkan baris baru atau penomoran (1. , 2. )
        const rawSteps = soal.langkah_cepat.split(/\n|\d+\.\s+/).filter(s => s.trim().length > 0);

        rawSteps.forEach((stepText, idx) => {
            // Regex untuk menemukan angka atau pecahan (misal: 1/4, 2, 100)
            // Kita akan mengubah angka-angka ini menjadi input box
            const numberRegex = /(\d+\/\d+|\d+)/g;
            const matches = stepText.match(numberRegex);
            
            let htmlContent = stepText;
            
            if (matches) {
                // Ganti setiap angka dengan input box
                // Kita gunakan replace dengan callback untuk menangani setiap match unik
                htmlContent = stepText.replace(numberRegex, (match) => {
                    // Jika itu pecahan a/b, buat 2 input terpisah
                    if (match.includes('/')) {
                        const [num, den] = match.split('/');
                        return `<input class="drill-input" data-ans="${num}" style="width:30px">/<input class="drill-input" data-ans="${den}" style="width:30px">`;
                    } else {
                        return `<input class="drill-input" data-ans="${match}" style="width:40px">`;
                    }
                });
            } else {
                // Jika tidak ada angka, minta user mengetik kata kunci atau tekan lanjut
                htmlContent += ` <button class="btn btn-sm btn-outline-warning ms-2" onclick="checkStepCompletion(${idx})">Lanjut >></button>`;
            }

            // Parse Markdown for the step content (allows bold, italic in steps)
            const finalHtml = marked.parse(htmlContent);

            steps.push({
                audio: stepText.replace(/[\(\)\/]/g, " "), // Bersihkan simbol untuk audio TTS
                html: `<div class="lh-lg">${finalHtml}</div>`
            });
        });

        // Langkah Terakhir: Pilih Jawaban
        steps.push({
            audio: "Berdasarkan langkah-langkah tadi, manakah jawaban yang paling tepat?",
            html: `<div id="finalChoiceContainer"></div>`,
            isFinal: true
        });

        return steps;
    }

    // STRATEGI 2: HEURISTIC PATTERN MATCHER (FALLBACK)
    // Hanya jika langkah_cepat tidak tersedia
    const text = soal.pertanyaan;

    // Pola Pecahan (a/b)
    const fractions = text.match(/(\d+)\/(\d+)/g);
    
    if (fractions && fractions.length >= 2) {
        steps.push({
            audio: "Mari kita mulai latihan. Pertama, identifikasi pecahan-pecahan yang ada dalam soal.",
            html: `<p>Tulis ulang pecahan yang kamu lihat:</p>
                   1. <input class="drill-input" data-ans="${fractions[0].split('/')[0]}"> / <input class="drill-input" data-ans="${fractions[0].split('/')[1]}">
                   <br>
                   2. <input class="drill-input" data-ans="${fractions[1].split('/')[0]}"> / <input class="drill-input" data-ans="${fractions[1].split('/')[1]}">`
        });
        
        steps.push({
            audio: "Sekarang pilih jawaban yang paling tepat berdasarkan hasil hitunganmu.",
            html: `<div id="finalChoiceContainer"></div>`, 
            isFinal: true
        });
    } 
    else {
        const nums = text.match(/\d+/g);
        if (nums && nums.length > 0) {
            let inputHtml = nums.map(n => `<input class="drill-input" data-ans="${n}" style="width:50px">`).join(' ... ');
            steps.push({
                audio: "Identifikasi angka-angka kunci dalam soal ini.",
                html: `<p>Angka dalam soal:</p> ${inputHtml}`
            });
        }
        
        steps.push({
            audio: "Berdasarkan analisa angka tersebut, manakah jawaban yang benar?",
            html: `<div id="finalChoiceContainer"></div>`,
            isFinal: true
        });
    }

    return steps;
}

function renderDrillStep(stepIdx) {
    const stepData = drillSteps[stepIdx];
    const drillDiv = document.getElementById('drillSteps');
    
    const stepEl = document.createElement('div');
    stepEl.className = 'drill-step active mb-3';
    stepEl.id = `step-${stepIdx}`;
    stepEl.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <span class="badge bg-warning text-dark me-2">Langkah ${stepIdx + 1}</span>
            <span class="text-muted small italic"><i class="bi bi-volume-up"></i> Dengarkan instruksi...</span>
        </div>
        <div class="fs-5">${stepData.html}</div>
    `;
    drillDiv.appendChild(stepEl);

    // Focus first input
    const firstInput = stepEl.querySelector('input');
    if (firstInput) firstInput.focus();

    // Attach Validation Listeners
    const inputs = stepEl.querySelectorAll('.drill-input');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const correct = e.target.dataset.ans;
            
            if (val === correct) {
                e.target.classList.add('correct');
                e.target.classList.remove('wrong');
                e.target.disabled = true;
                checkStepCompletion(stepIdx);
            } else if (val.length >= correct.length) {
                e.target.classList.add('wrong');
                // Shake effect (CSS animation handled in HTML)
            }
        });
    });

    if (stepData.isFinal) {
        renderFinalChoices(stepIdx);
    }
}

function checkStepCompletion(stepIdx) {
    const stepEl = document.getElementById(`step-${stepIdx}`);
    const inputs = Array.from(stepEl.querySelectorAll('.drill-input'));
    const allCorrect = inputs.every(i => i.classList.contains('correct'));

    if (allCorrect) {
        // Success Sound (Optional)
        // playSound('ding');
        
        if (currentDrillStep < drillSteps.length - 1) {
            setTimeout(() => {
                stepEl.classList.remove('active');
                stepEl.style.opacity = '0.6';
                currentDrillStep++;
                renderDrillStep(currentDrillStep);
                playDrillAudio(drillSteps[currentDrillStep].audio);
            }, 800);
        }
    }
}

function renderFinalChoices(stepIdx) {
    const soal = dataSoal[currentIndex];
    const container = document.getElementById('finalChoiceContainer');
    if (!container) return;

    let html = '';
    const opsi = normalizeOptions(soal.opsi_jawaban, soal.question_type);
    
    opsi.forEach((pilihan, idx) => {
        let huruf = pilihan.split('.')[0].toLowerCase().trim();
        html += `
            <button class="btn btn-outline-light w-100 text-start mb-2 p-3 border-secondary" 
                onclick="handleDrillAnswer('${huruf}')">
                ${pilihan}
            </button>`;
    });
    container.innerHTML = html;
}

window.handleDrillAnswer = (jawaban) => {
    const soal = dataSoal[currentIndex];
    let kunci = typeof soal.kunci_jawaban === 'string' ? JSON.parse(soal.kunci_jawaban) : soal.kunci_jawaban;
    // Handle single string or array
    let isCorrect = Array.isArray(kunci) ? kunci.includes(jawaban) : kunci === jawaban;

    if (isCorrect) {
        playDrillAudio("Luar biasa! Analisamu tepat. Mari lanjut ke tantangan berikutnya.");
        document.getElementById('btnSerang').classList.remove('d-none');
        document.getElementById('btnSerang').click(); // Auto-submit to trigger logic
    } else {
        playDrillAudio("Kurang tepat. Coba perhatikan lagi hasil hitunganmu.");
        alert("Jawaban salah, coba lagi!");
    }
};

function playDrillAudio(text) {
    document.getElementById('drillStatus').innerHTML = `<span class="text-warning fw-bold">🔊 "${text}"</span>`;
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop previous
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

function setupHintListeners() {
    const btnInsight = document.getElementById('btnShowInsight');
    const btnVideo = document.getElementById('btnShowVideo');
    const panel = document.getElementById('insightPanel');
    const videoBox = document.getElementById('videoBox');

    btnInsight.addEventListener('click', () => {
        isHintUsedThisSession = true;
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        if (panel.style.display === 'block') {
            const soal = dataSoal[currentIndex];
            document.getElementById('insightContent').innerHTML = `
                <div class="mb-2"><strong>Contoh Mirip:</strong> ${soal.soal_mirip || 'Gunakan logika perbandingan senilai.'}</div>
                <div><strong>Langkah Cepat:</strong> ${soal.langkah_cepat || 'Kalikan silang langsung untuk hasil instan.'}</div>
            `;
        }
    });

    btnVideo.addEventListener('click', () => {
        isHintUsedThisSession = true;
        videoBox.style.display = videoBox.style.display === 'block' ? 'none' : 'block';
        const soal = dataSoal[currentIndex];
        if (soal.video_pembahasan_url) {
            document.getElementById('videoIframe').src = soal.video_pembahasan_url;
        } else {
            alert("Video penjelasan belum tersedia untuk jurus ini.");
        }
    });
}

async function fetchSoal() {
    const { data, error } = await supabase.from('questions')
        .select('*')
        .eq('jenjang', jenjang)
        .eq('bab', bab)
        .eq('sub_bab', sub)
        .eq('tipe_latihan', tipe);
    
    if (error) console.error(error);
    dataSoal = data || [];

    if (dataSoal.length === 0) {
        wadahSoal.innerHTML = `<h4 class="text-danger text-center">Misi belum tersedia di zona ini!</h4>`;
    } else {
        damagePerBenar = 100 / dataSoal.length;
        renderSatuSoal();
        mulaiTimer();
    }
}

// Helper to Normalize Options (Object to Array)
function normalizeOptions(rawOpsi, type) {
    if (!rawOpsi) return [];
    let opsi;
    try {
        opsi = typeof rawOpsi === 'string' ? JSON.parse(rawOpsi) : rawOpsi;
    } catch (e) { return []; }

    // Case 0: Kategori (Object with 'pernyataan' array)
    if (type === 'kategori' || type === 'complex_category') {
        if (opsi.pernyataan && Array.isArray(opsi.pernyataan)) return opsi.pernyataan;
        if (Array.isArray(opsi)) return opsi; // Legacy support
        return [];
    }

    // Case 1: Array (Standard)
    if (Array.isArray(opsi)) return opsi;
    
    // Case 2: Object {"A": "Text", "B": "Text"} -> ["A. Text", "B. Text"]
    if (typeof opsi === 'object') {
        return Object.keys(opsi).sort().map(key => `${key}. ${opsi[key]}`);
    }
    
    return [];
}

function getInstructionLabel(type) {
    if (type === 'mcma' || type === 'complex_mcma') {
        return `<div class="mb-2"><span class="badge bg-info text-dark border border-info"><i class="bi bi-check-all"></i> Jawaban Lebih dari Satu</span> <small class="text-muted ms-1 fw-bold">(Pilih SEMUA jawaban yang benar)</small></div>`;
    } else if (type === 'kategori' || type === 'complex_category') {
        return `<div class="mb-2"><span class="badge bg-warning text-dark border border-warning"><i class="bi bi-table"></i> Benar / Salah</span> <small class="text-muted ms-1 fw-bold">(Tentukan status setiap pernyataan)</small></div>`;
    } else {
        return `<div class="mb-2"><span class="badge bg-primary border border-primary"><i class="bi bi-check-circle"></i> Jawaban Tunggal</span> <small class="text-muted ms-1 fw-bold">(Pilih SATU jawaban paling tepat)</small></div>`;
    }
}

function renderSatuSoal() {
    if (currentIndex >= dataSoal.length) {
        return selesaikanPertarungan();
    }

    const soal = dataSoal[currentIndex];

    // --- AUTO-DETECT FIX ---
    // Fix for AI labeling Category questions as 'single'
    let rawOpsi = soal.opsi_jawaban;
    try {
        if (typeof rawOpsi === 'string') rawOpsi = JSON.parse(rawOpsi);
        if (rawOpsi && typeof rawOpsi === 'object' && !Array.isArray(rawOpsi)) {
            // Jika ada key 'pernyataan' atau 'kategori', paksa jadi tipe kategori
            if (rawOpsi.pernyataan || rawOpsi.kategori) {
                console.warn("Auto-correcting question type to 'kategori'");
                soal.question_type = 'kategori';
            }
        }
    } catch(e) {
        console.error("Error auto-detecting soal type", e);
    }
    // -----------------------

    document.getElementById('infoNomorSoal').innerText = `${currentIndex + 1} / ${dataSoal.length}`;

    // SPECIAL HANDLER FOR DRILL MODE (SHADOW TRAINING)
    if (tipe === 'tb') {
        startDrillMode(soal);
        return;
    }
    
    let htmlKonten = getInstructionLabel(soal.question_type);
    // Render Markdown for Question Text (Tables support)
    htmlKonten += `<div class="fw-bold mb-4 fs-4 quest-text" style="line-height: 1.6;">${marked.parse(soal.pertanyaan)}</div>`;
    
    // Normalisasi Opsi
    // Normalisasi Opsi
    const opsi = normalizeOptions(soal.opsi_jawaban, soal.question_type);

    // TIPE: SINGLE (Pilihan Ganda Biasa)
    if (soal.question_type === 'single' || !soal.question_type) {
        opsi.forEach((pilihan, idx) => {
            let huruf = pilihan.split('.')[0].toLowerCase().trim();
            htmlKonten += `
                <input type="radio" class="opsi-radio d-none" name="soal_aktif" id="opsi_${idx}" value="${huruf}">
                <label class="opsi-label shadow-sm" for="opsi_${idx}">${pilihan}</label>
            `;
        });
    } 
    // TIPE: MCMA (Banyak Jawaban)
    else if (soal.question_type === 'mcma') {
        htmlKonten += `<p class="text-muted small mb-3"><i>(Pilih semua jawaban yang benar)</i></p>`;
        opsi.forEach((pilihan, idx) => {
            let huruf = pilihan.split('.')[0].toLowerCase().trim();
            htmlKonten += `
                <input type="checkbox" class="opsi-radio d-none" name="soal_aktif" id="opsi_${idx}" value="${huruf}">
                <label class="opsi-label shadow-sm" for="opsi_${idx}">${pilihan}</label>
            `;
        });
    }
    // TIPE: KATEGORI (Benar/Salah per Pernyataan)
    else if (soal.question_type === 'kategori') {
        htmlKonten += `<div class="table-responsive"><table class="table table-bordered align-middle">
            <thead class="table-light"><tr><th>Pernyataan</th><th class="text-center">Sesuai</th><th class="text-center">Tidak</th></tr></thead>
            <tbody>`;
        opsi.forEach((st, idx) => {
            htmlKonten += `<tr>
                <td class="small fw-bold">${st}</td>
                <td class="text-center"><input type="radio" name="kat_${idx}" value="true" required></td>
                <td class="text-center"><input type="radio" name="kat_${idx}" value="false" required></td>
            </tr>`;
        });
        htmlKonten += `</tbody></table></div>`;
    }

    // Tampilkan Hint jika tipe 'tb' (Shadow Training)
    if (tipe === 'tb' && soal.hint) {
        htmlKonten += `<div class="mt-3 p-3 bg-info bg-opacity-10 border border-info rounded-3 text-info small">
            <strong>💡 Scroll of Insight:</strong> ${soal.hint}
        </div>`;
    }

    wadahSoal.innerHTML = htmlKonten;
    btnSerang.classList.remove('d-none');
    
    setTimeout(() => {
        if (window.renderMathInElement) {
            renderMathInElement(wadahSoal, { 
                delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}], 
                throwOnError: false 
            });
        }
    }, 50);
}

// Helper to Robustly Parse Answer Keys
function normalizeAnswer(raw, type) {
    if (!raw) return [];
    
    // 1. If it's already an array/object, just return it
    if (typeof raw === 'object') return raw;

    // 2. Try JSON Parse
    try {
        // Handle case where string is just "D" (JSON.parse fails on single unquoted char unless it's a number/bool)
        // If it looks like a simple string "A" or "A, B", don't JSON parse unless it has brackets/quotes
        if (raw.trim().startsWith('[') || raw.trim().startsWith('"')) {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(x => String(x).trim().toLowerCase()) : String(parsed).trim().toLowerCase();
        }
    } catch (e) {
        // Ignore parse error, treat as raw string
    }

    // 3. Handle Raw Strings (Comma separated or Single)
    const cleaned = raw.trim();
    
    if (type === 'mcma' || type === 'kategori' || type === 'complex_category' || type === 'complex_mcma') {
        // Split by comma
        return cleaned.split(',').map(s => s.trim().toLowerCase());
    } else {
        // Single answer
        return cleaned.toLowerCase();
    }
}

btnSerang.addEventListener('click', async () => {
    const soal = dataSoal[currentIndex];
    let isCorrect = false;

    // Evaluasi berdasarkan tipe
    if (soal.question_type === 'single' || !soal.question_type) {
        const dipilih = document.querySelector(`input[name="soal_aktif"]:checked`);
        if (!dipilih) return alert("Pilih jurusmu!");
        
        const kunci = normalizeAnswer(soal.kunci_jawaban, 'single');
        // Handle if kunci is array (rare for single) or string
        const userAns = dipilih.value.toLowerCase();
        
        if (Array.isArray(kunci)) {
            isCorrect = kunci.includes(userAns);
        } else {
            isCorrect = kunci === userAns;
        }
    } 
    else if (soal.question_type === 'mcma' || soal.question_type === 'complex_mcma') {
        const dipilih = Array.from(document.querySelectorAll(`input[name="soal_aktif"]:checked`)).map(el => el.value.toLowerCase());
        if (dipilih.length === 0) return alert("Pilih minimal satu target!");
        
        const kunci = normalizeAnswer(soal.kunci_jawaban, 'mcma'); // Returns Array lowercased
        
        // Check exact match (ignoring order if needed, but usually MCMA order doesn't matter)
        isCorrect = dipilih.length === kunci.length && dipilih.every(v => kunci.includes(v));
    }
    else if (soal.question_type === 'kategori' || soal.question_type === 'complex_category') {
        let answers = [];
        const statements = normalizeOptions(soal.opsi_jawaban, 'kategori');

        for(let i=0; i<statements.length; i++) {
            let sel = document.querySelector(`input[name="kat_${i}"]:checked`);
            if(!sel) return alert("Tentukan nasib semua pernyataan!");
            answers.push(sel.value.toLowerCase()); // "true" or "false" (or "benar"/"salah" depending on value attr)
        }
        
        const kunci = normalizeAnswer(soal.kunci_jawaban, 'kategori'); // Returns Array lowercased
        
        // Map "Benar" -> "true", "Salah" -> "false" if needed, or assume value attributes match answer key semantics
        // In the HTML generator, values are "true"/"false". In answer key, it might be "Benar, Salah".
        // Let's normalize the KEY to match values.
        const normalizedKey = kunci.map(k => {
            if (k === 'benar' || k === 'setuju' || k === 'sesuai') return 'true';
            if (k === 'salah' || k === 'tidak setuju' || k === 'tidak sesuai') return 'false';
            return k;
        });

        isCorrect = answers.every((v, i) => v === normalizedKey[i]);
    }

    btnSerang.disabled = true;

    if (isCorrect) {
        jawabanBenar++;
        if (tipe !== 'tb') {
            monsterHP -= damagePerBenar;
            if(monsterHP < 0) monsterHP = 0;
            barMonster.style.width = `${monsterHP}%`;
            document.getElementById('avatarMonster').classList.add('shake');
        }
        btnSerang.style.backgroundColor = "#10b981";
        btnSerang.innerText = tipe === 'tb' ? "✅ BERHASIL!" : "💥 TELAK!";
        setTimeout(() => document.getElementById('avatarMonster').classList.remove('shake'), 500);
    } else {
        if (tipe !== 'tb') {
            // Damage ke Player (L3 lebih sakit)
            let dmgSiswa = soal.difficulty === 'L3' ? 30 : (soal.difficulty === 'L2' ? 20 : 15);
            playerHP -= dmgSiswa;
            if(playerHP < 0) playerHP = 0;
            barPlayer.style.width = `${playerHP}%`;
            document.body.classList.add('shake');
        }
        btnSerang.style.backgroundColor = "#ef4444";
        btnSerang.innerText = tipe === 'tb' ? "❌ COBA LAGI" : "🛡️ TERTANGKIS!";
        setTimeout(() => document.body.classList.remove('shake'), 500);
    }

    setTimeout(() => {
        btnSerang.style.backgroundColor = "";
        btnSerang.innerText = "⚔️ JAWAB & SERANG!";
        btnSerang.disabled = false;
        
        if (playerHP <= 0) {
            handleDefeat();
        } else {
            currentIndex++;
            renderSatuSoal();
        }
    }, 1000);
});

async function handleDefeat() {
    clearInterval(intervalTimer);
    // Kurangi Heart di database
    const newHearts = Math.max(currentHearts - 1, 0);
    await supabase.from('profiles').update({ hearts: newHearts }).eq('id', currentUser.id);
    
    alert("🤕 Kamu pingsan dalam pertempuran! Sisa nyawa: " + newHearts + "/5. Kembali ke markas untuk memulihkan diri.");
    window.location.href = '/dashboard.html';
}

function mulaiTimer() {
    intervalTimer = setInterval(() => {
        waktuSisa--;
        let m = Math.floor(waktuSisa / 60);
        let s = waktuSisa % 60;
        timerDisplay.innerText = `⏳ ${m}:${s < 10 ? '0' : ''}${s}`;
        if (waktuSisa <= 0) {
            clearInterval(intervalTimer);
            alert("⏰ Waktu habis! Monster melarikan diri!");
            selesaikanPertarungan();
        }
    }, 1000);
}

async function selesaikanPertarungan() {
    clearInterval(intervalTimer);
    btnSerang.classList.add('d-none');

    let skor = Math.round((jawabanBenar / dataSoal.length) * 100);
    
    // XP based on difficulty (Weighted)
    let totalXP = 0;
    dataSoal.forEach((s, i) => {
        // Simplified: only count correct ones
        // Real logic would track per-question result
    });
    let baseXP = Math.floor(skor / 10) * 10; 
    let finalXP = baseXP + (skor >= 80 ? 20 : 0); // Bonus for victory
    
    // Penalty for using hint in Shadow Training
    if (tipe === 'tb' && isHintUsedThisSession) {
        finalXP = Math.floor(finalXP * 0.5);
    }

    await supabase.from('progress').insert({
        user_id: currentUser.id,
        jenjang: jenjang, bab: parseInt(bab), sub_bab: parseInt(sub),
        tipe_latihan: tipe, skor: skor,
        waktu_pengerjaan: (tipe === 'kum' ? 1200 : 600) - waktuSisa
    });

    const { data: profile } = await supabase.from('profiles').select('xp_total').eq('id', currentUser.id).single();
    if(profile) await supabase.from('profiles').update({ xp_total: (profile.xp_total || 0) + finalXP }).eq('id', currentUser.id);

    const modal = new bootstrap.Modal(document.getElementById('modalSkor'));
    document.getElementById('angkaSkor').innerText = skor;
    document.getElementById('teksXP').innerText = `+${finalXP} XP`;

    const ikon = document.getElementById('ikonSkor');
    if (skor >= 80) ikon.innerText = "👑 BOSS TERKALAHKAN!";
    else if (skor >= 60) ikon.innerText = "🛡️ BERTAHAN HIDUP";
    else ikon.innerText = "🤕 MISI GAGAL";

    document.getElementById('btnLanjutMateri').addEventListener('click', () => {
        window.location.href = `/materi.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
    });
    modal.show();
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
    badge.style.pointerEvents = 'auto'; // Ensure button is clickable
    
    badge.innerHTML = `
        <div style="background:#e94560; color:white; padding:10px 20px; border-radius:50px; font-weight:900; box-shadow:0 0 20px rgba(0,0,0,0.5); border:2px solid #d4af37; display: flex; align-items: center;">
            ⚡ GOD MODE: ${sessionStorage.getItem('god_mode_role').toUpperCase()}
            <button id="btnCloseGodMode" style="background:white; color:black; border:none; border-radius:50%; margin-left:10px; width:24px; height:24px; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `;
    document.body.appendChild(badge);

    // Use event listener instead of inline onclick to ensure execution in module scope
    document.getElementById('btnCloseGodMode').addEventListener('click', () => {
        sessionStorage.removeItem('god_mode_role');
        window.location.reload();
    });
}

function setupReportSystem() {
    const btnReport = document.getElementById('btnReport');
    const btnSubmit = document.getElementById('btnSubmitReport');
    
    if (btnReport) {
        btnReport.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('modalReport'));
            modal.show();
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', async () => {
            const issue = document.getElementById('reportIssue').value;
            if (!issue.trim()) return alert("Mohon jelaskan masalahnya.");
            
            const btn = btnSubmit;
            btn.disabled = true;
            btn.innerText = "Mengirim...";

            try {
                const q = dataSoal[currentIndex];
                const qType = tipe === 'tb' ? 'shadow' : (tipe === 'kum' ? 'simulasi' : 'standard');
                
                const { error } = await supabase.from('question_reports').insert({
                    question_id: q.id,
                    question_type: qType,
                    user_id: currentUser.id,
                    jenjang: jenjang,
                    bab: parseInt(bab),
                    sub_bab: parseInt(sub),
                    issue_text: issue
                });

                if (error) throw error;

                alert("Laporan berhasil dikirim. Terima kasih!");
                const modalEl = document.getElementById('modalReport');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                document.getElementById('reportIssue').value = '';
            } catch (err) {
                console.error("Report Error:", err);
                alert("Gagal mengirim laporan.");
            } finally {
                btn.disabled = false;
                btn.innerText = "Kirim Laporan";
            }
        });
    }
}

initLatihan();