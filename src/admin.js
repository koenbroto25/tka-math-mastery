import { supabase } from './supabase.js';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm';
import * as mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/+esm';
import { initVideoAutomator } from './video-automator.js';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

let currentAdmin = null;

// 1. Forbidden Gate: Verify Admin Status
async function checkAdminAuth() {
    if (!window.location.pathname.includes('grandmaster-admin.html')) return;
    const overlay = document.getElementById('admin-loading-overlay');
    
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        await new Promise(r => setTimeout(r, 1500));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
    }

    if (!session) {
        overlay.innerHTML = `
            <div class="text-center">
                <i class="bi bi-exclamation-octagon-fill text-danger fs-1"></i>
                <h3 class="mt-3 font-cinzel">Session Required</h3>
                <p>You must authenticate at the <a href="/grandmaster-portal.html" class="text-warning fw-bold">Grandmaster Portal</a>.</p>
            </div>
        `;
        return;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, nama_lengkap')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        overlay.innerHTML = `<h3 class="mt-3 font-cinzel text-danger text-center">Forbidden Entry</h3>`;
        return;
    }

    currentAdmin = session.user;
    overlay.classList.add('d-none');
    
    // Initialize All Modules
    loadDashboardStats();
    loadKingdomSettings();
    initMateriStructureLoader();
    initShadowForge();
    initReportsModule();
    initPromptLibrary();
    initVideoAutomator();
    initScrollForge();
    initSimulationHub();
    initLogout();
}

// 1.b. Materi Structure Loader (Shared for Forge, Sync, Teleport)
let materiCache = { SD: [], SMP: [] };
async function initMateriStructureLoader() {
    const prefixes = ['forge', 'sync', 'tele'];
    prefixes.forEach(prefix => {
        const jenjangEl = document.getElementById(`${prefix}Jenjang`);
        const babEl = document.getElementById(`${prefix}Bab`);
        if (jenjangEl) {
            jenjangEl.addEventListener('change', async () => {
                await handleJenjangChange(jenjangEl.value, prefix);
            });
        }
        if (babEl) {
            babEl.addEventListener('change', () => {
                populateSubDropdown(jenjangEl.value, babEl.value, prefix);
            });
        }
    });

    await fetchAndParseMateri('SD');
    populateBabDropdown('SD', 'forge');
    populateBabDropdown('SD', 'sync');
    populateBabDropdown('SD', 'tele');
}

async function handleJenjangChange(jenjang, prefix) {
    if (materiCache[jenjang].length === 0) await fetchAndParseMateri(jenjang);
    populateBabDropdown(jenjang, prefix);
}

async function fetchAndParseMateri(jenjang) {
    const url = jenjang === 'SD' 
        ? '/ringkasan%20materi/rangkuman%20materi%20tka%20matematika%20SD.html'
        : '/ringkasan%20materi/SMP/rangkuman%20materi%20tka%20matematika%20SMP.html';
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('File not found');
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = Array.from(doc.querySelectorAll('.nav-item'));
        materiCache[jenjang] = links.map(link => {
            const textContent = link.innerText.trim();
            const firstSpace = textContent.indexOf(' ');
            const numberPart = textContent.substring(0, firstSpace);
            const title = textContent.substring(firstSpace + 1);
            const [bab, sub] = numberPart.split('.').map(n => parseInt(n));
            return { bab, sub, title };
        }).filter(item => !isNaN(item.bab));
    } catch (err) { console.error(err); }
}

function populateBabDropdown(jenjang, prefix) {
    const babSelect = document.getElementById(`${prefix}Bab`);
    const subSelect = document.getElementById(`${prefix}Sub`);
    if(!babSelect || !subSelect) return;
    babSelect.innerHTML = '<option value="" disabled selected>Select Bab...</option>';
    subSelect.innerHTML = '<option value="" disabled selected>Select Sub...</option>';
    const data = materiCache[jenjang];
    const uniqueBabs = [...new Set(data.map(item => item.bab))].sort((a, b) => a - b);
    uniqueBabs.forEach(bab => {
        const option = document.createElement('option');
        option.value = bab; option.innerText = `Bab ${bab}`;
        babSelect.appendChild(option);
    });
}

