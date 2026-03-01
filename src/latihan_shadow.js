import { supabase } from './supabase.js';

const urlParams = new URLSearchParams(window.location.search);
const jenjang = urlParams.get('jenjang');
const bab = urlParams.get('bab');
const sub = urlParams.get('sub');

let currentQuestions = [];
let currentIndex = 0;
let currentStepIndex = 0; // 0, 1, 2 (Langkah 1, 2, 3)
let soundEnabled = localStorage.getItem('shadow_sound_enabled') !== 'false';

const hintTeknik = document.getElementById('hintTeknik');
const teksSoal = document.getElementById('teksSoal');
const stepsContainer = document.getElementById('stepsContainer');
const progressBar = document.getElementById('progressBar');

// Init
async function initShadow() {
    setupSoundToggle();
    setupReportSystem();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/auth.html';
    
    // Load Drills
    const { data, error } = await supabase
        .from('shadow_drills')
        .select('*')
        .eq('jenjang', jenjang)
        .eq('bab', bab)
        .eq('sub_bab', sub)
        .eq('is_trial', false);

    if(error) console.error(error);
    
    if(!data || data.length === 0) {
        stepsContainer.innerHTML = '<div class="text-center py-5 text-warning">Belum ada drill untuk materi ini. Gunakan Scroll Forge untuk membuatnya!</div>';
        return;
    }

    currentQuestions = data;
    renderDrill();
}

function renderDrill() {
    if(currentIndex >= currentQuestions.length) {
        finishDrillSession();
        return;
    }

    const q = currentQuestions[currentIndex];
    
    hintTeknik.innerText = q.teknik_hint;
    teksSoal.innerHTML = marked.parse(q.pertanyaan);
    
    currentStepIndex = 0;
    renderSteps(q);
    
    const progress = ((currentIndex) / currentQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

function renderSteps(q) {
    stepsContainer.innerHTML = '';
    
    [q.langkah_1, q.langkah_2, q.langkah_3].forEach((stepText, idx) => {
        const card = document.createElement('div');
        card.className = `step-card ${idx === 0 ? 'active' : ''}`;
        card.id = `card-step-${idx}`;
        
        // 1. Render Markdown first (Tables, Bold, etc.)
        let htmlContent = marked.parse(stepText);
        
        // 2. Inject Inputs into the rendered HTML
        // Note: marked might wrap text in <p>, so we just replace globally in the HTML string
        const processedHtml = htmlContent.replace(/\[(.*?)\]/g, (match, p1) => {
            return `<input class="drill-input" data-ans="${p1}" autocomplete="off">`;
        });

        card.innerHTML = `
            <div class="d-flex justify-content-between">
                <span class="step-number">LANGKAH ${idx + 1}</span>
                <button class="audio-btn" onclick="speakStep(${idx}, ${idx === 0})"><i class="bi bi-volume-up-fill"></i></button>
            </div>
            <div class="fs-5 lh-lg">${processedHtml}</div>
            <div class="mt-3 text-end feedback-area"></div>
        `;
        
        stepsContainer.appendChild(card);
    });

    attachListenersToStep(0);
    speakStep(0, true);
}

function attachListenersToStep(stepIdx) {
    const card = document.getElementById(`card-step-${stepIdx}`);
    const inputs = card.querySelectorAll('.drill-input');
    const feedback = card.querySelector('.feedback-area');

    if(inputs.length === 0) {
        feedback.innerHTML = `<button class="btn btn-sm btn-primary rounded-pill px-4" onclick="nextStep(${stepIdx})">Lanjut >></button>`;
    }

    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const ans = e.target.dataset.ans;
            
            if(val === ans) {
                e.target.classList.add('correct');
                e.target.disabled = true;
                e.target.blur();
                
                const nextInput = Array.from(inputs).find(i => !i.disabled);
                if(nextInput) nextInput.focus();
                else nextStep(stepIdx);
            } else if (val.length >= ans.length) {
                e.target.classList.add('wrong');
                setTimeout(() => e.target.classList.remove('wrong'), 500);
            }
        });
    });
    
    if(inputs.length > 0) inputs[0].focus();
}

