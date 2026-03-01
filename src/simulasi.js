import { supabase } from './supabase.js';

const urlParams = new URLSearchParams(window.location.search);
const jenjang = urlParams.get('jenjang');
const paket = urlParams.get('sub'); // stage 1-5

let currentUser = null;
let questions = [];
let currentIndex = 0;
let userAnswers = {}; // { index: answer }
let flagged = new Set();
let timeLimit = 120 * 60; // 120 minutes for simulation
let timerInterval;

async function initSimulasi() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '/auth.html';
    currentUser = session.user;

    document.getElementById('exam-title').innerText = `SIMULASI TKA ${jenjang.toUpperCase()} - PAKET ${paket}`;
    
    // Fetch Questions for this specific packet
    const targetBab = jenjang.toLowerCase() === 'sd' ? 4 : 5;
    
    const { data, error } = await supabase.from('questions')
        .select('*')
        .eq('jenjang', jenjang)
        .eq('bab', targetBab)
        .eq('sub_bab', paket)
        .order('id', { ascending: true });

    if (error || !data || data.length === 0) {
        document.getElementById('wadahSoal').innerHTML = '<h4 class="text-center mt-5">Soal simulasi belum tersedia.</h4>';
        return;
    }

    questions = data;
    setupReportSystem();
    renderNav();
    renderQuestion(0);
    startTimer();
}

function renderNav() {
    const navGrid = document.getElementById('question-nav');
    navGrid.innerHTML = '';
    questions.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.innerText = i + 1;
        btn.id = `nav-btn-${i}`;
        btn.onclick = () => renderQuestion(i);
        navGrid.appendChild(btn);
    });
}

function renderQuestion(index) {
    currentIndex = index;
    const q = questions[index];
    
    // Update active button
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-btn-${index}`).classList.add('active');

    document.getElementById('question-number').innerText = `SOAL NO ${index + 1}`;
    
    let html = `<div class="q-text">${q.pertanyaan}</div>`;
    
    let opsi = typeof q.opsi_jawaban === 'string' ? JSON.parse(q.opsi_jawaban) : q.opsi_jawaban;
    html += `<div class="options">`;
    opsi.forEach((choice) => {
        const letter = choice.split('.')[0].trim();
        const isSelected = userAnswers[index] === letter.toLowerCase();
        html += `
            <div class="option-item ${isSelected ? 'selected' : ''}" onclick="window.selectSimOption('${letter.toLowerCase()}')">
                <span class="option-label">${letter}</span>
                <span class="option-text">${choice.substring(choice.indexOf('.') + 1)}</span>
            </div>
        `;
    });
    html += `</div>`;
    
    document.getElementById('wadahSoal').innerHTML = html;

    // Refresh KaTeX
    if (window.renderMathInElement) {
        renderMathInElement(document.getElementById('wadahSoal'), {
            delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
            throwOnError: false
        });
    }
}

window.selectSimOption = (letter) => {
    userAnswers[currentIndex] = letter;
    const btn = document.getElementById(`nav-btn-${currentIndex}`);
    btn.classList.add('answered');
    renderQuestion(currentIndex);
};

function startTimer() {
    timerInterval = setInterval(() => {
        timeLimit--;
        const mins = Math.floor(timeLimit / 60);
        const secs = timeLimit % 60;
        document.getElementById('timer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timeLimit <= 0) finishExam();
    }, 1000);
}

document.getElementById('btnNext').onclick = () => {
    if (currentIndex < questions.length - 1) renderQuestion(currentIndex + 1);
};

document.getElementById('btnPrev').onclick = () => {
    if (currentIndex > 0) renderQuestion(currentIndex - 1);
};

document.getElementById('btnFlag').onclick = () => {
    const btn = document.getElementById(`nav-btn-${currentIndex}`);
    if (flagged.has(currentIndex)) {
        flagged.delete(currentIndex);
        btn.classList.remove('flagged');
    } else {
        flagged.add(currentIndex);
        btn.classList.add('flagged');
    }
};

document.getElementById('btnFinish').onclick = () => {
    if (confirm("Sudah selesai mengerjakan? Semua jawaban akan dikirim.")) {
        finishExam();
    }
};

async function finishExam() {
    clearInterval(timerInterval);
    
    let correctCount = 0;
    questions.forEach((q, i) => {
        let kunci = typeof q.kunci_jawaban === 'string' ? JSON.parse(q.kunci_jawaban) : q.kunci_jawaban;
        if (userAnswers[i] === kunci[0].toLowerCase()) correctCount++;
    });

    const score = Math.round((correctCount / questions.length) * 100);
    
    // Save Result
    await supabase.from('progress').insert({
        user_id: currentUser.id,
        jenjang: jenjang,
        bab: (jenjang === 'sd' ? 4 : 5),
        sub_bab: parseInt(paket),
        tipe_latihan: 'simulasi',
        skor: score,
        waktu_pengerjaan: (120 * 60) - timeLimit
    });

    alert(`Simulasi Selesai!\nSkor Anda: ${score}\nKembali ke Dashboard.`);
    window.location.href = '/dashboard.html';
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
                const q = questions[currentIndex];
                const targetBab = jenjang.toLowerCase() === 'sd' ? 4 : 5;
                
                const { error } = await supabase.from('question_reports').insert({
                    question_id: q.id,
                    question_type: 'simulasi',
                    user_id: currentUser.id,
                    jenjang: jenjang,
                    bab: targetBab,
                    sub_bab: parseInt(paket),
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

initSimulasi();