function populateSubDropdown(jenjang, bab, prefix) {
    const subSelect = document.getElementById(`${prefix}Sub`);
    if(!subSelect) return;
    subSelect.innerHTML = '<option value="" disabled selected>Select Sub...</option>';
    const data = materiCache[jenjang].filter(item => item.bab == bab).sort((a, b) => a.sub - b.sub);
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.sub; option.innerText = `${item.sub}. ${item.title}`;
        subSelect.appendChild(option);
    });
}

// 2. Dashboard Stats
async function loadDashboardStats() {
    try {
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        document.getElementById('stat-users').innerText = userCount || 0;
        const { count: materiCount } = await supabase.from('materi').select('*', { count: 'exact', head: true });
        document.getElementById('stat-materi').innerText = materiCount || 0;
        
        const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
        document.getElementById('stat-teachers').innerText = teacherCount || 0;

        const { count: reportCount } = await supabase.from('question_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        document.getElementById('stat-reports').innerText = reportCount || 0;
    } catch (err) { console.error(err); }
}

// --- SHADOW FORGE ENGINE (Interactive Video Editor) ---
let forgePlayer;
let activeMateriId = null;
let currentQuizzes = [];
let editingQuizIdx = null;
let lastTriggeredTime = -1;

function initShadowForge() {
    const btnLoad = document.getElementById('btnLoadForge');
    const btnCapture = document.getElementById('btnCaptureTime');
    const btnAdd = document.getElementById('btnAddQuiz');
    const btnSave = document.getElementById('btnSaveForge');

    if (btnLoad) btnLoad.addEventListener('click', loadForgeVideo);
    if (btnCapture) btnCapture.addEventListener('click', captureTimestamp);
    if (btnAdd) btnAdd.addEventListener('click', addQuizToTimeline);
    if (btnSave) btnSave.addEventListener('click', saveQuizConfigToDB);
    
    document.getElementById('btnMagicForge')?.addEventListener('click', runMagicAutoForge);

    if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
}

async function loadForgeVideo() {
    const jenjang = document.getElementById('forgeJenjang').value;
    const bab = document.getElementById('forgeBab').value;
    const sub = document.getElementById('forgeSub').value;
    if (!bab || !sub) return alert("Pilih materi lengkap!");

    const { data, error } = await supabase.from('materi').select('id, video_url, video_quiz_config').eq('jenjang', jenjang).eq('bab', parseInt(bab)).eq('sub_bab', parseInt(sub)).single();
    if (error || !data) return alert("Materi tidak ditemukan!");
    
    activeMateriId = data.id;
    currentQuizzes = data.video_quiz_config || [];
    renderQuizTimeline();

    const videoUrl = data.video_url;
    let videoId = "";
    try {
        if (videoUrl.includes('youtu.be/')) videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
        else if (videoUrl.includes('/embed/')) videoId = videoUrl.split('/embed/')[1].split('?')[0];
        else if (videoUrl.includes('v=')) videoId = videoUrl.split('v=')[1].split('&')[0];
    } catch (e) { console.error(e); }

    if (!videoId) return alert("URL Video tidak valid.");
    document.getElementById('forgeWorkspace').classList.remove('d-none');
    
    if (forgePlayer && forgePlayer.loadVideoById) {
        forgePlayer.loadVideoById(videoId);
        // Important: Retry rendering markers until duration is available
        setTimeout(renderTimelineMarkers, 2000);
    } else {
        forgePlayer = new YT.Player('forgePlayerContainer', {
            height: '100%', width: '100%', videoId: videoId,
            events: {
                'onReady': () => setTimeout(renderTimelineMarkers, 1000),
                'onStateChange': onForgePlayerStateChange
            }
        });
    }
}

function onForgePlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        requestAnimationFrame(updateForgeTimer);
        renderTimelineMarkers(); // Ensure markers are rendered when play starts
    }
    // Try rendering on other state changes too, just in case
    if (event.data != YT.PlayerState.UNSTARTED) renderTimelineMarkers();
}

