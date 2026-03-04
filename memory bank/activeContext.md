# Active Context: TKA Math Mastery

## Current Focus
- **Main Landing Page Overhaul**: Transforming `index.html` into a comprehensive portal that effectively communicates value to Students, Parents, and Teachers.
- **Teacher Ecosystem Expansion**: Separating the Teacher Landing Page (`iklanguru.html`) from the Public Marketplace (`marketplace.html`) and building the "Verified Mentor" verification logic.
- **Teacher Dashboard (Mentor Guild)**: Implementing the Class Management system allowing teachers to create classes, invite students, and monitor progress.
- **Content Automation**: Refining the **Video Automator** and **Magic Auto-Forge** to streamline content creation using Google Gemini AI.

## Recent Changes
- **Markdown Integration**: Integrated `marked.js` into `materi.html`, `latihan.html`, `latihan_shadow.html`, and `grandmaster-admin.html` to support rich text formatting and responsive tables in questions and materials.
- **Table Styling**: Implemented custom CSS to render Markdown tables with a consistent "Citadel" theme (dark mode, gold borders) across all platforms.
- **Admin Panel Fixes**: Corrected file path encoding in `admin.js` to ensure the **Sage Prompt Library** correctly loads material structures from the `ringkasan materi` folder.
- **Interactive Video Engine**: Implemented **Shadow Overlay Quiz** in `materi.js`. Videos now auto-pause at specific timestamps to present quizzes. Progress is tracked via `video_quiz_logs`.
- **Shadow Forge (Admin Tool)**: Built a new Admin module for creating interactive videos. Features include **Live Preview**, **Timestamp Capture**, and **Magic Auto-Forge** (AI Sync).
- **Magic Auto-Forge**: An AI-powered tool that reads uploaded PDF materials and TXT video scripts to automatically generate quizzes and map them to the correct video timestamps.
- **Auto-Verify Progression**: The "Saya sudah mempelajari visi ini!" checkbox in `materi.html` is now automated. It only unlocks when all video quizzes are answered correctly.
- **API Security Overhaul**: Secured all Gemini AI integrations by removing hardcoded keys from the frontend. Implemented a **Dual-Proxy Architecture** using Supabase Edge Functions (`gemini-proxy` and `video-automator-proxy`) with strict Admin role verification (RBAC).
- **Advanced AI Models**: Upgraded the Video Automator to use **Gemini 3 Flash Preview** (via dedicated `GEMINI_API_KEY2`) to handle large, complex scene-by-scene prompt generation.
- **Video Automator**: Implemented a powerful internal tool to convert PDF/DOCX materials into detailed animation prompts for Grok/X (Stickman style).
- **Guided Drill Engine**: Fully implemented `latihan_shadow.js` with step-by-step input validation and optimized Text-to-Speech (TTS) for math formulas.
- **Admin Citadel Upgrades**: Added **God Mode** (Role Simulation), **AI JSON Sync**, **Shadow Forge**, and Global **Site Settings** configuration.

## Active Decisions
- **Markdown for Content**: Moving forward, all text content (questions, explanations, steps) should be treated as Markdown to allow for flexible formatting (tables, lists, bolding) without complex HTML injection.
- **Interactive Video Mandatory**: Video completion is now strictly enforced via quiz completion. Students cannot skip the video if quizzes are configured.
- **Dual-Input AI Sync**: For accurate video quiz mapping, we use both the Source Material (PDF) for content and the Video Script (TXT) for timing, as raw YouTube analysis is limited without transcripts.
- **Strict Unlocking Flow**: Adopted a rigid progression path: *Interactive Video (Auto-Verify) -> Training Grounds -> Shadow Training -> Guardian Skirmish -> Time Rift*.
- **AI-First Content**: All new material generation defaults to using internal AI tools (Gemini) rather than manual entry.
- **Zero-Key Frontend Policy**: No API keys for 3rd party services (Gemini, OpenRouter, etc.) shall be stored in frontend modules. All such calls must be proxied through Supabase Edge Functions with identity verification.
- **Isolated AI Pipelines**: High-load AI tasks (like Video Automation) are isolated into separate Edge Functions and API keys to prevent quota exhaustion and performance interference with the main Admin Dashboard.

## Next Steps
- [ ] **Landing Page**: Refactor `iklanguru.html` into a persuasive "Teacher Invitation" page.
- [ ] **Marketplace**: Create `marketplace.html` as a directory for parents/students.
- [ ] **Verification Logic**: Implement the "60 Students + 30 Parents" rule to unlock free ads.
- [ ] **Online Class**: Integrate Jitsi Meet for "Astral Plane" sessions.
- [ ] **Payment Gateway**: Integrate Midtrans for handling "Sage Scroll" purchases and Teacher booking fees.
- [ ] **School Dashboard**: Develop the B2B portal for school principals to monitor student analytics.
- [ ] **Deployment**: Prepare for final production deployment on Vercel/Netlify.

## Learnings & Insights
- **Markdown & Math**: Integrating `marked.js` alongside `KaTeX` requires careful handling to ensure Markdown parsing doesn't break LaTeX delimiters or input fields injected via regex.
- **Video Interaction**: Using YouTube IFrame API allows for precise control (pause/play) and timestamp monitoring, enabling a "H5P-like" experience without external plugins.
- **AI Context Window**: Providing both the script and the material to the AI significantly improves the relevance and timing accuracy of generated quizzes compared to using material alone.
- **TTS Optimization**: Standard Web Speech API needs specific text preprocessing (e.g., converting "1/2" to "satu per dua") to sound natural in Indonesian.