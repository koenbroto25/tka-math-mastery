import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm';
import * as mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/+esm';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// --- GOOGLE AI CONFIG ---
const GEMINI_API_KEY = "AIzaSyDqaUzrHqEwnR23PUBhsGIcjdC4WK58v2s";

// DOM Elements
const dom = {
    title: document.getElementById('vaTitle'),
    mode: document.getElementById('vaMode'),
    style: document.getElementById('vaStyle'),
    apiKey: document.getElementById('vaApiKey'), // Optional now
    fileInput: document.getElementById('vaFileInput'),
    btnGenerate: document.getElementById('btnGeneratePrompt'),
    errorMsg: document.getElementById('vaErrorMsg'),
    output: document.getElementById('vaOutput'),
    btnCopy: document.getElementById('btnCopyPrompt'),
    fileStatus: document.getElementById('fileStatus'),
    sceneCountDisplay: document.getElementById('vaSceneCount'),
    durationDisplay: document.getElementById('vaTotalDuration')
};

let fileContent = "";

// 1. Initialize Listeners
export function initVideoAutomator() {
    if (!dom.btnGenerate) return; 

    dom.fileInput.addEventListener('change', handleFileUpload);
    dom.btnGenerate.addEventListener('click', generatePrompt);
    dom.btnCopy.addEventListener('click', copyToClipboard);

    // Placeholder for API Key UI to show it's handled internally
    if (dom.apiKey) {
        dom.apiKey.placeholder = "⚡ Managed by Multi-Key Rotation System (29 Keys)";
        dom.apiKey.disabled = true;
    }
}

// 2. Handle File Uploads (Multi-Format)
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    dom.fileStatus.innerText = "⏳ Extracting content...";

    // Auto-extract Title
    if (!dom.title.value || dom.title.value === "") {
        const filename = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        dom.title.value = filename;
    }

    try {
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
            fileContent = fullText;
            
        } else if (ext === 'txt' || ext === 'html') {
            fileContent = await file.text();
            
        } else if (ext === 'docx' || ext === 'doc') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            fileContent = result.value;
            
        } else {
            throw new Error("Format file tidak didukung!");
        }

        const wordCount = fileContent.split(/\s+/).length;
        dom.fileStatus.innerText = `✅ Extracted ${wordCount} words`;
        calculateSceneEstimation(wordCount);

    } catch (err) {
        console.error("File Error:", err);
        dom.fileStatus.innerText = "❌ Gagal baca file: " + err.message;
    }
}

function calculateSceneEstimation(wordCount) {
    // Info only - actual count determined by AI based on completeness
    const mode = dom.mode.value;
    // Rough estimate: 150 words -> 1 minute -> ~10 scenes (Grok)
    const estimatedScenes = Math.ceil((wordCount / 150) * 10);
    dom.sceneCountDisplay.innerText = `Est. Scenes: ~${estimatedScenes} (Full Coverage)`;
}

