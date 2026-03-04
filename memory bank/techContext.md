# Technical Context: TKA Math Mastery

## Architecture Overview
The project is a static web application (`.html`, `.js`, `.css`) served directly to the client, interacting with a **Supabase** backend for authentication, database, and edge functions.

### Core Technologies
- **Frontend**: Vanilla JavaScript (ES6+ Modules), Bootstrap 5 (CSS Framework), Marked.js (Markdown Rendering), KaTeX (Math Rendering).
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions).
- **AI Integration**: Google Gemini 1.5 Flash & 2.5 Pro (via Supabase Edge Functions proxy).
- **Video**: YouTube IFrame API for interactive video control.

## Key Modules & Implementation Details

### 1. Shadow Forge (Interactive Video Editor)
A complex admin module for creating interactive video quizzes.
- **File**: `src/admin.js`, `grandmaster-admin.html`
- **Data Structure**: Stored in `materi` table, column `video_quiz_config` (JSONB array of objects: `{time, question, options, answer, hint}`).
- **Draggable Timeline Logic**:
  - **Container**: `#forgeTimeline` (div relative position).
  - **Markers**: `.quiz-marker` (absolute position based on percentage of video duration).
  - **Sync Mechanism**: 
    - `mousedown`: Pauses video, calculates new time from X-coordinate relative to container width.
    - `mousemove`: Updates marker visual position and the `#quizTime` input form in real-time.
    - `mouseup`: Saves new time to `currentQuizzes` array, re-sorts array, and re-renders timeline.
  - **Robustness**: Uses a `renderTimelineMarkers()` function with **Auto-Retry (500ms polling)**. This is critical because the YouTube IFrame API often returns `duration: 0` immediately after loading, causing markers to disappear. The retry logic waits until valid metadata is available.
- **Magic Auto-Forge (AI Sync)**:
  - Uses `gemini-proxy` Edge Function.
  - Prompt Version 2.0: Specifically instructs AI to generate **exactly 5 quizzes** (2 Theory + 3 Problem Re-ask) and map timestamps to the end of relevant scenes.

### 2. Interactive Video Player (Student View)
- **File**: `src/materi.js`, `materi.html`
- **Overlay System**: `#videoQuizOverlay` sits on top of the YouTube iframe (z-index 2000).
- **Trigger Logic**: `setInterval` checks `player.getCurrentTime()` every 1s. If a quiz time is reached (and not yet triggered), the video pauses and the overlay appears.
- **Gating**: The overlay **cannot be closed** manually. It only closes when the user selects the correct answer (`isCorrect: true`).
- **Auto-Resume**: Upon correct answer, the system waits 1.5s (for feedback reading) then auto-plays the video.

### 3. Scroll Forge (CMS)
- **File**: `src/admin.js`
- **Function**: Syncs JSON content (Quizzes, Drills, Material) to Supabase.
- **Modes**: Upsert (Add/Update) and Overwrite (Delete then Insert).
- **Tables**: Targets `materi`, `questions`, or `shadow_drills` based on selection.

### 4. God Mode (Simulation Hub)
- **File**: `src/admin.js`
- **Function**: Allows Admins to impersonate Students/Teachers without logging out.
- **Mechanism**: Sets `sessionStorage.setItem('god_mode_role', 'student')`. The frontend (`dashboard.js`, `materi.js`) checks this storage key to bypass RLS checks or UI restrictions.
- **Omni Gate**: Quick teleport to specific material pages (`materi.html?jenjang=SD&bab=1&sub=1`).

## Security & RBAC
- **Admin**: Checked via `profiles.role = 'admin'`. Admin pages (`grandmaster-admin.html`) perform a strict redirect check on load.
- **API Keys**: **NEVER** exposed on the client. All calls to Gemini or other paid APIs go through Supabase Edge Functions (`gemini-proxy`, `video-automator-proxy`).

## Development Guidelines
- **HTML Parsing**: Do NOT use `CDATA` tags in HTML files; it breaks Vite/modern browsers.
- **Icon Safety**: Ensure Unicode icons (e.g., =á, ”) are properly encoded or use Bootstrap Icons (`<i class="bi ..."></i>`) to prevent parsing errors.
- **Math Formatting**: Use LaTeX style `$$...$$` or `$...$` for math, rendered by KaTeX. Avoid raw `<` or `>` in math text as they confuse HTML parsers; escape them as `<` and `>`.