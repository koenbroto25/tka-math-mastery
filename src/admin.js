import { supabase } from './supabase.js';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm';
import * as mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/+esm';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// GEMINI CONFIG (Shared)
const GEMINI_API_KEY = "AIzaSyDqaUzrHqEwnR23PUBhsGIcjdC4WK58v2s";

let currentAdmin = null;

// 1. Forbidden Gate: Verify Admin Status
async function checkAdminAuth() {
    // SECURITY: This script should ONLY perform checks on the admin dashboard page.
    if (!window.location.pathname.includes('grandmaster-admin.html')) {
        console.log("Admin Guard: Inactive for this path.");
        return;
    }

    const overlay = document.getElementById('admin-loading-overlay');
    
    // Check session with a slight retry mechanism for stability
    let { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        // Wait 1.5s for session to hydrate (handling redirects)
        await new Promise(r => setTimeout(r, 1500));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
    }

    if (!session) {
        overlay.innerHTML = `
            <i class="bi bi-exclamation-octagon-fill text-danger fs-1"></i>
            <h3 class="mt-3 font-cinzel">Session Required</h3>
            <p>You must authenticate at the <a href="/grandmaster-portal.html" class="text-warning fw-bold">Grandmaster Portal</a> before entering the Citadel.</p>
            <a href="/dashboard.html" class="btn btn-outline-light mt-3">Back to Dashboard</a>
        `;
        return;
    }

    // Role Verification from Database
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, nama_lengkap')
        .eq('id', session.user.id)
        .single();

    if (error || !profile || profile.role !== 'admin') {
        overlay.innerHTML = `
            <i class="bi bi-shield-lock-fill text-danger fs-1"></i>
            <h3 class="mt-3 font-cinzel">Forbidden Entry</h3>
            <p>User <strong>${profile?.nama_lengkap || session.user.email}</strong> does not possess Admin privileges.</p>
            <a href="/dashboard.html" class="btn btn-outline-light mt-3">Return to Headquarters</a>
        `;
        return;
    }

    // Access Granted
    currentAdmin = session.user;
    overlay.classList.add('d-none');
    
    // Initialize Dashboard Modules
    loadDashboardStats();
    loadKingdomSettings();
    initMateriStructureLoader();
    initShadowForge(); // NEW: Shadow Forge Init
    initReportsModule();
    initPromptFilter();
}

// 1.b. Materi Structure Loader
let materiCache = { SD: [], SMP: [] };

async function initMateriStructureLoader() {
    // SCROLL FORGE DROPDOWNS
    const syncJenjang = document.getElementById('syncJenjang');
    const syncBab = document.getElementById('syncBab');
    
    // SHADOW FORGE DROPDOWNS
    const forgeJenjang = document.getElementById('forgeJenjang');
    const forgeBab = document.getElementById('forgeBab');

    if (syncJenjang) {
        syncJenjang.addEventListener('change', async () => {
            await handleJenjangChange(syncJenjang.value, 'sync');
        });
        syncBab.addEventListener('change', () => {
            populateSubDropdown(syncJenjang.value, syncBab.value, 'sync');
        });
    }

    if (forgeJenjang) {
        forgeJenjang.addEventListener('change', async () => {
            await handleJenjangChange(forgeJenjang.value, 'forge');
        });
        forgeBab.addEventListener('change', () => {
            populateSubDropdown(forgeJenjang.value, forgeBab.value, 'forge');
        });
    }

    // Handler for Refresh Reports
    document.getElementById('btnRefreshReports')?.addEventListener('click', loadReportsTable);

    // Initial Load
    await fetchAndParseMateri('SD'); // Preload SD defaults
    populateBabDropdown('SD', 'sync');
    populateBabDropdown('SD', 'forge');
    populatePromptFilter('SD');
}

async function handleJenjangChange(jenjang, prefix) {
    if (materiCache[jenjang].length === 0) {
        await fetchAndParseMateri(jenjang);
    }
    populateBabDropdown(jenjang, prefix);
}

// 1.c. Prompt Filter Logic
function initPromptFilter() {
    const promptJenjang = document.getElementById('promptJenjang');
    if (promptJenjang) {
        promptJenjang.addEventListener('change', () => {
            populatePromptFilter(promptJenjang.value);
        });
    }
}

async function populatePromptFilter(jenjang) {
    const container = document.getElementById('promptSubCheckboxes');
    if (!container) return;
    
    container.innerHTML = '<span class="text-muted small">Loading...</span>';
    
    if (materiCache[jenjang].length === 0) {
        await fetchAndParseMateri(jenjang);
    }

    container.innerHTML = '';
    const data = materiCache[jenjang];

    if (data.length === 0) {
        container.innerHTML = '<span class="text-danger small">No data found.</span>';
        return;
    }

    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'form-check form-check-inline bg-secondary bg-opacity-25 px-2 rounded';
        div.innerHTML = `
            <input class="form-check-input prompt-filter-cb" type="checkbox" id="pf_${item.bab}_${item.sub}" value="${item.bab}.${item.sub} ${item.title}">
            <label class="form-check-label small text-light" for="pf_${item.bab}_${item.sub}">${item.bab}.${item.sub} ${item.title}</label>
        `;
        container.appendChild(div);
    });
}

async function fetchAndParseMateri(jenjang) {
    // FIX: Encode URI components to handle spaces in folder/file names
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
            const textContent = link.innerText.trim(); // "1.1 Pecahan Senilai"
            const firstSpace = textContent.indexOf(' ');
            const numberPart = textContent.substring(0, firstSpace); // "1.1"
            const title = textContent.substring(firstSpace + 1); // "Pecahan Senilai"
            const [bab, sub] = numberPart.split('.').map(n => parseInt(n));
            return { bab, sub, title };
        }).filter(item => !isNaN(item.bab)); // Filter out valid items

    } catch (err) {
        console.error(`Failed to load ${jenjang} structure:`, err);
        alert(`Gagal memuat struktur materi ${jenjang}. Pastikan file HTML ada di folder yang benar.`);
    }
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
        option.value = bab;
        option.innerText = `Bab ${bab}`;
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
        option.value = item.sub;
        option.innerText = `${item.sub}. ${item.title}`;
        subSelect.appendChild(option);
    });
}