// 3. Generate Prompt (Call OpenRouter with Rotation)
async function generatePrompt() {
    const title = dom.title.value.trim();
    const mode = dom.mode.value;
    const style = dom.style.value;
    
    if (!title) {
        dom.errorMsg.innerText = "Judul film wajib diisi!";
        return;
    }
    
    if (!fileContent) {
        dom.errorMsg.innerText = "Mohon upload materi terlebih dahulu.";
        return;
    }

    dom.errorMsg.innerText = "";
    dom.btnGenerate.disabled = true;
    dom.btnGenerate.innerHTML = '<span class="spinner-border spinner-border-sm"></span> AI Thinking...';
    dom.output.value = "";

    // CONFIGURATION
    const durationPerScene = mode === 'GROK' ? 6 : 10;
    
    const systemInstruction = `
ROLE: You are an expert AI Video Prompt Engineer for Grok.
TASK: Create a detailed, scene-by-scene video generation prompt based on the provided text material.

### 1. CORE MISSION: 100% CONTENT COVERAGE (CRITICAL)
- **NO SHORTCUTS**: You MUST explain 100% of the provided material.
- **STEP-BY-STEP DECOMPOSITION**: Break down every single mathematical step into its own scene.
- **SCENE COUNT**: Generate as many scenes as necessary. DO NOT limit the number of scenes.

### 2. BLUEPRINT DEFINITIONS (CRITICAL)
You must use these EXACT descriptions for every scene.

**CHARACTER BLUEPRINT**:
"CHARACTER BLUEPRINT: A minimalist 2D black stickman 'Si Penunjuk' on a clean white background. HEAD: Perfect large circle with a crisp thin black outline. HAIR: Exactly 3 very thin curved strands growing from the top-center of the head, pointing upwards. EYES: Two identical solid black vertical oval dots positioned in the upper-middle of the face. MOUTH: A very wide, thin black crescent smile reaching near the edges of the face. BODY ANATOMY: A single continuous skeleton with no floating parts. TORSO: A single, straight vertical black line. ARMS: Two single thin lines originating directly from the top of the torso line. LEGS: Two single thin lines originating directly from the bottom of the torso line. HANDS/FEET: Small solid black ovals. STYLE: Ultra-clean 2D Vector Line Art, High Contrast, No shading, No gradients, Flat design. POSE: Character stands strictly on the LEFT (30% Zone), with BOTH arms extended towards the right to present the content."

**TYPOGRAPHY BLUEPRINT**:
"TYPOGRAPHY BLUEPRINT: Text must be rendered as SHARP 4K VECTOR DIGITAL FONT (Sans-Serif or Monospace). COLOR: Solid Black with High Contrast. AVOID: No Handwriting, No Chalkboard effects, No Pixelation. LAYOUT: Text appears strictly in the RIGHT 70% Zone. MOTION: Text must NOT be static. Use 'Pop-in', 'Typewriter', or 'Smooth Slide-up' animation effects that synchronize with the Stickman's pointing gesture. SPACING: Ensure generous whitespace between lines to prevent clutter."

**NEGATIVE PROMPT**:
"NEGATIVE PROMPT: handwriting, blurry text, pixelated text, low resolution, messy lines, sketching style, shading, gradients, 3D effects, shadow, background noise, paper texture, chalkboard texture, overlapping text, cut off text, watermark, signature, disfigured, extra limbs, floating body parts."

### 3. LAYOUT & ACCURACY PROTOCOL
1. **SPLIT-SCREEN ZONING**: Character Left 30% | Math/Text Right 70%.
2. **NEGATIVE SPACE GUARD**: Maintain a 10% empty buffer zone between the Stickman and the Text to prevent collision.
3. **MATH SYMBOL SANITIZATION**: Use spaces between operators (e.g., "5 + 5").

### 4. AUDIO CONSISTENCY
**"VOICE PROFILE: STRICTLY MALE. A youthful, energetic masculine voice with a distinct male baritone resonance. Texture: Crisp, clear, and distinctly deep-toned. NO FEMALE INFLECTIONS. Pitch: Medium-low. Tone: Strategic motivator, high-energy coach. Language: Casual Indonesian slang."**

### 5. STRICT CONSTRAINTS
1. **Narration Limits**: MAXIMUM 2 short, punchy sentences per scene.
2. **Duration**: Each scene is exactly ${durationPerScene} seconds.
3. **NO PLACEHOLDERS**: You MUST write out the FULL Text of the Character, Typography, and Negative Prompts in EVERY SINGLE SCENE. Do not use shortcuts like "[INSERT BLUEPRINT]" or "Same as above". If you fail to write the full text, the video generation will fail.

### 6. OUTPUT FORMAT (Strictly Follow This)
Only output the prompts. No conversational filler.

[SCENE 1] (00:00 - 00:${durationPerScene < 10 ? '0'+durationPerScene : durationPerScene})
Visual Prompt: [LAYOUT_GUARD: Character Left 30%, Math Right 70%]. CHARACTER BLUEPRINT: A minimalist 2D black stickman 'Si Penunjuk' on a clean white background. HEAD: Perfect large circle with a crisp thin black outline. HAIR: Exactly 3 very thin curved strands growing from the top-center of the head, pointing upwards. EYES: Two identical solid black vertical oval dots positioned in the upper-middle of the face. MOUTH: A very wide, thin black crescent smile reaching near the edges of the face. BODY ANATOMY: A single continuous skeleton with no floating parts. TORSO: A single, straight vertical black line. ARMS: Two single thin lines originating directly from the top of the torso line. LEGS: Two single thin lines originating directly from the bottom of the torso line. HANDS/FEET: Small solid black ovals. STYLE: Ultra-clean 2D Vector Line Art, High Contrast, No shading, No gradients, Flat design. POSE: Character stands strictly on the LEFT (30% Zone), with BOTH arms extended towards the right to present the content. TYPOGRAPHY BLUEPRINT: Text must be rendered as SHARP 4K VECTOR DIGITAL FONT (Sans-Serif or Monospace). COLOR: Solid Black with High Contrast. AVOID: No Handwriting, No Chalkboard effects, No Pixelation. LAYOUT: Text appears strictly in the RIGHT 70% Zone. MOTION: Text must NOT be static. Use 'Pop-in', 'Typewriter', or 'Smooth Slide-up' animation effects that synchronize with the Stickman's pointing gesture. SPACING: Ensure generous whitespace between lines to prevent clutter. NEGATIVE PROMPT: handwriting, blurry text, pixelated text, low resolution, messy lines, sketching style, shading, gradients, 3D effects, shadow, background noise, paper texture, chalkboard texture, overlapping text, cut off text, watermark, signature, disfigured, extra limbs, floating body parts. ACTION: The character points eagerly to the right. [MATH_CONTENT]: On the right, display "[INSERT TEXT]" using the Typography Blueprint rules. Animation: Text pops in one by one.
Camera/Motion: Static camera, focus on clarity.
VOICEOVER: (Voice Profile: STRICTLY MALE, Young energetic male, casual Indonesian slang) "[Narration text here]"

[SCENE 2] (00:${durationPerScene} - ...)
Visual Prompt: [LAYOUT_GUARD: Character Left 30%, Math Right 70%]. CHARACTER BLUEPRINT: A minimalist 2D black stickman 'Si Penunjuk' on a clean white background. HEAD: Perfect large circle with a crisp thin black outline. HAIR: Exactly 3 very thin curved strands growing from the top-center of the head, pointing upwards. EYES: Two identical solid black vertical oval dots positioned in the upper-middle of the face. MOUTH: A very wide, thin black crescent smile reaching near the edges of the face. BODY ANATOMY: A single continuous skeleton with no floating parts. TORSO: A single, straight vertical black line. ARMS: Two single thin lines originating directly from the top of the torso line. LEGS: Two single thin lines originating directly from the bottom of the torso line. HANDS/FEET: Small solid black ovals. STYLE: Ultra-clean 2D Vector Line Art, High Contrast, No shading, No gradients, Flat design. POSE: Character stands strictly on the LEFT (30% Zone), with BOTH arms extended towards the right to present the content. TYPOGRAPHY BLUEPRINT: Text must be rendered as SHARP 4K VECTOR DIGITAL FONT (Sans-Serif or Monospace). COLOR: Solid Black with High Contrast. AVOID: No Handwriting, No Chalkboard effects, No Pixelation. LAYOUT: Text appears strictly in the RIGHT 70% Zone. MOTION: Text must NOT be static. Use 'Pop-in', 'Typewriter', or 'Smooth Slide-up' animation effects that synchronize with the Stickman's pointing gesture. SPACING: Ensure generous whitespace between lines to prevent clutter. NEGATIVE PROMPT: handwriting, blurry text, pixelated text, low resolution, messy lines, sketching style, shading, gradients, 3D effects, shadow, background noise, paper texture, chalkboard texture, overlapping text, cut off text, watermark, signature, disfigured, extra limbs, floating body parts. ACTION: ...
...
`;

    const userQuery = `
Title: "${title}"
Material Context:
${fileContent.substring(0, 30000)} // Limit context
`;

    // DIRECT GOOGLE GEMINI API CALL
    try {
        // Using 'gemini-3-flash-preview' as explicitly requested
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || `API Error ${response.status}`);
        }
        
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (resultText) {
            dom.output.value = resultText;
            
            // Calc stats
            const sceneCount = (resultText.match(/\[SCENE/g) || []).length;
            dom.sceneCountDisplay.innerText = `Generated Scenes: ${sceneCount}`;
            dom.durationDisplay.innerText = `Est. Duration: ${sceneCount * durationPerScene}s`;
            dom.errorMsg.innerText = "";
        } else {
            throw new Error("No text generated by Gemini.");
        }

    } catch (err) {
        console.error("Gemini API Error:", err);
        dom.errorMsg.innerText = `Gagal: ${err.message}`;
    }

    dom.btnGenerate.disabled = false;
    dom.btnGenerate.innerHTML = '<i class="bi bi-magic"></i> GENERATE PROMPT';
}

function copyToClipboard() {
    dom.output.select();
    document.execCommand('copy');
    alert("Prompt copied to clipboard!");
}

// Auto-init if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoAutomator);
} else {
    initVideoAutomator();
}