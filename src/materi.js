import { supabase } from './supabase.js';

let currentUser = null;

// Ambil Parameter dari URL
const urlParams = new URLSearchParams(window.location.search);
const jenjang = urlParams.get('jenjang');
const bab = urlParams.get('bab');
const sub = urlParams.get('sub');

// 1. Inisialisasi: Cek Sesi dulu baru panggil loadMateri
async function initPage() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/auth.html';
        return;
    }
    
    // Get full profile to check role
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    
    currentUser = profile || session.user;
    
    if (!jenjang || !bab || !sub) {
        alert("Data misi tidak ditemukan!");
        window.location.href = '/dashboard.html';
        return;
    }
    
    loadMateri();
}

// 2. Tarik Data Materi dari Supabase
async function loadMateri() {
    // Basic UI Update for Header immediately
    const navTitle = document.getElementById('navBabJudul');
    if (navTitle) navTitle.innerText = `Stage ${bab}.${sub} - ${jenjang.toUpperCase()}`;

    try {
        console.log("Fetching Materi for:", { jenjang, bab, sub });
        // Fetch material content including quiz config
        const { data: results, error } = await supabase
            .from('materi')
            .select('*')
            .eq('jenjang', jenjang.toUpperCase().trim())
            .eq('bab', parseInt(bab))
            .eq('sub_bab', parseInt(sub))
            .limit(1);

        if (error) {
            console.error("Supabase Error:", error);
            const wadah = document.getElementById('narasiMateri');
            if (wadah) wadah.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
            return;
        }

        console.log("Query Results:", results);

        if (!results || results.length === 0) {
            const wadah = document.getElementById('narasiMateri');
            if (wadah) wadah.innerHTML = '<p class="text-danger text-center fw-bold mt-4">Maaf pahlawan, Gulungan Pengetahuan untuk wilayah ini belum ditemukan! 📜❌ <br><small class="text-muted">Cek apakah RLS sudah di-set ke Public/Authenticated.</small></p>';
            return;
        }

        const data = results[0];

        // --- RENDER UI ---
        if (navTitle) navTitle.innerText = `Stage ${bab}.${sub} - ${jenjang.toUpperCase()}`;
        
        const judulMateriHeader = document.getElementById('judulMateri');
        const judulSakti = data.judul.includes('.') ? data.judul.split('.')[1].trim() : data.judul;
        if (judulMateriHeader) judulMateriHeader.innerText = "Misi: " + judulSakti;
        
        // --- INTERACTIVE VIDEO SETUP ---
        if (data.video_url) {
            initInteractiveVideo(data.video_url, data.video_quiz_config || [], data.id);
        } else {
            document.getElementById('videoPlayerContainer').innerHTML = '<p class="text-center text-muted p-5">Visi Sang Bijak belum terekam dalam kristal ingatan.</p>';
        }

        // Parsing HTML Content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.konten_html;

        // 1. Knowledge Section
        const summaryBox = tempDiv.querySelector('.summary-box');
        const narasiElem = document.getElementById('narasiMateri');
        if (summaryBox && narasiElem) {
            const narasi = summaryBox.innerHTML.replace(/<strong>Ringkasan Materi:<\/strong>/gi, '').trim();
            // Parse Markdown if any, otherwise it renders HTML as is (marked supports HTML input)
            narasiElem.innerHTML = marked.parse(narasi);
        }

        // 2. Secret Techniques Section
        const questionCards = tempDiv.querySelectorAll('.question-card');
        const secretContent = document.getElementById('secret-content');
        if (secretContent) {
            secretContent.innerHTML = '';
            questionCards.forEach((card, idx) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'mb-5';
                
                const questionPart = card.cloneNode(true);
                const fm = questionPart.querySelector('.fast-method');
                if (fm) fm.remove();
                
                const methodPart = card.querySelector('.fast-method');
                const methodId = `method-${idx}`;
                
                wrapper.innerHTML = `
                    <div class="example-card mb-2">${questionPart.innerHTML}</div>
                    <button class="btn btn-sm btn-outline-warning rounded-pill px-3" onclick="document.getElementById('${methodId}').style.display='block'; this.style.display='none'">
                        <i class="bi bi-magic"></i> Pelajari Teknik Rahasia
                    </button>
                    <div class="jurus-cepat-box" id="${methodId}">
                        ${methodPart ? methodPart.innerHTML : 'Gunakan logika dasar untuk soal ini.'}
                    </div>
                `;
                secretContent.appendChild(wrapper);
            });
        }

        // 3. Setup Trial Grounds
        await setupTrialGrounds();

        // 4. Set Navigation Links
        const updateHref = (id, tipe) => {
            const el = document.getElementById(id);
            if (el) {
                if (tipe === 'tb') {
                    // Shadow Training now uses a dedicated engine
                    el.href = `/latihan_shadow.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
                } else {
                    el.href = `/latihan.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}&tipe=${tipe}`;
                }
            }
        };
        // updateHref('btnTB', 'tb'); // Removed
        updateHref('btnSTD', 'std');
        updateHref('btnKUM', 'kum');
        
        setupQuestProgression();

        // Trigger KaTeX
        if (window.renderMathInElement) {
            renderMathInElement(document.body, {
                delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
                throwOnError : false
            });
        }

    } catch (err) {
        console.error("Error loading mission:", err);
    }
}

// --- INTERACTIVE VIDEO ENGINE (Shadow Overlay) ---
let player;
let quizConfig = [];
let currentMateriId = null;
let triggeredQuizzes = new Set();
let correctQuizzes = new Set(); // New Set to track correct answers
let quizCheckInterval;

function initInteractiveVideo(videoUrl, config, materiId) {
    quizConfig = config;
    currentMateriId = materiId;
    
    // Extract Video ID (Robust Handling)
    let videoId = "";
    try {
        if (videoUrl.includes('youtu.be/')) {
            videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
        } else if (videoUrl.includes('/embed/')) {
            videoId = videoUrl.split('/embed/')[1].split('?')[0];
        } else if (videoUrl.includes('v=')) {
            videoId = videoUrl.split('v=')[1].split('&')[0];
        }
    } catch (e) {
        console.error("Error parsing Video ID:", e);
    }

    if (!videoId) {
        console.error("Invalid YouTube URL");
        return;
    }

    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Called automatically by YouTube API when ready
    window.onYouTubeIframeAPIReady = () => {
        player = new YT.Player('videoPlayerContainer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'modestbranding': 1,
                'rel': 0
            },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    };
    
    // Fallback if API is already loaded (e.g. navigation within SPA)
    if (window.YT && window.YT.Player) {
        player = new YT.Player('videoPlayerContainer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'modestbranding': 1,
                'rel': 0
            },
            events: {
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        startQuizMonitoring();
    } else {
        stopQuizMonitoring();
    }
}

function startQuizMonitoring() {
    if (quizCheckInterval) clearInterval(quizCheckInterval);
    if (!quizConfig || quizConfig.length === 0) return;

    quizCheckInterval = setInterval(() => {
        if (!player || !player.getCurrentTime) return;
        
        const currentTime = Math.floor(player.getCurrentTime());
        
        // Find matching quiz for this second
        const quiz = quizConfig.find(q => q.time === currentTime && !triggeredQuizzes.has(currentTime));
        
        if (quiz) {
            triggerQuiz(quiz, currentTime);
        }
    }, 1000);
}

function stopQuizMonitoring() {
    if (quizCheckInterval) clearInterval(quizCheckInterval);
}

function triggerQuiz(quiz, timeKey) {
    // Skip if already answered correctly in this session
    if (correctQuizzes.has(quizConfig.indexOf(quiz))) return;

    player.pauseVideo();
    triggeredQuizzes.add(timeKey);
    
    const overlay = document.getElementById('videoQuizOverlay');
    const qText = document.getElementById('vq-question');
    const qOptions = document.getElementById('vq-options');
    const qFeedback = document.getElementById('vq-feedback');
    
    qText.innerText = quiz.question;
    qOptions.innerHTML = '';
    qFeedback.classList.add('d-none');
    qFeedback.className = 'mt-3 text-center fw-bold d-none';
    
    quiz.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-warning text-start fw-bold py-2';
        btn.innerText = opt;
        btn.onclick = () => handleQuizAnswer(quiz, idx, btn);
        qOptions.appendChild(btn);
    });
    
    overlay.classList.remove('d-none');
    overlay.classList.add('d-flex');
}

async function handleQuizAnswer(quiz, selectedIdx, btnElem) {
    const isCorrect = selectedIdx === quiz.answer;
    const feedback = document.getElementById('vq-feedback');
    const allBtns = document.getElementById('vq-options').querySelectorAll('button');
    
    // Disable all buttons
    allBtns.forEach(b => b.disabled = true);
    
    if (isCorrect) {
        btnElem.classList.remove('btn-outline-warning');
        btnElem.classList.add('btn-success');
        feedback.innerText = "✨ TEPAT SEKALI! Segel terbuka.";
        feedback.classList.remove('d-none', 'text-danger');
        feedback.classList.add('text-success');
        
        // Log to Supabase
        if (currentUser) {
            await supabase.from('video_quiz_logs').insert({
                user_id: currentUser.id,
                materi_id: currentMateriId, // Need to fetch materi.id in loadMateri
                quiz_index: quizConfig.indexOf(quiz),
                is_correct: true
            });
        }
        
        // Track Progress
        correctQuizzes.add(quizConfig.indexOf(quiz));
        checkAllQuizzesCompleted();

        // Resume video after delay
        setTimeout(() => {
            document.getElementById('videoQuizOverlay').classList.add('d-none');
            document.getElementById('videoQuizOverlay').classList.remove('d-flex');
            player.playVideo();
        }, 1500);
        
    } else {
        btnElem.classList.remove('btn-outline-warning');
        btnElem.classList.add('btn-danger');
        feedback.innerText = `❌ KURANG TEPAT. Petunjuk: ${quiz.hint}`;
        feedback.classList.remove('d-none', 'text-success');
        feedback.classList.add('text-danger');
        
        // Allow retry after delay
        setTimeout(() => {
            allBtns.forEach(b => {
                b.disabled = false;
                if(b === btnElem) b.classList.add('disabled'); // Keep wrong answer disabled
            });
        }, 2000);
    }
}

function checkAllQuizzesCompleted() {
    if (correctQuizzes.size >= quizConfig.length) {
        const checkVideo = document.getElementById('checkVideo');
        const lockKey = `unlock_${jenjang}_${bab}_${sub}`;
        
        if (checkVideo && !checkVideo.checked) {
            checkVideo.checked = true;
            checkVideo.disabled = false; // Enable briefly to show it's checked, or keep disabled but checked
            localStorage.setItem(lockKey, 'true');
            
            // Visual Celebration
            const label = checkVideo.nextElementSibling;
            if(label) {
                label.innerHTML = "✨ VISI TELAH DIKUASAI SEMPURNA! ✨";
                label.classList.add('text-success', 'fw-bold');
            }
            
            if(window.refreshQuestButtons) window.refreshQuestButtons();
            
            // Optional: Save 'video_completed' event to DB progress if needed
        }
    }
}

// 3. Training Grounds Logic (Mini Shadow Engine)
let tgQuestions = [];
let tgIndex = 0;
let tgSoundEnabled = localStorage.getItem('shadow_sound_enabled') !== 'false';

async function setupTrialGrounds() {
    setupTGSound();
    setupTGReport();

    const container = document.getElementById('training-ground-engine');
    if (!container) return;

    // Fetch IS_TRIAL questions from shadow_drills
    const { data, error } = await supabase
        .from('shadow_drills')
        .select('*')
        .eq('jenjang', jenjang.toUpperCase())
        .eq('bab', bab)
        .eq('sub_bab', sub)
        .eq('is_trial', true);

    if (error) console.error("Error fetching TG:", error);
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-warning text-center">Training Grounds sedang disiapkan oleh Sang Bijak...</p>';
        return;
    }

    tgQuestions = data;
    tgIndex = 0;
    renderTrainingDrill();
}

function renderTrainingDrill() {
    if (tgIndex >= tgQuestions.length) {
        finishTrainingGrounds();
        return;
    }
    
    const q = tgQuestions[tgIndex];
    document.getElementById('tg-hint').innerText = q.teknik_hint;
    document.getElementById('tg-question').innerHTML = marked.parse(q.pertanyaan);
    
    // Update progress
    const pct = (tgIndex / tgQuestions.length) * 100;
    document.getElementById('tg-progress-bar').style.width = `${pct}%`;
    
    renderTrainingSteps(q);
}

function renderTrainingSteps(q) {
    const container = document.getElementById('tg-steps-container');
    container.innerHTML = '';
    
    [q.langkah_1, q.langkah_2, q.langkah_3].forEach((stepText, idx) => {
        const card = document.createElement('div');
        card.className = `step-card mb-3 p-3 rounded bg-dark border border-secondary ${idx === 0 ? 'active' : ''}`;
        card.style.opacity = idx === 0 ? '1' : '0.5';
        card.id = `tg-card-${idx}`;
        
        // 1. Parse Markdown first
        let htmlContent = marked.parse(stepText);

        // 2. Inject Inputs
        const processedHtml = htmlContent.replace(/\[(.*?)\]/g, (match, p1) => {
            return `<input class="drill-input text-center fw-bold bg-transparent text-white border-bottom border-secondary" style="width:80px; outline:none;" data-ans="${p1}" autocomplete="off">`;
        });

        card.innerHTML = `
            <div class="d-flex justify-content-between mb-2">
                <span class="small text-warning font-monospace">LANGKAH ${idx + 1}</span>
            </div>
            <div class="lh-lg">${processedHtml}</div>
            <div class="feedback-area mt-2 text-end"></div>
        `;
        container.appendChild(card);
    });

    attachTrainingListeners(0);
}

function attachTrainingListeners(stepIdx) {
    const card = document.getElementById(`tg-card-${stepIdx}`);
    const inputs = card.querySelectorAll('.drill-input');
    const feedback = card.querySelector('.feedback-area');

    if(inputs.length === 0) {
        feedback.innerHTML = `<button class="btn btn-sm btn-warning rounded-pill px-3" onclick="nextTrainingStep(${stepIdx})">Lanjut >></button>`;
    }

    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const ans = e.target.dataset.ans;
            
            if(val === ans) {
                e.target.classList.add('text-success', 'border-success');
                e.target.disabled = true;
                
                const nextInput = Array.from(inputs).find(i => !i.disabled);
                if(nextInput) nextInput.focus();
                else nextTrainingStep(stepIdx);
            }
        });
    });
    
    if(inputs.length > 0) inputs[0].focus();
}

window.nextTrainingStep = (currentIdx) => {
    const currentCard = document.getElementById(`tg-card-${currentIdx}`);
    currentCard.style.opacity = '0.5';
    currentCard.style.borderLeft = '5px solid #198754'; // Green mark
    
    const nextIdx = currentIdx + 1;
    if(nextIdx < 3) {
        const nextCard = document.getElementById(`tg-card-${nextIdx}`);
        nextCard.style.opacity = '1';
        attachTrainingListeners(nextIdx);
    } else {
        tgIndex++;
        setTimeout(renderTrainingDrill, 500);
    }
};

function finishTrainingGrounds() {
    document.getElementById('training-ground-engine').classList.add('d-none');
    document.getElementById('tg-completion-area').classList.remove('d-none');
    
    // Save completion locally for unlocking
    const trialKey = `trial_passed_${jenjang}_${bab}_${sub}`;
    localStorage.setItem(trialKey, 'true');
    
    // Update Full Shadow Button Link
    const btnFull = document.getElementById('btnFullShadow');
    if(btnFull) btnFull.href = `/latihan_shadow.html?jenjang=${jenjang}&bab=${bab}&sub=${sub}`;
    
    setupQuestProgression();
}

// 4. Unlocking Logic (Updated for Interactive Video)
async function setupQuestProgression() {
    const checkVideo = document.getElementById('checkVideo');
    const btnSTD = document.getElementById('btnSTD');
    const btnKUM = document.getElementById('btnKUM');
    const lockInfo = document.getElementById('lockStatusInfo');
    
    if (!checkVideo || !btnSTD || !btnKUM) return;

    // LOCK CHECKBOX: Siswa tidak boleh centang manual jika ada kuis
    if (quizConfig && quizConfig.length > 0) {
        checkVideo.disabled = true;
        checkVideo.title = "Selesaikan semua kuis dalam video untuk membuka segel ini!";
    }

    const lockKey = `unlock_${jenjang}_${bab}_${sub}`;
    const trialKey = `trial_passed_${jenjang}_${bab}_${sub}`;

    // Load initial status (Local + Database check could be added here)
    if(localStorage.getItem(lockKey) === 'true') checkVideo.checked = true;

    // Check progress from DB
    const { data: progress } = await supabase
        .from('progress')
        .select('tipe_latihan, skor')
        .eq('user_id', currentUser.id)
        .eq('jenjang', jenjang.toUpperCase())
        .eq('bab', parseInt(bab))
        .eq('sub_bab', parseInt(sub));

    const hasPassed = (tipe) => progress && progress.some(p => p.tipe_latihan === tipe && p.skor >= 80);

    const refreshButtons = () => {
        const isGodMode = sessionStorage.getItem('god_mode_role') !== null;
        
        // Auto-check if god mode
        if (isGodMode && !checkVideo.checked) {
            checkVideo.checked = true;
            checkVideo.disabled = false; 
        }

        const watched = checkVideo.checked || isGodMode;
        const trialPassed = localStorage.getItem(trialKey) === 'true' || isGodMode;
        const tbPassed = hasPassed('tb') || isGodMode;
        const stdPassed = hasPassed('std') || isGodMode;

        if (isGodMode) showAdminSimulationBadge();

        [btnSTD, btnKUM].forEach(btn => btn.classList.add('btn-locked'));
        
        if (tbPassed) btnSTD.classList.remove('btn-locked');
        if (stdPassed) btnKUM.classList.remove('btn-locked');

        if (!watched) {
            lockInfo.innerHTML = "☝️ <span class='text-danger fw-bold'>Selesaikan Visi (Video + Kuis)</span> untuk memulai.";
        } else if (!trialPassed) {
            lockInfo.innerHTML = "📝 Selesaikan <span class='text-primary fw-bold'>Training Grounds</span> di atas.";
        } else if (!tbPassed) {
            lockInfo.innerHTML = "⚔️ Selesaikan <span class='text-primary fw-bold'>Shadow Training</span> (Klik tombol biru di atas setelah Training Grounds selesai) untuk lanjut!";
        } else if (!stdPassed) {
            lockInfo.innerHTML = "🛡️ Taklukkan <span class='text-success fw-bold'>Guardian Skirmish</span> untuk membuka Time Rift!";
        } else {
            lockInfo.innerHTML = "<span class='text-success fw-bold text-uppercase'>✨ Seluruh tantangan telah dikuasai! ✨</span>";
        }
    };

    refreshButtons();

    // Export refresh function for global use
    window.refreshQuestButtons = refreshButtons;
    
    // Manual Check (Only if NO quizzes exist, otherwise disabled)
    checkVideo.addEventListener('change', (e) => {
        if (!quizConfig || quizConfig.length === 0) {
            localStorage.setItem(lockKey, e.target.checked ? 'true' : 'false');
            refreshButtons();
        } else {
            // Revert if user somehow clicks it (e.g. hacking disabled attr)
            e.target.checked = false;
            alert("Selesaikan kuis di dalam video untuk membuka segel ini!");
        }
    });
}

function updateVideoCompletionStatus() {
    // Check if we have logs for all quizzes
    // For simplicity in this session, we track local session success.
    // Ideally, fetch from DB 'video_quiz_logs' count matching config length.
    
    // Assuming 'triggeredQuizzes' tracks shown quizzes. 
    // We need 'answeredCorrectlyQuizzes' set.
}

function showAdminSimulationBadge() {
    if (document.getElementById('sim-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'sim-badge';
    badge.innerHTML = `
        <div style="position:fixed; bottom:20px; right:20px; z-index:9999; background:#e94560; color:white; padding:10px 20px; border-radius:50px; font-weight:900; box-shadow:0 0 20px rgba(0,0,0,0.5); border:2px solid #d4af37;">
            ⚡ GOD MODE: ${sessionStorage.getItem('god_mode_role').toUpperCase()}
            <button onclick="sessionStorage.removeItem('god_mode_role'); window.location.reload();" style="background:white; color:black; border:none; border-radius:50%; margin-left:10px; width:24px; height:24px; cursor:pointer; font-weight:bold;">X</button>
        </div>
    `;
    document.body.appendChild(badge);
}

window.speakText = (text) => {
    if (!tgSoundEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
};

function setupTGSound() {
    const btnSound = document.getElementById('tgSoundToggle');
    if (!btnSound) return;

    const updateIcon = () => {
        btnSound.innerHTML = tgSoundEnabled ? '<i class="bi bi-volume-up-fill"></i>' : '<i class="bi bi-volume-mute-fill"></i>';
        btnSound.classList.toggle('text-warning', tgSoundEnabled);
        btnSound.classList.toggle('text-muted', !tgSoundEnabled);
    };
    
    updateIcon();

    btnSound.addEventListener('click', () => {
        tgSoundEnabled = !tgSoundEnabled;
        localStorage.setItem('shadow_sound_enabled', tgSoundEnabled);
        updateIcon();
    });
}

function setupTGReport() {
    const btnReport = document.getElementById('tgReportBtn');
    const btnSubmit = document.getElementById('tgSubmitReport');
    
    if (btnReport) {
        btnReport.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('tgReportModal'));
            modal.show();
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', async () => {
            const issue = document.getElementById('tgReportIssue').value;
            if (!issue.trim()) return alert("Mohon jelaskan masalahnya.");
            
            const btn = btnSubmit;
            btn.disabled = true;
            btn.innerText = "Mengirim...";

            try {
                const q = tgQuestions[tgIndex];
                
                const { error } = await supabase.from('question_reports').insert({
                    question_id: q.id,
                    question_type: 'shadow', // Since TG uses shadow_drills
                    user_id: currentUser.id,
                    jenjang: jenjang,
                    bab: parseInt(bab),
                    sub_bab: parseInt(sub),
                    issue_text: `[Training Ground] ${issue}`
                });

                if (error) throw error;

                alert("Laporan berhasil dikirim. Terima kasih!");
                const modalEl = document.getElementById('tgReportModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                document.getElementById('tgReportIssue').value = '';
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

initPage();