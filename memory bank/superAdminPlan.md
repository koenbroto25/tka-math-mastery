# Super Admin Blueprint: The Grand Citadel

This document outlines the architecture, features, and roadmap for the Super Admin dashboard of TKA Math Mastery.

## 🛡️ Access & Security
- **Hidden Route**: Accessible only via `/grandmaster-portal.html` (not linked in public UI).
- **Session Guard**: Automatic redirect to `index.html` if `role != 'admin'`.
- **Database Security**: Supabase RLS (Row Level Security) policies strictly restrict `INSERT/UPDATE/DELETE` on core tables to admin roles only.

## 🏛️ Core Modules

### 1. Scroll Forge (Content Engine)
- **Video Automator**: Integrated AI tool (`gemini-1.5-flash`) to generate Stickman Animation prompts from raw PDF/DOCX materials.
- **AI JSON Sync**: A bulk-upload tool that accepts JSON outputs from LLMs (ChatGPT/Claude) to populate `materi`, `shadow_drills`, and `questions` tables.
- **Prompt Library**: Built-in repository of "Gold Standard" prompts for generating high-quality TKA questions.

### 2. Mentor Guild (Marketplace)
- **Teacher Moderation**: Approve/Reject new teacher registrations and verify documents.
- **Ad Configuration**: Native "Recommended Mentor" triggers based on student failure rates.
- **Payout Panel**: Manage teacher earnings and platform commission (default 10%).

### 3. Kingdom B2B (School Hub)
- **School White-labeling**: Logo and naming customization via `site_settings`.
- **Bulk Onboarding**: Import student lists via CSV/Excel.
- **Grandmaster Dashboard**: Analytics for school principals to monitor teacher and student performance.

### 4. Treasury (Monetization)
- **Voucher System**: Generate unique codes for manual sales or marketing campaigns.
- **Economy Configurator**: Adjust prices for Gold/Coins, Elixirs, and Sage Scrolls via `site_settings` (Game Logic).
- **Transaction Tracker**: Real-time log of Midtrans/Xendit payments.

### 5. Radar Pahlawan (Analytics)
- **Question Reports**: Unified inbox for all user-reported issues with "Resolve" workflow.
- **Engagement Map**: Tracks sign-up growth (SD vs SMP).
- **Difficulty Heatmap**: Identifies chapters with high failure rates to prioritize content updates.

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Completed)
- [x] Create `grandmaster-admin.html` and `src/admin.js`.
- [x] Implement Auth Guard (Citadel Gate).
- [x] Build the "AI JSON Sync" tool for materials & drills.
- [x] Implement "Video Automator" for content generation.
- [x] Create "Question Reports" module.

### Phase 2: Marketplace & B2B (Current Focus)
- [ ] Teacher approval workflow.
- [ ] Native ad trigger settings.
- [ ] School license management.

### Phase 3: Financials
- [ ] Midtrans integration for automated payments.
- [ ] Payout and Voucher system implementation.