function updateForgeTimer() {
    if (forgePlayer && forgePlayer.getCurrentTime) {
        const currentTime = forgePlayer.getCurrentTime();
        const time = Math.floor(currentTime);
        
        const duration = forgePlayer.getDuration();
        if (duration > 0) {
            const progressBar = document.getElementById('forgeTimelineProgress');
            if (progressBar) progressBar.style.width = `${(currentTime / duration) * 100}%`;
        }

        const mins = Math.floor(time / 60).toString().padStart(2, '0');
        const secs = (time % 60).toString().padStart(2, '0');
        document.getElementById('forgeTimer').innerText = `${mins}:${secs}`;

        if (time !== lastTriggeredTime) {
            const activeQuiz = currentQuizzes.find(q => q.time === time);
            if (activeQuiz) {
                highlightTimelineRow(time);
                triggerQuizPreview(activeQuiz);
            }
            lastTriggeredTime = time;
        }
        
        if (forgePlayer.getPlayerState() == YT.PlayerState.PLAYING) {
            requestAnimationFrame(updateForgeTimer);
        }
    }
}

function triggerQuizPreview(quiz) {
    if (!forgePlayer) return;
    forgePlayer.pauseVideo();

    const overlay = document.getElementById('videoQuizOverlay');
    if (!overlay) return;

    const qText = document.getElementById('vq-question');
    const qOptions = document.getElementById('vq-options');
    const qFeedback = document.getElementById('vq-feedback');
    
    // Admin preview allows closing, but we simulate the student experience first
    const closeBtn = overlay.querySelector('button.btn-outline-light');
    if (closeBtn) closeBtn.classList.add('d-none'); // Hide initially

    if (qText) qText.innerText = quiz.question;
    if (qOptions) {
        qOptions.innerHTML = '';
        quiz.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-warning text-start fw-bold py-2';
            btn.innerText = opt;
            const isCorrect = idx === quiz.answer;
            btn.onclick = () => {
                if (qFeedback) {
                    qFeedback.classList.remove('d-none');
                    if (isCorrect) {
                        btn.className = 'btn btn-success text-start fw-bold py-2';
                        qFeedback.innerHTML = '<span class="text-success">✨ TEPAT! (Preview)</span>';
                        // Auto resume after correct
                        setTimeout(() => {
                            overlay.classList.add('d-none');
                            overlay.classList.remove('d-flex');
                            forgePlayer.playVideo();
                        }, 1500);
                        if (closeBtn) closeBtn.classList.remove('d-none');
                    } else {
                        btn.className = 'btn btn-danger text-start fw-bold py-2';
                        qFeedback.innerHTML = `<span class="text-danger">❌ SALAH. Petunjuk: ${quiz.hint}</span>`;
                    }
                }
            };
            qOptions.appendChild(btn);
        });
    }
    
    if (qFeedback) qFeedback.classList.add('d-none');
    overlay.classList.remove('d-none');
    overlay.classList.add('d-flex');
}

function highlightTimelineRow(time) {
    const rows = document.querySelectorAll('#quizTimelineBody tr');
    rows.forEach(row => {
        const badge = row.querySelector('td .badge');
        if (!badge) return;
        const [m, s] = badge.innerText.split(':').map(Number);
        const rowSeconds = (m * 60) + s;
        if (rowSeconds === time) {
            row.classList.add('table-primary');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => row.classList.remove('table-primary'), 2000);
        } else row.classList.remove('table-primary');
    });
}

function captureTimestamp() {
    if (!forgePlayer) return;
    forgePlayer.pauseVideo();
    const time = Math.floor(forgePlayer.getCurrentTime());
    document.getElementById('quizTime').value = time;
}

function addQuizToTimeline() {
    const time = parseInt(document.getElementById('quizTime').value);
    const question = document.getElementById('quizQuestion').value;
    const correctIdx = parseInt(document.getElementById('quizCorrect').value);
    const hint = document.getElementById('quizHint').value;
    const options = [];
    document.querySelectorAll('.quiz-opt').forEach(input => {
        if(input.value.trim()) options.push(input.value.trim());
    });

    if (isNaN(time)) return alert("Capture waktu dulu!");
    if (!question || options.length < 2) return alert("Isi pertanyaan dan minimal 2 opsi.");

    const quizData = { time, type: 'multiple-choice', question, options, answer: correctIdx, hint: hint || "Coba lagi ksatria!" };

    if (editingQuizIdx !== null) {
        currentQuizzes[editingQuizIdx] = quizData;
        editingQuizIdx = null;
        document.getElementById('btnAddQuiz').innerHTML = '<i class="bi bi-plus-circle"></i> ADD TO TIMELINE';
        document.getElementById('btnCancelEdit')?.classList.add('d-none');
    } else currentQuizzes.push(quizData);

    currentQuizzes.sort((a, b) => a.time - b.time);
    renderQuizTimeline();
    resetQuizForm();
}

