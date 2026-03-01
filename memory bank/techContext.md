# Tech Context: TKA Math Mastery

## Technologies Used
- **Frontend**:
    - **Language**: Vanilla JavaScript (ES6+).
    - **UI Framework**: Bootstrap 5 (via CDN).
    - **Build Tool**: Vite.
    - **Styling**: Custom CSS with RPG/Game-like themes (gradients, animations, blurs).
    - **Math Rendering**: KaTeX (via CDN).
    - **Markdown Rendering**: `marked.js` (via CDN) for rich text content.
    - **Document Parsing**: `pdfjs-dist`, `mammoth` (for extracting text from upload materials).
    - **Video**: **YouTube IFrame API** (for interactive playback control and timestamp monitoring).
- **Backend**:
    - **Platform**: Supabase.
    - **Authentication**: Supabase Auth (Email/Password).
    - **Database**: PostgreSQL.
    - **Client Library**: `@supabase/supabase-js`.
- **AI Services**:
    - **Google Gemini API**: Used in `video-automator.js` and `admin.js` (Magic Auto-Forge) for generative content and logic mapping.

## Development Setup
- **Node.js**: Required for Vite development server.
- **Environment Variables**: `.env` file containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Scripts**:
    - `npm run dev`: Starts local development server at `http://localhost:5173`.
    - `npm run build`: Generates production-ready files in `dist/`.

## Technical Constraints
- **Module Architecture**: Vite uses ES6 modules. Direct `onclick` attributes in HTML must be avoided in favor of `addEventListener` in JS.
- **Supabase Triggers**: Database logic (like pairing code generation) is handled by PL/pgSQL triggers in the `public` schema.
- **RLS Policies**: Data privacy is enforced at the database level. Queries must be optimized to work within these security constraints.
- **Guided Drill Engine**: The Shadow Training (`latihan_shadow.js`) uses a step-by-step input validation system that is distinct from the main Combat Engine. Content steps are parsed as Markdown to support formatting.
- **Interactive Video Config**: Quizzes are stored in `materi.video_quiz_config` as a JSONB array. The schema is strict: `{time: int, type: string, question: string, options: string[], answer: int, hint: string}`.
- **Combat Turn State**: The exercise engine (`latihan.js`) is a turn-based system where `currentIndex` tracks the progress, and state transitions happen only after animations finish.
- **Complexity Mapping**: `tingkat_kesulitan` in the `questions` table maps directly to TKA 2025 cognitive levels (L1: Understanding, L2: Application, L3: Reasoning).
- **Social Wall Persistence**: Premium status and share counts are tracked via `localStorage` with `currentUser.id` prefix to ensure account isolation on shared devices.
- **AI Content Ingestion**: The system uses a specific JSON schema for bulk question uploads, optimized for output from highly-tuned LLM prompts.

## Dependencies
- `@supabase/supabase-js`: ^2.x
- `vite`: ^5.x
- `bootstrap`: 5.3.0 (CDN)
- `bootstrap-icons`: 1.10.5 (CDN)
- `katex`: 0.16.8 (CDN)
- `marked`: ^9.x (CDN)
- `pdfjs-dist`: ^4.0.x (CDN)
- `mammoth`: ^1.6.0 (CDN)

## Directory Structure
- `/`: HTML templates (`index.html`, `auth.html`, `dashboard.html`, `materi.html`, `latihan.html`, `latihan_shadow.html`, `grandmaster-admin.html`, `grandmaster-portal.html`).
- `src/`:
    - `supabase.js`: Supabase client initialization.
    - `auth.js`: Registration and login logic.
    - `dashboard.js`: Role-based dashboard management.
    - `materi.js`: Dynamic material rendering, Interactive Video Engine, and Training Grounds integration.
    - `latihan.js`: Boss Battle exercise engine (Guardian & Rift).
    - `latihan_shadow.js`: Guided Drill engine with TTS.
    - `video-automator.js`: AI-powered tool for generating video prompts.
    - `admin.js`: Logic for the Grandmaster Citadel (Admin Dashboard), Shadow Forge, and Magic Auto-Forge.
    - `admin-login.js`: Logic for the Grandmaster Portal (Admin Auth).
- `public/`: Static assets.
- `ringkasan materi/`: Original source materials (HTML/PDF) used for database population.