window.nextStep = (currentIdx) => {
    const currentCard = document.getElementById(`card-step-${currentIdx}`);
    currentCard.classList.remove('active');
    currentCard.classList.add('completed');
    
    const nextIdx = currentIdx + 1;
    if(nextIdx < 3) {
        const nextCard = document.getElementById(`card-step-${nextIdx}`);
        nextCard.classList.add('active');
        
        speakStep(nextIdx, false);
        attachListenersToStep(nextIdx);
    } else {
        const modal = new bootstrap.Modal(document.getElementById('modalSuccess'));
        modal.show();
        
        document.getElementById('btnNextDrill').onclick = () => {
            modal.hide();
            currentIndex++;
            renderDrill();
        };
    }
};

async function finishDrillSession() {
    const stepsContainer = document.getElementById('stepsContainer');
    stepsContainer.innerHTML = `
        <div class="text-center py-5">
            <h2 class="text-warning mb-4">Shadow Mastery Complete!</h2>
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-3">Menyimpan pencapaianmu...</p>
        </div>
    `;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if(!session) return;

        await supabase
            .from('progress')
            .upsert({
                user_id: session.user.id,
                jenjang: jenjang.toUpperCase(),
                bab: parseInt(bab),
                sub_bab: parseInt(sub),
                tipe_latihan: 'tb',
                skor: 100
            }, { onConflict: 'user_id, jenjang, bab, sub_bab, tipe_latihan' });

        await supabase.rpc('increment_player_stats', { 
            x_xp: 50, 
            x_gold: 20, 
            x_user_id: session.user.id 
        });

        alert("Selamat! Kamu telah menguasai teknik bayangan. +50 XP | +20 Gold");
        window.location.href = `/materi.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;

    } catch (err) {
        console.error("Save Error:", err);
        window.location.href = `/materi.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
    }
}

window.speakText = (text) => {
    if (!soundEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
};

function setupSoundToggle() {
    const btnSound = document.getElementById('btnSoundToggle');
    if (!btnSound) return;

    const updateIcon = () => {
        btnSound.innerHTML = soundEnabled ? '<i class="bi bi-volume-up-fill"></i>' : '<i class="bi bi-volume-mute-fill"></i>';
        btnSound.className = `btn btn-dark btn-sm rounded-circle border-secondary ${soundEnabled ? 'text-warning' : 'text-muted'}`;
        btnSound.style.width = '40px';
        btnSound.style.height = '40px';
    };
    
    updateIcon();

    btnSound.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('shadow_sound_enabled', soundEnabled);
        updateIcon();
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
                const { data: { session } } = await supabase.auth.getSession();
                const q = currentQuestions[currentIndex];
                
                const { error } = await supabase.from('question_reports').insert({
                    question_id: q.id,
                    question_type: 'shadow',
                    user_id: session.user.id,
                    jenjang: jenjang,
                    bab: parseInt(bab),
                    sub_bab: parseInt(sub),
                    issue_text: issue
                });

                if (error) throw error;

                alert("Laporan berhasil dikirim. Terima kasih, Ksatria!");
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

window.speakStep = (stepIdx, includeQuestion = false) => {
    if (!currentQuestions || currentQuestions.length === 0) return;
    const q = currentQuestions[currentIndex];
    
    const cleanForSpeech = (text) => {
        return text
            // 1. Tangani pecahan format LaTeX \frac{a}{b}
            .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1 per $2')
            // 2. Tangani pecahan format biasa a/b (mencegah terbaca sebagai tanggal)
            .replace(/(\d+)\/(\d+)/g, '$1 per $2')
            // 3. Simbol Matematika Umum
            .replace(/\\cdot|\\times|\*/g, ' kali ')
            .replace(/\^/g, ' pangkat ')
            .replace(/\\pi/g, ' pi ')
            // 4. Bersihkan sisa karakter LaTeX/Special
            .replace(/[\\${}\[\]]/g, '')
            .replace(/\s+/g, ' ').trim();
    };

    let textToSpeak = "";
    if (includeQuestion) {
        textToSpeak += cleanForSpeech(q.pertanyaan) + ". ... ";
    }
    
    const steps = [q.langkah_1, q.langkah_2, q.langkah_3];
    const stepText = cleanForSpeech(steps[stepIdx].replace(/\[.*?\]/g, "..."));
    textToSpeak += stepText;
    
    speakText(textToSpeak);
};

document.getElementById('btnKembali').addEventListener('click', () => {
    window.location.href = `/materi.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
});

initShadow();