// 2. Load Real-time Stats
async function loadDashboardStats() {
    try {
        // Fetch User Count
        const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        document.getElementById('stat-users').innerText = userCount || 0;

        // Fetch Materi Count
        const { count: materiCount } = await supabase.from('materi').select('*', { count: 'exact', head: true });
        document.getElementById('stat-materi').innerText = materiCount || 0;

        // Fetch Teacher Count
        const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
        document.getElementById('stat-teachers').innerText = teacherCount || 0;

        // Fetch Pending Reports Count
        const { count: reportCount } = await supabase.from('question_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const count = reportCount || 0;
        document.getElementById('stat-reports').innerText = count;
        
        const badge = document.getElementById('badge-reports');
        if (badge) {
            badge.innerText = count;
            badge.classList.toggle('d-none', count === 0);
        }

    } catch (err) {
        console.error("Error loading stats:", err);
    }
}

// 2.b. Question Reports Logic
async function initReportsModule() {
    const reportsLink = document.querySelector('.nav-link[data-section="reports"]');
    if (reportsLink) {
        reportsLink.addEventListener('click', loadReportsTable);
    }
}

async function loadReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm"></div> Loading...</td></tr>';

    const { data, error } = await supabase
        .from('question_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No reports found. All clear!</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(r => {
        const date = new Date(r.created_at).toLocaleDateString('id-ID');
        const badgeColor = r.status === 'pending' ? 'bg-danger' : 'bg-success';
        const location = `${r.jenjang} - Bab ${r.bab}.${r.sub_bab}`;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td><span class="badge bg-secondary">${r.question_type.toUpperCase()}</span></td>
            <td>${location}</td>
            <td>${r.issue_text}</td>
            <td><span class="badge ${badgeColor}">${r.status}</span></td>
            <td>
                ${r.status === 'pending' ? 
                    `<button class="btn btn-xs btn-outline-success btn-resolve" data-id="${r.id}">Mark Fixed</button>` : 
                    '<span class="text-muted small"><i class="bi bi-check-all"></i> Done</span>'
                }
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach listeners to resolve buttons
    document.querySelectorAll('.btn-resolve').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (confirm("Mark this report as resolved?")) {
                await resolveReport(id);
            }
        });
    });
}

async function resolveReport(id) {
    const { error } = await supabase
        .from('question_reports')
        .update({ status: 'resolved' })
        .eq('id', id);

    if (error) {
        alert("Error updating report: " + error.message);
    } else {
        loadReportsTable(); // Refresh table
        loadDashboardStats(); // Refresh badge
    }
}

// --- SHADOW FORGE ENGINE (Interactive Video Editor) ---
let forgePlayer;
let activeMateriId = null;
let currentQuizzes = [];

function initShadowForge() {
    const btnLoad = document.getElementById('btnLoadForge');
    const btnCapture = document.getElementById('btnCaptureTime');
    const btnAdd = document.getElementById('btnAddQuiz');
    const btnSave = document.getElementById('btnSaveForge');

    if (btnLoad) btnLoad.addEventListener('click', loadForgeVideo);
    if (btnCapture) btnCapture.addEventListener('click', captureTimestamp);
    if (btnAdd) btnAdd.addEventListener('click', addQuizToTimeline);
    if (btnSave) btnSave.addEventListener('click', saveQuizConfigToDB);
    
    // Magic Auto-Forge Listener
    document.getElementById('btnMagicForge')?.addEventListener('click', runMagicAutoForge);

    // Load YouTube API
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

    // Fetch Video URL & Existing Config
    const { data, error } = await supabase
        .from('materi')
        .select('id, video_url, video_quiz_config')
        .eq('jenjang', jenjang)
        .eq('bab', parseInt(bab))
        .eq('sub_bab', parseInt(sub))
        .single();

    if (error || !data) return alert("Materi tidak ditemukan atau belum ada video.");
    
    activeMateriId = data.id;
    currentQuizzes = data.video_quiz_config || [];
    renderQuizTimeline();

    // Setup Video Player
    const videoUrl = data.video_url;
    let videoId = "";
    try {
        if (videoUrl.includes('youtu.be/')) videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
        else if (videoUrl.includes('/embed/')) videoId = videoUrl.split('/embed/')[1].split('?')[0];
        else if (videoUrl.includes('v=')) videoId = videoUrl.split('v=')[1].split('&')[0];
    } catch (e) {
        console.error("Error parsing video ID:", e);
    }

    if (!videoId) return alert("URL Video tidak valid.");

    document.getElementById('forgeWorkspace').classList.remove('d-none');
    
    if (forgePlayer) {
        forgePlayer.loadVideoById(videoId);
    } else {
        forgePlayer = new YT.Player('forgePlayerContainer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            events: {
                'onStateChange': onForgePlayerStateChange
            }
        });
    }
}

function onForgePlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        requestAnimationFrame(updateForgeTimer);
    }
}

function updateForgeTimer() {
    if (forgePlayer && forgePlayer.getCurrentTime) {
        const time = Math.floor(forgePlayer.getCurrentTime());
        const mins = Math.floor(time / 60).toString().padStart(2, '0');
        const secs = (time % 60).toString().padStart(2, '0');
        document.getElementById('forgeTimer').innerText = `${mins}:${secs}`;
        
        if (forgePlayer.getPlayerState() == YT.PlayerState.PLAYING) {
            requestAnimationFrame(updateForgeTimer);
        }
    }
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
    
    // Get Options
    const options = [];
    document.querySelectorAll('.quiz-opt').forEach(input => {
        if(input.value.trim()) options.push(input.value.trim());
    });

    if (isNaN(time)) return alert("Capture waktu dulu!");
    if (!question || options.length < 2) return alert("Isi pertanyaan dan minimal 2 opsi.");

    const newQuiz = {
        time: time,
        type: 'multiple-choice',
        question: question,
        options: options,
        answer: correctIdx,
        hint: hint || "Coba lagi ksatria!"
    };

    currentQuizzes.push(newQuiz);
    currentQuizzes.sort((a, b) => a.time - b.time); // Auto-sort by time
    renderQuizTimeline();
    
    // Reset Form
    document.getElementById('quizQuestion').value = '';
    document.getElementById('quizHint').value = '';
    document.querySelectorAll('.quiz-opt').forEach(i => i.value = '');
}