function resetQuizForm() {
    document.getElementById('quizTime').value = '';
    document.getElementById('quizQuestion').value = '';
    document.getElementById('quizHint').value = '';
    document.getElementById('quizCorrect').value = '0';
    document.querySelectorAll('.quiz-opt').forEach(i => i.value = '');
    editingQuizIdx = null;
    document.getElementById('btnAddQuiz').innerHTML = '<i class="bi bi-plus-circle"></i> ADD TO TIMELINE';
    document.getElementById('btnCancelEdit')?.classList.add('d-none');
}

function renderQuizTimeline() {
    const tbody = document.getElementById('quizTimelineBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    currentQuizzes.forEach((q, idx) => {
        const tr = document.createElement('tr');
        const mins = Math.floor(q.time / 60).toString().padStart(2, '0');
        const secs = (q.time % 60).toString().padStart(2, '0');
        tr.innerHTML = `
            <td><span class="badge bg-secondary">${mins}:${secs}</span></td>
            <td>${q.question}</td>
            <td>${q.options[q.answer]}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-xs btn-warning" onclick="editQuiz(${idx})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-xs btn-danger" onclick="deleteQuiz(${idx})"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    // Ensure markers are rendered whenever the table is updated
    renderTimelineMarkers();
}

// CRITICAL: Robust marker rendering
function renderTimelineMarkers() {
    const container = document.getElementById('forgeTimeline');
    if (!container || !forgePlayer || !forgePlayer.getDuration) return;
    
    const duration = forgePlayer.getDuration();
    if (!duration || duration <= 0) {
        // Retry logic: if duration not ready, wait 500ms and try again
        console.log("Timeline: Waiting for video duration...");
        setTimeout(renderTimelineMarkers, 500);
        return;
    }
    
    console.log(`Timeline: Rendering ${currentQuizzes.length} markers for ${duration}s video.`);
    
    // Clear existing markers (keep progress bar)
    const markers = container.querySelectorAll('.quiz-marker');
    markers.forEach(m => m.remove());
    
    currentQuizzes.forEach((q, idx) => {
        const marker = document.createElement('div');
        marker.className = 'quiz-marker';
        marker.dataset.idx = idx;
        
        const mins = Math.floor(q.time / 60).toString().padStart(2, '0');
        const secs = (q.time % 60).toString().padStart(2, '0');
        marker.setAttribute('data-time', `${mins}:${secs}`);
        
        const pos = (q.time / duration) * 100;
        marker.style.left = `${pos}%`;
        
        // DRAG LOGIC
        marker.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            marker.classList.add('dragging');
            forgePlayer.pauseVideo();
            
            const onMouseMove = (moveEvent) => {
                const rect = container.getBoundingClientRect();
                let x = moveEvent.clientX - rect.left;
                x = Math.max(0, Math.min(x, rect.width));
                
                const newPct = x / rect.width;
                const newTime = Math.floor(newPct * duration);
                
                q.time = newTime;
                marker.style.left = `${newPct * 100}%`;
                
                const nm = Math.floor(newTime / 60).toString().padStart(2, '0');
                const ns = (newTime % 60).toString().padStart(2, '0');
                marker.setAttribute('data-time', `${nm}:${ns}`);
                
                // Aggressive Drag Sync: Auto-select and update form
                if (editingQuizIdx !== idx) {
                     editQuiz(idx);
                }
                document.getElementById('quizTime').value = newTime;
            };
            
            const onMouseUp = () => {
                marker.classList.remove('dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // Re-sort quizzes and re-render everything
                currentQuizzes.sort((a, b) => a.time - b.time);
                renderQuizTimeline();
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        // Click to seek
        marker.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            forgePlayer.seekTo(q.time); 
        });
        
        container.appendChild(marker);
    });
}

// Timeline click to seek (general bar click)
document.getElementById('forgeTimeline')?.addEventListener('click', (e) => {
    if (!forgePlayer || !forgePlayer.getDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    forgePlayer.seekTo(pct * forgePlayer.getDuration());
});

window.editQuiz = (idx) => {
    const q = currentQuizzes[idx];
    editingQuizIdx = idx;
    document.getElementById('quizTime').value = q.time;
    document.getElementById('quizQuestion').value = q.question;
    document.getElementById('quizHint').value = q.hint;
    document.getElementById('quizCorrect').value = q.answer;
    const optInputs = document.querySelectorAll('.quiz-opt');
    q.options.forEach((opt, i) => { if (optInputs[i]) optInputs[i].value = opt; });
    document.getElementById('btnAddQuiz').innerHTML = '<i class="bi bi-check-circle"></i> UPDATE QUIZ';
    document.getElementById('btnCancelEdit')?.classList.remove('d-none');
    document.querySelector('.card-citadel.bg-dark.border-gold').scrollIntoView({ behavior: 'smooth' });
};

window.deleteQuiz = (idx) => {
    if(confirm("Hapus kuis ini?")) { currentQuizzes.splice(idx, 1); renderQuizTimeline(); }
};

async function saveQuizConfigToDB() {
    if (!activeMateriId) return;
    const btn = document.getElementById('btnSaveForge');
    btn.disabled = true; btn.innerHTML = 'Saving...';
    const { error } = await supabase.from('materi').update({ video_quiz_config: currentQuizzes }).eq('id', activeMateriId);
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-upload"></i> SAVE CHANGES TO DB';
    if (error) alert("Error saving: " + error.message);
    else alert("✅ Konfigurasi Kuis Berhasil Disimpan!");
}

async function runMagicAutoForge() {
    const matFile = document.getElementById('forgeMaterialFile').files[0];
    const scriptFile = document.getElementById('forgeScriptFile').files[0];
    const status = document.getElementById('magicStatus');
    const btn = document.getElementById('btnMagicForge');
    if (!matFile || !scriptFile) return alert("Mohon upload KEDUA file!");
    try {
        btn.disabled = true; btn.innerHTML = 'AI READING...';
        const materialText = await readFileContent(matFile);
        const scriptText = await readFileContent(scriptFile);
        
        // Updated Prompt: 5 Quizzes (2 Theory + 3 Problems)
        // Context Injection for Better Accuracy
        const prompt = `
        ROLE: Expert Interactive Learning Designer.
        
        CONTEXT MATERI (SUMBER SOAL):
        """${materialText.substring(0, 15000)}"""

        CONTEXT SCRIPT VIDEO (TIMING REFERENSI):
        """${scriptText.substring(0, 5000)}"""

        TASK:
        Buatlah EXACTLY 5 kuis pilihan ganda interaktif berdasarkan MATERI di atas.
        Gunakan SCRIPT VIDEO untuk memperkirakan waktu (detik ke-berapa) pertanyaan muncul yang relevan dengan narasi.
        
        DISTRIBUSI KUIS:
        - Quiz 1-2: THEORY CHECK (Konsep dasar).
        - Quiz 3-5: PROBLEM RE-ASK (Variasi angka dari contoh soal di materi).

        OUTPUT JSON ARRAY ONLY (No Markdown, No Text):
        [
          {
            "time": number (seconds, estimasi dari script), 
            "type": "multiple-choice", 
            "question": "string (Bahasa Indonesia)", 
            "options": ["A", "B", "C"], 
            "answer": int (0-2), 
            "hint": "string (Saran jika salah)"
          }
        ]
        `;
        
        const { data, error } = await supabase.functions.invoke('gemini-proxy', { body: { prompt, model: 'gemini-2.5-pro' } });
        if (error) throw error;
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("Invalid Format.");
        currentQuizzes = JSON.parse(jsonMatch[0]);
        renderQuizTimeline();
        setTimeout(renderTimelineMarkers, 1000);
        status.innerHTML = `<span class="text-success">✨ Generated ${currentQuizzes.length} Quizzes.</span>`;
    } catch (err) { status.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`; }
    finally { btn.disabled = false; btn.innerHTML = 'RUN MAGIC SYNC'; }
}

