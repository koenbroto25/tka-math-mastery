# Product Context: TKA Math Mastery

## Why this project exists
Many students find mathematics difficult and boring. Traditional textbooks and static e-books often fail to engage young learners. TKA Math Mastery aims to solve this by transforming math preparation for the Academic Competency Test (TKA) into a fun, game-like adventure.

## Problems it solves
- **Student Engagement**: Replaces dry material with RPG-style quests, boss battles, and a rewarding XP/level system.
- **Learning Efficiency**: Uses "Jurus Cepat" (rapid calculation techniques) and structured learning paths (Material -> Guided -> Standard -> Cumulative) to build mastery.
- **Monitoring**: Provides parents and teachers with a clear window into student progress without needing direct supervision.
- **Scalability**: Moves away from manual file management (120+ HTML files) to a dynamic, database-driven architecture using Supabase.
- **Accessibility**: Works as a PWA, allowing students to study on various devices, even with limited internet access.

## How it should work
1. **The Gate (Landing Page)**: Comprehensive portal segmented for three audiences:
    - **Heroes (Students)**: Gamified learning, XP system, Boss Battles.
    - **Observers (Parents)**: Real-time monitoring & Tutor Marketplace.
    - **Mentors (Teachers)**: Class management & passive income opportunities.
2. **Character Creation (Auth)**: Users select their Class (Student, Parent, Teacher) and Level (SD/SMP).
3. **Guild House (Dashboard)**:
    - **Students (Heroes)**: A winding "Path of Mastery" (Duolingo style). Stage nodes represent curriculum sub-chapters.
    - **Parents (Observers)**: "Tautkan Akun" via pairing code. View reports behind a "Social Wall" (Share to Unlock).
    - **Teachers (Mentors)**: Access to "The Mentor Guild" to manage classes, monitor student progress, and download grade reports. Can apply for "Verified Mentor" status to advertise services.
4. **The Mentor Guild (Teacher Dashboard)**:
    - **Guild Creation**: Teachers form "Guilds" (Classes) and generate unique invite codes.
    - **Recruitment**: Students join Guilds using the code to become "Apprentices".
    - **Combat Archives (Gradebook)**: Real-time monitoring of student scores, levels, and activity status.
    - **Export Scrolls**: Ability to download student report cards as Excel/CSV files.
    - **Sage's Library**: Teachers create custom questions and assign them as "Quests" to their students.
5. **The Mentor Marketplace (Ecosystem)**:
    - **Invitation Page (`iklanguru.html`)**: Landing page for Teachers explaining the benefits of joining the platform (Free Ads Requirement: 60 Students + 30 Parents).
    - **Public Directory (`marketplace.html`)**: Searchable directory for Parents/Students to find and book "Verified Mentors".
    - **Astral Plane**: Integrated online classroom with video conferencing and interactive whiteboard for paid sessions.
    - **Hero's Treasury**: Payment system (Escrow) handling transactions between Parents and Teachers.
6. **The Sage's Briefing (Material)**: Dialogue-style UI with Professor Hoot. Features "Skill Unlock" (Kitab Jurus) and "Vision Scroll" (Video).
7. **Arena of Trials (Exercises)**:
    - **Shadow Training**: 20 low-stakes questions with hints.
    - **Guardian's Skirmish**: 30 standard TKA questions.
    - **The Time Rift**: 40 cumulative questions.
    - **Ancient Dragon Siege**: High-difficulty Boss Battle (Simulation TKA) after completing a chapter.

## RPG Stage Mapping
| Stage | Learning Goal | Lore |
| :--- | :--- | :--- |
| **Material** | Conceptual Understanding | The Sage's Briefing |
| **Guided** | Pattern Recognition | Shadow Training |
| **Standard** | Skill Verification | Guardian's Skirmish |
| **Cumulative** | Long-term Retention | The Time Rift |
| **Simulation** | Exam Stamina | Ancient Dragon Siege |

## User Experience Goals
- **Fun First**: The UI should feel like a game app, not a school website.
- **Instant Feedback**: Animations (telak/shake) and sound effects provide immediate response to answers.
- **Curiosity & Incentives**: Use locks and "Share to Unlock" mechanics to drive progress and organic growth.
- **Clarity**: Mathematical symbols should be rendered professionally using KaTeX.

## Monetization Model (The Hero's Treasury)
- **Freemium Access**: "Sage's Briefing" and "Shadow Training" are free. Premium "Sage Scrolls" required for "The Time Rift" and "Ancient Dragon Siege".
- **Marketplace Guild**: Verified teachers pay a listing fee or commission (10%) for student bookings handled through the app's integrated escrow system.
- **Economic Recovery**: "Hearts/Energy" can be recovered by:
    - Time-based regeneration.
    - Viral social tasks (WhatsApp/IG share).
    - Rewarded Video Ads.
    - Direct purchase using in-game "Gold" (Top-up).
- **B2B School Licenses**: Yearly subscriptions for schools ("Grandmaster Tier") providing full student monitoring dashboards and unlimited premium access.