function renderQuizTimeline() {
    const tbody = document.getElementById('quizTimelineBody');
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
                <button class="btn btn-xs btn-danger" onclick="deleteQuiz(${idx})"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteQuiz = (idx) => {
    if(confirm("Hapus kuis ini?")) {
        currentQuizzes.splice(idx, 1);
        renderQuizTimeline();
    }
};

async function saveQuizConfigToDB() {
    if (!activeMateriId) return;
    
    const btn = document.getElementById('btnSaveForge');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    const { error } = await supabase
        .from('materi')
        .update({ video_quiz_config: currentQuizzes })
        .eq('id', activeMateriId);

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cloud-upload"></i> SAVE CHANGES TO DB';

    if (error) alert("Error saving: " + error.message);
    else alert("✅ Konfigurasi Kuis Berhasil Disimpan!");
}

// --- MAGIC AUTO-FORGE (AI Logic) ---
async function runMagicAutoForge() {
    const matFile = document.getElementById('forgeMaterialFile').files[0];
    const scriptFile = document.getElementById('forgeScriptFile').files[0];
    const status = document.getElementById('magicStatus');
    const btn = document.getElementById('btnMagicForge');

    if (!matFile || !scriptFile) {
        return alert("Mohon upload KEDUA file: Materi (PDF) dan Script Video (.txt)");
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> AI READING...';
        status.innerHTML = '<span class="text-info">1. Extracting Files...</span>';

        // 1. Read Files
        const materialText = await readFileContent(matFile);
        const scriptText = await readFileContent(scriptFile);

        status.innerHTML = '<span class="text-warning">2. Summoning Gemini Brain...</span>';

        // 2. Generate Prompt
        const prompt = `
ROLE: You are an Expert Educational Video Designer.
TASK: Create an interactive quiz timeline for a video based on the provided MATERIAL and SCRIPT.

INPUT 1: MATERIAL (Source of Knowledge)
${materialText.substring(0, 15000)}

INPUT 2: VIDEO SCRIPT (Source of Timing)
${scriptText.substring(0, 15000)}

INSTRUCTIONS:
1. Analyze the SCRIPT to understand the flow and timestamps (e.g., [SCENE 1] 00:00 - 00:06).
2. Create 3-5 Multiple Choice Quizzes based on the MATERIAL.
3. Map each quiz to the END of the relevant scene in the SCRIPT.
   - Example: If Scene 2 explains "Ratio Definition" and ends at 00:12, place the quiz at 12 seconds.
4. Output STRICTLY as a JSON Array. No markdown formatting.

JSON FORMAT:
[
  {
    "time": 24, 
    "type": "multiple-choice",
    "question": "Question text...",
    "options": ["A", "B", "C"],
    "answer": 0, // Index of correct option (0, 1, 2)
    "hint": "Hint if wrong..."
  }
]
`;

        // 3. Call Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!aiText) throw new Error("AI silent.");

        // 4. Parse JSON
        const jsonMatch = aiText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("Invalid AI Format.");
        
        const newQuizzes = JSON.parse(jsonMatch[0]);
        
        // 5. Update UI
        currentQuizzes = newQuizzes;
        renderQuizTimeline();
        
        status.innerHTML = `<span class="text-success fw-bold">✨ Success! ${newQuizzes.length} Quizzes Generated. Review & Save.</span>`;

    } catch (err) {
        console.error(err);
        status.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-magic"></i> RUN MAGIC SYNC';
    }
}

async function readFileContent(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + "\n";
        }
        return fullText;
    } else if (ext === 'txt') {
        return await file.text();
    } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value;
    }
    return "";
}

// 3. AI JSON Sync Logic (Enhanced with Filters)
const btnSync = document.getElementById('btnSync');
const jsonInput = document.getElementById('jsonInput');
const syncStatus = document.getElementById('syncStatus');

btnSync.addEventListener('click', async () => {
    const rawData = jsonInput.value.trim();
    const syncJenjang = document.getElementById('syncJenjang').value; 
    const syncBab = document.getElementById('syncBab').value;
    const syncSub = document.getElementById('syncSub').value;
    const syncType = document.getElementById('syncType').value;       
    const syncMode = document.getElementById('syncMode').value;       

    if (!rawData) return alert("Paste JSON first!");
    // Validate Selection
    if (!syncBab || !syncSub) return alert("Mohon pilih Bab dan Sub-bab dari dropdown untuk memastikan akurasi data.");

    try {
        syncStatus.innerHTML = '<div class="text-info">⏳ Processing Scroll Forge...</div>';
        const data = JSON.parse(rawData);
        
        // --- AUTO-CORRECT METADATA ---
        // Overwrite JSON metadata with Dropdown selections to prevent manual errors
        data.jenjang = syncJenjang;
        data.bab = parseInt(syncBab);
        data.sub_bab = parseInt(syncSub);
        // -----------------------------

        // --- VALIDATION ---
        if (data.jenjang && data.jenjang.toUpperCase() !== syncJenjang) {
            throw new Error(`JSON Jenjang (${data.jenjang}) mismatch with Filter (${syncJenjang})`);
        }

        // --- 1. SINKRONISASI MATERI ---
        if (syncType === 'materi') {
            const materiData = data.materi || data;
            const { error: materiError } = await supabase
                .from('materi')
                .upsert({
                    jenjang: syncJenjang,
                    bab: parseInt(materiData.bab),
                    sub_bab: parseInt(materiData.sub_bab),
                    judul: materiData.judul,
                    konten_html: materiData.konten_html,
                    video_url: materiData.video_url || ''
                }, { onConflict: 'jenjang,bab,sub_bab' });

            if (materiError) throw new Error("Materi Sync Error: " + materiError.message);
        }

        // --- 2. SINKRONISASI SOAL (BULK) ---
        else {
            // KHUSUS SHADOW TRAINING (TABEL BARU)
            if (syncType === 'shadow') {
                const drills = Array.isArray(data) ? data : (data.drills || []);
                if (drills.length === 0) throw new Error("Format JSON Salah. Harus Array of Objects.");

                if (syncMode === 'overwrite') {
                    await supabase.from('shadow_drills')
                        .delete()
                        .eq('jenjang', syncJenjang)
                        .eq('bab', parseInt(syncBab))
                        .eq('sub_bab', parseInt(syncSub));
                }

                const drillsToInsert = drills.map(d => ({
                    jenjang: syncJenjang,
                    bab: parseInt(syncBab),
                    sub_bab: parseInt(syncSub),
                    pertanyaan: d.pertanyaan,
                    teknik_hint: d.hint_teknik || d.hint || "Teknik Dasar",
                    langkah_1: d.langkah_1,
                    langkah_2: d.langkah_2,
                    langkah_3: d.langkah_3,
                    jawaban_akhir: d.jawaban_akhir,
                    is_trial: d.is_trial || false
                }));

                const { error: drillError } = await supabase.from('shadow_drills').insert(drillsToInsert);
                if (drillError) throw new Error("Shadow Drill Sync Error: " + drillError.message);

            } else {
                // SINKRONISASI SOAL BIASA (GUARDIAN / RIFT)
                const exerciseType = syncType === 'guardian' ? 'std' : 'kum';
                const questions = data.questions || (Array.isArray(data) ? data : []);
                
                if (questions.length === 0) throw new Error("No questions array found in JSON!");
    
                if (syncMode === 'overwrite') {
                    await supabase.from('questions')
                        .delete()
                        .eq('jenjang', syncJenjang)
                        .eq('bab', parseInt(syncBab))
                        .eq('sub_bab', parseInt(syncSub))
                        .eq('tipe_latihan', exerciseType);
                }
    
                const questionsToInsert = questions.map(q => {
                    const payload = {
                        jenjang: syncJenjang,
                        bab: parseInt(syncBab),
                        sub_bab: parseInt(syncSub),
                        tipe_latihan: exerciseType,
                        pertanyaan: q.text || q.pertanyaan,
                        opsi_jawaban: JSON.stringify(q.options || q.opsi_jawaban),
                        kunci_jawaban: JSON.stringify(q.answer || q.kunci_jawaban),
                        difficulty: q.difficulty || (syncType === 'rift' ? 'L3' : 'L2'),
                        hint: q.hint || '',
                        question_type: q.type || 'single'
                    };
                    return payload;
                });
    
                const { error: qError } = await supabase.from('questions').insert(questionsToInsert);
                if (qError) throw new Error("Questions Sync Error: " + qError.message);
            }
        }

        syncStatus.innerHTML = `<div class="text-success">✅ Sync Success: [${syncJenjang}] ${syncType.toUpperCase()}</div>`;
        loadDashboardStats();

    } catch (err) {
        console.error("Sync Error:", err);
        syncStatus.innerHTML = `<div class="text-danger">❌ Sync Failed: ${err.message}</div>`;
    }
});

