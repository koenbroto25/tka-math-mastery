# System Patterns: TKA Math Mastery

## System Architecture
The application is built as a dynamic Static Site (SSG/SPA hybrid) using Vite and Vanilla JavaScript, with Supabase as the backend.

### Component Relationship
- **Frontend**: Vanilla JS modules in `src/` manage state and DOM manipulation.
- **Backend (Supabase)**:
    - **Auth**: Manages user sessions and identities.
    - **Database (PostgreSQL)**: Stores user profiles, curriculum content, questions, reports, progress, and video quiz logs.
    - **Triggers**: Automate background tasks like creating a `public.profiles` entry when a user signs up.
    - **RLS (Row Level Security)**: Controls data access (e.g., parents can read but not edit child data).
    - **Guilds (Classes)**:
        - `guilds`: Stores class metadata (name, code, teacher_id).
        - `guild_members`: Relational table linking `student_id` to `guild_id`.

## Key Technical Decisions
- **Markdown Parsing**: Integrated `marked.js` to support rich text formatting (tables, lists, bolding) in questions and materials. This is crucial for rendering complex math tables and structured text that would otherwise be difficult to format in raw JSON strings.
- **Dynamic Routing via URL Parameters**: Instead of 120+ static HTML files, the app uses template files (`materi.html`, `latihan.html`, `latihan_shadow.html`) that fetch specific content based on `jenjang`, `bab`, and `sub` parameters.
- **Video Automator (AI Pipeline)**: A dedicated internal tool (`video-automator.js`) that uses Google Gemini to "read" PDF/DOCX materials and generate structured video prompts for external animation tools (Grok/X). This solves the content production bottleneck.
- **Guided Drill Engine**: A separate engine for "Shadow Training" that focuses on step-by-step scaffolding (`langkah_1`, `langkah_2`, `langkah_3`) rather than simple multiple-choice, utilizing TTS for auditory reinforcement.
- **Interactive Video Engine**: A "H5P-like" custom implementation using YouTube IFrame API. Videos pause automatically at timestamps defined in `materi.video_quiz_config` (JSONB) to serve overlay quizzes.
- **AI-Driven CMS**: Admin dashboard uses a "Paste AI JSON" pattern to bulk-import content generated via specialized LLM prompts, now supporting multi-format sync (Materi, Shadow Drills, Standard Questions).

## Design Patterns
- **Traffic Controller (Role-Based Rendering)**: The `dashboard.js` acts as a dispatcher, checking the user's role and rendering only the appropriate UI panels (`panelStudent`, `panelParent`, `panelTeacher`).
- **Guild Management (Classroom Logic)**:
    - **Creation**: Teacher creates a Guild -> Generates 6-char unique code.
    - **Join**: Student inputs code -> Inserts into `guild_members`.
    - **Monitoring**: Teacher fetches all students in their guild + joins with `progress` table for reporting.
- **Combat Engine (Turn-Based Battle)**: The `latihan.js` implements a turn-based state machine.
    - **Modes**:
        - **Guardian's Skirmish (`tipe=std`)**: Classic RPG battle. HP Bar Player vs Monster. Damage on wrong answers.
        - **The Time Rift (`tipe=kum`)**: Boss battle. Extended timer, cumulative material.
        - **CBT Simulation (`simulasi.html`)**: Pure professional exam UI. No RPG elements.
    - **HP Sync**: Calculates damage to Boss (correct) or Hero (wrong).
    - **Type Adapters**: Renders different DOM structures for PG, PGK MCMA, and PGK Kategori.
- **Shadow Forge (Interactive Editor)**:
    - **Dual-Input Sync**: Uses both Material (PDF) and Script (TXT) to map generated questions to accurate video timestamps.
    - **Live Preview**: Integrates YouTube Player into the Admin Panel for frame-perfect timestamp capturing.
- **Economic Loop (Energy & Social)**:
    - Failing a battle reduces Heart count.
    - Hearts are recovered via "Social Quests" (API links with auto-copy promotional text) or "Sage's Rest" (Time-based).
- **Auth Guard**: Every protected page runs a `checkAuth()` session validation before loading data.
- **Secure API Proxy (Gemini Shield)**: Frontend never calls Google Gemini directly.
    - `admin.js` (Shadow Forge) uses `gemini-proxy` with `GEMINI_API_KEY`.
    - `video-automator.js` uses `video-automator-proxy` with `GEMINI_API_KEY2` to handle isolated long-running generation tasks.
    - Both functions verify the user's Admin Role via `profiles` table before executing the server-to-server call to Google.

## Critical Implementation Paths
- **Material Unlocking Flow**: 
    1. **Sage's Vision**: Watch video briefing + Complete embedded quizzes (Tracked via `video_quiz_logs` + `Auto-Verify Checkbox`).
    2. **Training Grounds**: Solve 3 mandatory practice questions in `materi.html` (Must be 100% correct).
    3. **Shadow Training**: Complete the 10-question guided drill in `latihan_shadow.html`.
    4. **Guardian Skirmish**: Unlocked only after Shadow Training is passed.
    5. **Time Rift**: Unlocked only after Guardian Skirmish is passed.
- **Completion Flow**: Student finishes Battle -> Engine calculates score -> inserts into `progress` -> updates `xp_total` and `hearts` in `profiles`.

## Content Structure Patterns
- **Knowledge Scroll**: Dark background box (#2c1e14) with light text (#f4e4bc) for maximum readability. Supports Markdown for tables and formatting.
- **Techniques Section**: Full Question display -> Options -> Secret Technique explanation directly below.
- **Shadow Drill**: Step-by-step interactive inputs with audio guidance. Content is parsed as Markdown before input injection.
- **Shadow Overlay**: Modal overlay on top of video player that halts playback until interaction.

## Technical Constraints
- **Vite Module Scoping**: No inline `onclick` handlers.
- **Supabase Token Expiry**: Frontend must handle session persistence.
- **Browser TTS**: Implementation requires text normalization (e.g., "1/2" -> "satu per dua") to ensure mathematical accuracy in Indonesian.
- **YouTube API**: Must handle various URL formats (Desktop, Mobile, Embed) to extract Video ID correctly.