async function readFileContent(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + "\\n";
        }
        return text;
    } else if (ext === 'txt') return await file.text();
    else if (ext === 'docx') {
        const ab = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: ab });
        return res.value;
    }
    return "";
}

// 3. Scroll Forge (AI Sync)
async function initScrollForge() {
    const btnSync = document.getElementById('btnSync');
    const jsonInput = document.getElementById('jsonInput');
    const syncStatus = document.getElementById('syncStatus');
    if (!btnSync) return;

    btnSync.addEventListener('click', async () => {
        const rawJson = jsonInput.value.trim();
        const type = document.getElementById('syncType').value;
        const jenjang = document.getElementById('syncJenjang').value;
        const bab = parseInt(document.getElementById('syncBab').value);
        const sub = parseInt(document.getElementById('syncSub').value);
        if (!rawJson) return alert("Paste JSON first!");

        try {
            btnSync.disabled = true;
            const data = JSON.parse(rawJson);
            const items = Array.isArray(data) ? data : [data];
            let table = (type === 'materi') ? 'materi' : (type === 'shadow' ? 'shadow_drills' : 'questions');

            for (const item of items) {
                if (jenjang) item.jenjang = jenjang;
                if (bab) item.bab = bab;
                if (sub) item.sub_bab = sub;
                const { error } = await supabase.from(table).upsert(item);
                if (error) throw error;
            }
            syncStatus.innerHTML = `<span class="text-success">✅ Success!</span>`;
            loadDashboardStats();
        } catch (err) { syncStatus.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`; }
        finally { btnSync.disabled = false; }
    });
}

// 4. Kingdom Settings
async function loadKingdomSettings() {
    const btnSave = document.getElementById('btnSaveSettings');
    if (!btnSave) return;
    
    try {
        const { data } = await supabase.from('site_settings').select('*').eq('key', 'kingdom_config').single();
        if (data) {
            const c = data.value;
            document.getElementById('set-app-name').value = c.appName || "";
        }
    } catch (e) {}

    btnSave.addEventListener('click', async () => {
        const config = { appName: document.getElementById('set-app-name').value };
        const { error } = await supabase.from('site_settings').upsert({ key: 'kingdom_config', value: config });
        if (error) alert(error.message);
        else alert("✅ Settings Updated!");
    });
}

// 5. Prompt Library
function initPromptLibrary() {
    window.copyPrompt = (id) => {
        const area = document.getElementById('promptPreviewArea');
        const text = document.getElementById('promptText');
        area.classList.remove('d-none');
        text.innerText = "Prompt content for " + id + " loaded from memory bank logic...";
    };
    window.copyToClipboard = (txt) => { navigator.clipboard.writeText(txt); alert("Copied!"); };
}

// 6. Reports Module
async function initReportsModule() {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;
    const { data } = await supabase.from('question_reports').select('*').limit(10).order('created_at', { ascending: false });
    if (data) {
        tbody.innerHTML = '';
        data.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${new Date(r.created_at).toLocaleDateString()}</td><td>${r.question_type}</td><td>${r.issue_text}</td><td>${r.status}</td>`;
            tbody.appendChild(tr);
        });
    }
}

// 7. Simulation Hub (God Mode - Omni Gate)
function initSimulationHub() {
    const teleportBtn = document.getElementById('btnTeleport');
    if (teleportBtn) {
        teleportBtn.addEventListener('click', () => {
            const j = document.getElementById('teleJenjang').value;
            const b = document.getElementById('teleBab').value;
            const s = document.getElementById('teleSub').value;
            if(!b || !s) return alert("Pilih misi!");
            sessionStorage.setItem('god_mode_role', 'student');
            window.open(`/materi.html?jenjang=${j}&bab=${b}&sub=${s}`, '_blank');
        });
    }
    document.getElementById('btnSimStudentSD')?.addEventListener('click', () => {
        sessionStorage.setItem('god_mode_role', 'student');
        window.open('/dashboard.html', '_blank');
    });
    document.getElementById('btnSimStudentSMP')?.addEventListener('click', () => {
        sessionStorage.setItem('god_mode_role', 'student');
        window.open('/dashboard.html', '_blank');
    });
}

// 8. Logout
function initLogout() {
    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/grandmaster-portal.html';
    });
}

checkAdminAuth();