// 3.b. Quick Video Updater (Specific for Materi)
const syncTypeSelect = document.getElementById('syncType');
const videoPanel = document.getElementById('videoQuickUpdatePanel');
const btnUpdateVideo = document.getElementById('btnUpdateVideoOnly');

if (syncTypeSelect && videoPanel) {
    // Function to toggle visibility
    const toggleVideoPanel = () => {
        if (syncTypeSelect.value === 'materi') {
            videoPanel.classList.remove('d-none');
        } else {
            videoPanel.classList.add('d-none');
        }
    };

    // Listen for changes
    syncTypeSelect.addEventListener('change', toggleVideoPanel);
    
    // Check initial state immediately
    toggleVideoPanel();
}

if (btnUpdateVideo) {
    btnUpdateVideo.addEventListener('click', async () => {
        const jenjang = document.getElementById('syncJenjang').value;
        const bab = document.getElementById('syncBab').value;
        const sub = document.getElementById('syncSub').value;
        const rawUrl = document.getElementById('quickVideoUrl').value.trim();
        const btn = btnUpdateVideo;

        if (!bab || !sub) return alert("Mohon pilih Bab dan Sub-bab terlebih dahulu.");
        if (!rawUrl) return alert("Mohon masukkan Link YouTube.");

        // Sanitize URL to Embed Format
        // Supports: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
        let videoId = '';
        try {
            if (rawUrl.includes('youtu.be/')) {
                videoId = rawUrl.split('youtu.be/')[1].split('?')[0];
            } else if (rawUrl.includes('watch?v=')) {
                videoId = rawUrl.split('watch?v=')[1].split('&')[0];
            } else if (rawUrl.includes('/embed/')) {
                videoId = rawUrl.split('/embed/')[1].split('?')[0];
            } else {
                // Assume raw ID if length is 11
                if(rawUrl.length === 11) videoId = rawUrl;
            }

            if (!videoId || videoId.length !== 11) throw new Error("Format URL YouTube tidak dikenali.");
            
            const finalEmbedUrl = `https://www.youtube.com/embed/${videoId}`;
            
            // Execute Update
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';
            btn.disabled = true;

            const { error } = await supabase
                .from('materi')
                .update({ video_url: finalEmbedUrl })
                .eq('jenjang', jenjang)
                .eq('bab', parseInt(bab))
                .eq('sub_bab', parseInt(sub));

            if (error) throw error;

            alert(`✅ Video Berhasil Diupdate!\n\nJenjang: ${jenjang}\nBab: ${bab}.${sub}\nURL: ${finalEmbedUrl}`);
            document.getElementById('quickVideoUrl').value = ''; // Clear input

        } catch (err) {
            console.error(err);
            alert("❌ Gagal Update Video: " + err.message);
        } finally {
            btn.innerHTML = '<i class="bi bi-save"></i> UPDATE VIDEO';
            btn.disabled = false;
        }
    });
}

// 4. Kingdom Settings Management
async function loadKingdomSettings() {
    const { data: settings } = await supabase.from('site_settings').select('*');
    if (!settings) return;

    settings.forEach(s => {
        if (s.key === 'branding') {
            document.getElementById('set-app-name').value = s.value.app_name;
            document.getElementById('set-primary-color').value = s.value.primary_color;
            document.getElementById('set-secondary-color').value = s.value.secondary_color;
        } else if (s.key === 'b2b_config') {
            document.getElementById('set-enable-marketplace').checked = s.value.enable_marketplace;
            document.getElementById('set-enable-social').checked = s.value.enable_social_share;
            document.getElementById('set-maintenance').checked = s.value.maintenance_mode;
        } else if (s.key === 'html_injections') {
            document.getElementById('set-ad-header').value = s.value.ad_space_header;
            document.getElementById('set-landing-html').value = s.value.landing_hero_text;
            document.getElementById('set-custom-css').value = s.value.custom_css;
        } else if (s.key === 'game_logic') {
            document.getElementById('set-xp-mult').value = s.value.xp_multiplier;
            document.getElementById('set-min-score').value = s.value.min_pass_score;
        }
    });
}

document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
    const saveStatus = document.getElementById('saveStatus');
    saveStatus.innerHTML = '<div class="text-info">⏳ Casting Spell (Saving)...</div>';

    try {
        const updates = [
            {
                key: 'branding',
                value: {
                    app_name: document.getElementById('set-app-name').value,
                    primary_color: document.getElementById('set-primary-color').value,
                    secondary_color: document.getElementById('set-secondary-color').value
                }
            },
            {
                key: 'b2b_config',
                value: {
                    enable_marketplace: document.getElementById('set-enable-marketplace').checked,
                    enable_social_share: document.getElementById('set-enable-social').checked,
                    maintenance_mode: document.getElementById('set-maintenance').checked
                }
            },
            {
                key: 'html_injections',
                value: {
                    ad_space_header: document.getElementById('set-ad-header').value,
                    landing_hero_text: document.getElementById('set-landing-html').value,
                    custom_css: document.getElementById('set-custom-css').value
                }
            },
            {
                key: 'game_logic',
                value: {
                    xp_multiplier: parseFloat(document.getElementById('set-xp-mult').value),
                    min_pass_score: parseInt(document.getElementById('set-min-score').value)
                }
            }
        ];

        for (const update of updates) {
            const { error } = await supabase.from('site_settings').upsert(update);
            if (error) throw error;
        }

        saveStatus.innerHTML = '<div class="text-success">✅ Kingdom Settings Applied Globally!</div>';
    } catch (err) {
        saveStatus.innerHTML = `<div class="text-danger">❌ Save Failed: ${err.message}</div>`;
    }
});

// 4. God Mode / Simulation Logic
function enterSimulationMode(simRole, simJenjang = null) {
    // We save the simulation role in session storage
    sessionStorage.setItem('god_mode_role', simRole);
    if (simJenjang) {
        sessionStorage.setItem('god_mode_jenjang', simJenjang);
    } else {
        sessionStorage.removeItem('god_mode_jenjang');
    }
    // Redirect to dashboard with the simulated view
    window.location.href = '/dashboard.html';
}

document.getElementById('btnSimStudentSD')?.addEventListener('click', () => enterSimulationMode('student', 'SD'));
document.getElementById('btnSimStudentSMP')?.addEventListener('click', () => enterSimulationMode('student', 'SMP'));
document.getElementById('btnSimTeacher')?.addEventListener('click', () => enterSimulationMode('teacher'));
document.getElementById('btnSimParent')?.addEventListener('click', () => enterSimulationMode('parent'));

// 5. Prompt Library Logic
const PROMPTS = {
    // --- STICKMAN FORGE (SD) ---
    'video-gemini-sd': `JOSEPHS AI (MODIFIED FOR TKA MATH SD)

TASK: Generate a complete Stickman Whiteboard Video script based on the **uploaded PDF material**.

OUTPUT SHOULD INCLUDE:

PART 1: VIDEO SCRIPT (Indonesian Slang - SD Style)
- Write a short, engaging voiceover narration in Indonesian (Bahasa Gaul anak SD: "W Rizz", "No Cap", "GG").
- Divide the script into scenes based on the material logic (flexible duration).
- Mention what the stickman is doing, thinking, or expressing in each scene.

PART 2: IMAGE PROMPTS (PARAGRAPH STYLE - FOR GEMINI/STABLE DIFFUSION)
- For each scene, write a simple paragraph describing the stickman image.
- **CRITICAL RULE**: Begin each paragraph with: "**Use the character from the uploaded reference image.**" (Assume I have uploaded a stickman reference image).
- Describe: Pose, Action, Expression, Props (Whiteboard, Pizza, Numbers, etc.), Background (Plain White).
- Example: "Use the character from the uploaded reference image. He is standing near a whiteboard pointing at a giant pizza slice. His expression is excited. The background is plain white."

RULES TO FOLLOW:
- The stickman character must remain identical to the reference image across all scenes.
- Math formulas must be described as clearly visible on the whiteboard/props.`,

    'video-grok-sd': `PART 3: VIDEO / MOTION PROMPTS (FOR GROK)

INPUT: [PASTE GEMINI IMAGE PROMPTS HERE]

TASK: For each scene, give short, simple instructions for animation.
- **CRITICAL RULE**: Only animate arms, head, or props; body stays the same.
- Include facial expressions and small actions.
- Example: "Move stickman's arm pointing at the pizza slice, calm motion, body static. Make the pizza slice glow."`,

    // --- STICKMAN FORGE (SMP) ---
    'video-gemini-smp': `JOSEPHS AI (MODIFIED FOR TKA MATH SMP)

TASK: Generate a complete Strategic Dashboard Video script based on the **uploaded PDF material**.

OUTPUT SHOULD INCLUDE:

PART 1: VIDEO SCRIPT (Indonesian Slang - SMP/Gamer Style)
- Write a short, tactical voiceover narration in Indonesian (Bahasa Gaming: "Meta", "OP", "Skill Issue", "Logic Check").
- Divide the script into scenes based on the material logic (flexible duration).
- Context: A tactical briefing room or smart whiteboard.

PART 2: IMAGE PROMPTS (PARAGRAPH STYLE - FOR GEMINI/STABLE DIFFUSION)
- For each scene, write a simple paragraph describing the stickman image.
- **CRITICAL RULE**: Begin each paragraph with: "**Use the character from the uploaded reference image.**" (Assume I have uploaded a Commander Stickman reference image).
- Describe: Pose, Action, Expression, Props (Tactical Board, Graphs, Arrows), Background (Plain or subtle grid).
- Example: "Use the character from the uploaded reference image. He is analyzing a graph on the tactical board. He looks focused. Red strategy arrows connect the numbers."

RULES TO FOLLOW:
- The stickman character must remain identical to the reference image across all scenes.
- Math formulas must be the central focus of the tactical board.`,

    'video-grok-smp': `PART 3: VIDEO / MOTION PROMPTS (FOR GROK)

INPUT: [PASTE GEMINI IMAGE PROMPTS HERE]

TASK: For each scene, give short, simple instructions for animation.
- **CRITICAL RULE**: Only animate arms, head, or props; body stays the same.
- Focus on the "Tactical" feel: Glitch effects on text, arrows moving, graphs rising.
- Example: "Move stickman's hand tracing the graph line. Make the strategy arrow blink red. Body static."`,

    // --- LEGACY PROMPTS ---
    'video-sd': `(LEGACY) Gunakan teks materi terlampir untuk membuat Video Overview singkat... [Isi lama tetap disimpan]`,
    'video-smp': `(LEGACY) Gunakan teks materi terlampir untuk membuat Video Overview taktis... [Isi lama tetap disimpan]`,

    // --- EXERCISE PROMPTS (BSKAP 2025 COMPLIANT) ---
    
    // --- SHADOW TRAINING (GUIDED) ---
    'soal-shadow-sd': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SD/MI berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **13 Paket Shadow Training** (Guided Drill) berdasarkan **[LIST SUB-BAB YANG DIPILIH]**.

KORIDOR MATERI:
1. Topik Utama: [LIST SUB-BAB YANG DIPILIH]. Identifikasi Nama Materi dan Standar Cakupan dari topik tersebut. **Wajib identifikasi Nama Materi dan Standar Kompetensi dari isi file yang diunggah jika ada.**
2. Anda boleh mencari referensi tambahan dari basis pengetahuan Anda, namun tetap wajib berada di dalam koridor materi tersebut.

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas untuk gaya bahasa (Tone), format kalimat (Phrasing), dan model pengecoh (Distractor). Pastikan output memiliki 'Rasa TKA' yang sama persis (Bahasa Baku).

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Sesuai topik materi yang dipilih.
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Menghitung rutin, mengidentifikasi objek, atau membaca informasi langsung dari tabel/grafik.
   - **L2 (Applying)**: Memodelkan masalah kontekstual ke kalimat matematika atau menerapkan rumus pada situasi rutin yang familiar.
   - **L3 (Reasoning)**: Menganalisis hubungan antar konsep, memecahkan masalah non-rutin, mengevaluasi strategi, atau menarik kesimpulan valid.
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Konteks Soal: Gunakan konteks keseharian yang relevan dengan anak SD (personal, keluarga, atau lingkungan sekitar).

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array. Gunakan nama field persis seperti ini:
[
  {
    "pertanyaan": "Teks soal...",
    "hint_teknik": "Nama teknik/jurus...",
    "langkah_1": "Panduan langkah 1...",
    "langkah_2": "Panduan langkah 2...",
    "langkah_3": "Panduan langkah 3...",
    "jawaban_akhir": "Jawaban final...",
    "is_trial": boolean // (true untuk 3 soal pertama, false untuk sisanya)
  }
]`,

    'soal-shadow-smp': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SMP/MTs berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **13 Paket Shadow Training** berdasarkan **[LIST SUB-BAB YANG DIPILIH]**.

KORIDOR MATERI:
1. Topik Utama: [LIST SUB-BAB YANG DIPILIH]. Identifikasi Nama Materi dan Standar Cakupan dari topik tersebut. **Wajib identifikasi Nama Materi dan Standar Kompetensi dari isi file yang diunggah jika ada.**
2. AI boleh mencari referensi luar namun wajib dalam koridor materi tersebut.

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas (Tone, Phrasing, Distractor). Bahasa Baku TKA.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Sesuai topik materi yang dipilih.
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Operasi aritmetika/aljabar rutin dan identifikasi konsep matematika dasar.
   - **L2 (Applying)**: Memodelkan situasi nyata dan mengaplikasikan strategi matematika pada masalah yang familiar.
   - **L3 (Reasoning)**: Memecahkan masalah situasi baru (non-rutin), melakukan generalisasi, atau mengevaluasi solusi.
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Karakteristik Soal: Soal harus mengintegrasikan logika matematika dalam elemen materi dan menggunakan stimulus berupa teks informasi atau grafik/diagram (soal grup/tunggal). Gunakan konteks lokal, nasional, atau global.

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array. Gunakan nama field persis seperti ini:
[
  {
    "pertanyaan": "Teks soal...",
    "hint_teknik": "Nama teknik/jurus...",
    "langkah_1": "Panduan langkah 1...",
    "langkah_2": "Panduan langkah 2...",
    "langkah_3": "Panduan langkah 3...",
    "jawaban_akhir": "Jawaban final...",
    "is_trial": boolean // (true untuk 3 soal pertama, false untuk sisanya)
  }
]`,

    // --- GUARDIAN SKIRMISH (STANDARD) ---
    'soal-guardian-sd': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SD/MI berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **30 Soal Guardian Skirmish** (Standard Battle) berdasarkan **[LIST SUB-BAB YANG DIPILIH]**.

KORIDOR MATERI:
1. Topik Utama: [LIST SUB-BAB YANG DIPILIH].
2. **AI wajib mengidentifikasi Nama Materi dan Standar Kompetensi dari isi file yang diunggah jika ada.** Gunakan sebagai acuan utama.

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas untuk gaya bahasa (Tone), format kalimat (Phrasing), dan model pengecoh (Distractor). Pastikan output memiliki 'Rasa TKA' yang baku dan presisi.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Sesuai topik materi yang dipilih.
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Menghitung rutin, mengidentifikasi objek, atau membaca informasi langsung dari tabel/grafik.
   - **L2 (Applying)**: Memodelkan masalah kontekstual ke kalimat matematika atau menerapkan rumus pada situasi rutin yang familiar.
   - **L3 (Reasoning)**: Menganalisis hubungan antar konsep, memecahkan masalah non-rutin, mengevaluasi strategi, atau menarik kesimpulan valid.
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Konteks Soal: Gunakan konteks keseharian yang relevan dengan anak SD (personal atau keluarga).

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array valid. Gunakan nama field persis seperti ini (Case Sensitive):
[
  {
    "pertanyaan": "String (Teks soal lengkap)",
    "difficulty": "String (Pilih: 'L1', 'L2', atau 'L3')",
    "question_type": "String (Pilih: 'single', 'mcma', atau 'kategori')",
    "opsi_jawaban": {
      // FORMAT 'single' ATAU 'mcma':
      "A": "Teks A", "B": "Teks B", "C": "Teks C", "D": "Teks D"
      // FORMAT 'kategori':
      // "pernyataan": ["P1", "P2", "P3"],
      // "kategori": ["Benar", "Salah"]
    },
    "kunci_jawaban": "String/Array (Single: 'A', MCMA: ['A','C'], Kategori: ['Benar','Salah','Benar'])",
    "hint": "String (Opsional)"
  }
]`,

    'soal-guardian-smp': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SMP/MTs berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **30 Soal Guardian Skirmish** berdasarkan **[LIST SUB-BAB YANG DIPILIH]**.

KORIDOR MATERI:
1. Topik Utama: [LIST SUB-BAB YANG DIPILIH]. Identifikasi Nama Materi dan Standar Cakupan dari topik tersebut. **Wajib identifikasi Nama Materi dan Standar Kompetensi dari isi file yang diunggah jika ada.**

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas (Tone, Phrasing, Distractor). Bahasa Baku TKA Mutlak.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Sesuai topik materi yang dipilih.
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Operasi aritmetika/aljabar rutin dan identifikasi konsep matematika dasar.
   - **L2 (Applying)**: Memodelkan situasi nyata dan mengaplikasikan strategi matematika pada masalah yang familiar.
   - **L3 (Reasoning)**: Memecahkan masalah situasi baru (non-rutin), melakukan generalisasi, atau mengevaluasi solusi.
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Karakteristik Soal: Gunakan stimulus berupa teks informasi, grafik, atau diagram. Konteks lokal/nasional/global.

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array valid. Gunakan nama field persis seperti ini (Case Sensitive):
[
  {
    "pertanyaan": "String (Teks soal lengkap dengan stimulus)",
    "difficulty": "String (Pilih: 'L1', 'L2', atau 'L3')",
    "question_type": "String (Pilih: 'single', 'mcma', atau 'kategori')",
    "opsi_jawaban": {
      // FORMAT 'single' ATAU 'mcma':
      "A": "Teks A", "B": "Teks B", "C": "Teks C", "D": "Teks D"
      // FORMAT 'kategori':
      // "pernyataan": ["P1", "P2", "P3"],
      // "kategori": ["Benar", "Salah"]
    },
    "kunci_jawaban": "String/Array (Single: 'A', MCMA: ['A','C'], Kategori: ['Benar','Salah','Benar'])",
    "hint": "String (Opsional)"
  }
]`,

    // --- THE TIME RIFT (CUMULATIVE) ---
    'soal-rift-sd': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SD/MI berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **40 Soal The Time Rift (Kumulatif)** berdasarkan **[LIST SUB-BAB YANG DIPILIH]**.

KORIDOR MATERI:
1. Materi utama: [LIST SUB-BAB YANG DIPILIH]. **Wajib identifikasi Nama Materi dan Standar Kompetensi dari isi file yang diunggah jika ada.**
2. Campurkan dengan konsep dari sub-bab sebelumnya untuk efek kumulatif.

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas (Tone, Phrasing, Distractor). Bahasa Baku TKA Mutlak.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Gabungan materi saat ini + materi sebelumnya (Kumulatif).
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Menghitung rutin, mengidentifikasi objek, atau membaca informasi langsung dari tabel/grafik.
   - **L2 (Applying)**: Memodelkan masalah kontekstual ke kalimat matematika atau menerapkan rumus pada situasi rutin yang familiar.
   - **L3 (Reasoning)**: Menganalisis hubungan antar konsep, memecahkan masalah non-rutin, mengevaluasi strategi, atau menarik kesimpulan valid. (FOKUS UTAMA: Min 50%)
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar. (PERBANYAK INI)
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan. (PERBANYAK INI)
D. Konteks Soal: Gunakan konteks keseharian yang relevan dengan anak SD.

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array valid. Gunakan nama field persis seperti ini (Case Sensitive):
[
  {
    "pertanyaan": "String (Teks soal lengkap)",
    "difficulty": "String (Pilih: 'L1', 'L2', atau 'L3')",
    "question_type": "String (Pilih: 'single', 'mcma', atau 'kategori')",
    "opsi_jawaban": {
      // FORMAT 'single' ATAU 'mcma':
      "A": "Teks A", "B": "Teks B", "C": "Teks C", "D": "Teks D"
      // FORMAT 'kategori':
      // "pernyataan": ["P1", "P2", "P3"],
      // "kategori": ["Benar", "Salah"]
    },
    "kunci_jawaban": "String/Array (Single: 'A', MCMA: ['A','C'], Kategori: ['Benar','Salah','Benar'])",
    "hint": "String (Opsional)"
  }
]`,

    'soal-rift-smp': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SMP/MTs berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **40 Soal The Time Rift (Kumulatif)** berdasarkan **[LIST SUB-BAB YANG DIPILIH]**.

KORIDOR MATERI:
1. Materi utama: [LIST SUB-BAB YANG DIPILIH]. **Wajib identifikasi Nama Materi dan Standar Kompetensi dari isi file yang diunggah jika ada.**
2. Campurkan secara lintas topik dengan materi sebelumnya.

REFERENSI GAYA (GOLD STANDARD):
Bahasa Baku Akademik Mutlak. Pengecoh (Distractor) masuk akal.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Gabungan materi saat ini + materi sebelumnya (Kumulatif).
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Operasi aritmetika/aljabar rutin dan identifikasi konsep matematika dasar.
   - **L2 (Applying)**: Memodelkan situasi nyata dan mengaplikasikan strategi matematika pada masalah yang familiar.
   - **L3 (Reasoning)**: Memecahkan masalah situasi baru (non-rutin), melakukan generalisasi, atau mengevaluasi solusi. (FOKUS UTAMA: Min 50%)
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Stimulus: Wajib gunakan Data Infografis, Artikel, atau Kasus Nyata yang kompleks.

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array valid. Gunakan nama field persis seperti ini (Case Sensitive):
[
  {
    "pertanyaan": "String (Teks soal lengkap dengan stimulus)",
    "difficulty": "String (Pilih: 'L1', 'L2', atau 'L3')",
    "question_type": "String (Pilih: 'single', 'mcma', atau 'kategori')",
    "opsi_jawaban": {
      // FORMAT 'single' ATAU 'mcma':
      "A": "Teks A", "B": "Teks B", "C": "Teks C", "D": "Teks D"
      // FORMAT 'kategori':
      // "pernyataan": ["P1", "P2", "P3"],
      // "kategori": ["Benar", "Salah"]
    },
    "kunci_jawaban": "String/Array (Single: 'A', MCMA: ['A','C'], Kategori: ['Benar','Salah','Benar'])",
    "hint": "String (Opsional)"
  }
]`,

    // --- TKA OFFICIAL SIMULATION (ANCIENT DRAGON) ---
    'simulasi-sd': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SD/MI berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **40 Soal Simulasi TKA Lengkap (Ancient Dragon Siege)** berdasarkan **seluruh cakupan materi SD**.

KORIDOR MATERI:
Ini adalah Simulasi Ujian Akhir. Cakupan materi meliputi seluruh domain: Bilangan, Geometri & Pengukuran, dan Data.
(Opsional: Fokus pada [LIST SUB-BAB YANG DIPILIH] jika dispesifikasikan).

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas. Tone resmi ujian, sangat presisi, dan pengecoh yang kuat.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Distribusi merata ke seluruh bab materi TKA SD.
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Menghitung rutin, mengidentifikasi objek, atau membaca informasi langsung dari tabel/grafik. (20%)
   - **L2 (Applying)**: Memodelkan masalah kontekstual ke kalimat matematika atau menerapkan rumus pada situasi rutin yang familiar. (50%)
   - **L3 (Reasoning)**: Menganalisis hubungan antar konsep, memecahkan masalah non-rutin, mengevaluasi strategi, atau menarik kesimpulan valid. (30%)
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Konteks Soal: Variatif (Personal, Sosial Budaya, Saintifik).

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array valid. Gunakan nama field persis seperti ini (Case Sensitive):
[
  {
    "pertanyaan": "String (Teks soal lengkap)",
    "difficulty": "String (Pilih: 'L1', 'L2', atau 'L3')",
    "question_type": "String (Pilih: 'single', 'mcma', atau 'kategori')",
    "opsi_jawaban": {
      // FORMAT 'single' ATAU 'mcma':
      "A": "Teks A", "B": "Teks B", "C": "Teks C", "D": "Teks D"
      // FORMAT 'kategori':
      // "pernyataan": ["P1", "P2", "P3"],
      // "kategori": ["Benar", "Salah"]
    },
    "kunci_jawaban": "String/Array (Single: 'A', MCMA: ['A','C'], Kategori: ['Benar','Salah','Benar'])",
    "hint": "String (Opsional)"
  }
]`,

    'simulasi-smp': `Bertindaklah sebagai ahli pembuat soal Tes Kemampuan Akademik (TKA) tingkat SMP/MTs berdasarkan standar Peraturan Kepala BSKAP No. 047/H/AN/2025. 

TUJUAN: Buatlah **40 Soal Simulasi TKA Lengkap (Ancient Dragon Siege)** berdasarkan **seluruh cakupan materi SMP**.

KORIDOR MATERI:
Ini adalah Simulasi Ujian Akhir. Cakupan materi meliputi seluruh domain: Bilangan, Aljabar, Geometri, Data & Peluang.
(Opsional: Fokus pada [LIST SUB-BAB YANG DIPILIH] jika dispesifikasikan).

REFERENSI GAYA (GOLD STANDARD):
Gunakan file "CONTOH SIMULASI SOAL" sebagai standar emas. Tone resmi ujian, sangat presisi, dan pengecoh yang kuat.

KETENTUAN BSKAP 2025:
A. Cakupan Materi: Distribusi merata ke seluruh bab materi TKA SMP.
B. Standar Level Kognitif (Wajib ada ketiga variasi ini):
   - **L1 (Knowing/Understanding)**: Operasi aritmetika/aljabar rutin dan identifikasi konsep matematika dasar. (20%)
   - **L2 (Applying)**: Memodelkan situasi nyata dan mengaplikasikan strategi matematika pada masalah yang familiar. (50%)
   - **L3 (Reasoning)**: Memecahkan masalah situasi baru (non-rutin), melakukan generalisasi, atau mengevaluasi solusi. (30%)
C. Variasi Bentuk Soal (Gunakan ketiganya):
   1. **Pilihan Ganda Sederhana**: Satu jawaban benar.
   2. **Pilihan Ganda Kompleks (MCMA)**: Peserta memilih lebih dari satu jawaban benar.
   3. **Pilihan Ganda Kompleks (Kategori)**: Menentukan 'Benar/Salah' atau 'Sesuai/Tidak Sesuai' pada beberapa pernyataan.
D. Karakteristik Soal: Wajib menggunakan stimulus kompleks (Infografis, Teks Panjang, Data Tabel). Konteks: Personal, Sosial Budaya, Saintifik.

STRUKTUR OUTPUT (WAJIB JSON ARRAY):
Hasilkan output HANYA dalam format JSON Array valid. Gunakan nama field persis seperti ini (Case Sensitive):
[
  {
    "pertanyaan": "String (Teks soal lengkap)",
    "difficulty": "String (Pilih: 'L1', 'L2', atau 'L3')",
    "question_type": "String (Pilih: 'single', 'mcma', atau 'kategori')",
    "opsi_jawaban": {
      // FORMAT 'single' ATAU 'mcma':
      "A": "Teks A", "B": "Teks B", "C": "Teks C", "D": "Teks D"
      // FORMAT 'kategori':
      // "pernyataan": ["P1", "P2", "P3"],
      // "kategori": ["Benar", "Salah"]
    },
    "kunci_jawaban": "String/Array (Single: 'A', MCMA: ['A','C'], Kategori: ['Benar','Salah','Benar'])",
    "hint": "String (Opsional)"
  }
]`,
};

window.copyPrompt = (key) => {
    const area = document.getElementById('promptPreviewArea');
    const text = document.getElementById('promptText');
    const title = document.getElementById('promptTitle');
    
    area.classList.remove('d-none');
    
    let rawPrompt = PROMPTS[key] || "Prompt not found.";
    
    // INJECT FILTERED SUB-BABS
    const checkboxes = document.querySelectorAll('.prompt-filter-cb:checked');
    const selectedTopics = Array.from(checkboxes).map(cb => cb.value).join(', ');
    
    // DEFAULT TEXT if no filter selected (to keep prompt valid for manual upload)
    const defaultTopicText = "file materi yang diunggah (atau materi yang relevan)";
    const topicsToUse = selectedTopics.length > 0 ? selectedTopics : defaultTopicText;
    
    // DYNAMIC REPLACEMENT
    // Replaces [LIST SUB-BAB YANG DIPILIH] in TUJUAN and KORIDOR MATERI
    rawPrompt = rawPrompt.replace(/\[LIST SUB-BAB YANG DIPILIH\]/g, topicsToUse);
    
    // Also replace legacy placeholders just in case
    rawPrompt = rawPrompt.replace(/\[NAMA SUB-BAB\]/g, topicsToUse);
    
    // If topics ARE selected, we also replace the old static phrases "file materi yang diunggah" 
    // to be "materi berikut: [TOPICS]" for extra clarity, although the new templates use the placeholder directly.
    if (selectedTopics.length > 0) {
        rawPrompt = rawPrompt.replace(/file materi yang diunggah|file materi yang saya upload/g, `materi berikut: ${selectedTopics}`);
    }

    text.innerText = rawPrompt;
    title.innerText = key.toUpperCase().replace(/-/g, ' ');
    
    // Auto Scroll to preview
    area.scrollIntoView({ behavior: 'smooth' });
};

window.copyToClipboard = (str) => {
    navigator.clipboard.writeText(str).then(() => {
        alert("✨ Prompt successfully copied to your scroll (clipboard)!");
    });
};

checkAdminAuth();