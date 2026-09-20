# ⚡ ClubOps AI

> **Intelligent, AI-Powered Event Operations & Workload Automation Platform for College Clubs & Student Chapters**

---

## 🎯 Unique Selling Proposition (USP)

College clubs consistently struggle with volunteer burnout, last-minute dropouts, and disorganized meetings with lost action items. **ClubOps AI is the first campus operations platform engineered with an autonomous workload guard and multimodal speech intelligence:**
* **Strict 1-Active-Task Workload Guard:** Protects volunteers from over-allocation and burnout by strictly forbidding multiple concurrent active tasks per member with intelligent peer delegation.
* **Auto-Reallocation on Leave/Deactivation:** When an active volunteer marks themselves unavailable or falls sick, their orphaned tasks are automatically reassigned to peers with matching skillsets in under 1.5 seconds.
* **Integrated In-App Meeting Rooms:** Club leaders can host Google Meet-style live meetings directly from the platform, share join links and room codes, and keep event planning, coordination, and follow-up tasks in one workspace.
* **Vernacular & Hinglish Meeting Audio Analysis:** Leaders can record live meetings directly from the browser; our multimodal AI transcribes vernacular speech, maps action items to attendees via phonetic name matching, and drafts 1-click broadcast announcements.
* **Live RAG Context Assistant:** A real-time streaming chatbot grounded in live Neon PostgreSQL database state and the complete platform manual.

---

## 🚀 Implemented Features (Live & Production-Ready)

* **🛡️ AI Workload Guard (1-Active-Task Rule):**
  * Hard blocks assigning more than 1 active task to any volunteer simultaneously.
  * Evaluates task context, checks club members with 0 active tasks, and recommends the best alternate volunteer.
  * Deterministic fallback logic ensures continuous rule enforcement even if external AI APIs are unreachable.
* **🔄 AI Risk Identification & Skill-Based Auto-Reallocation:**
  * When a member toggles their profile to "Unavailable" or sets a leave duration (e.g., 4h, 24h, 3d, exams, medical), the system scans for orphaned tasks.
  * Automatically matches and transfers tasks to available club peers who possess the closest required skillset.
* **🎙️ Multimodal AI Meeting Summarizer & Task Generator:**
  * Direct in-browser 16kHz mono audio recording (Web Audio API) or file uploads (up to 25MB: MP3, WAV, M4A, WebM).
  * Multilingual speech transcription (English, Hindi, Hinglish, Gujarati, and regional dialects).
  * Multi-member task extraction with phonetic and colloquial name matching (e.g., maps spoken names like *"Nand bhai"* or *"Dev"* to exact user IDs).
  * Generates instant, 1-click broadcast-ready official announcements with key decisions and task rosters.
* **💬 Real-Time RAG AI Chatbot Widget:**
  * Real-time token streaming chat interface powered by Groq LLMs.
  * Grounds responses dynamically in live Neon PostgreSQL database state (the user's clubs, upcoming events, and pending tasks) combined with platform operating manuals.
* **🏛️ Club Lifecycle & Code System:**
  * Generate unique, shareable Club Codes (`CLB-XXXXXX`).
  * Student lookup and join request workflows with leader approval/rejection gates.
* **📅 Event Operations Hub:**
  * Offline (physical venue) and Online (meeting link and passcode) event scheduling.
  * Integrated Google Meet-style in-app meeting rooms for club discussions, planning sessions, and live event coordination.
  * Event participant rosters, batch task delegation, and progress tracking (`pending` ➔ `in_progress` ➔ `completed`).
* **📡 Real-Time Server-Sent Events (SSE):**
  * Live updates for join requests, task updates, reallocations, and announcements without manual page refreshes.
* **👤 Volunteer Profile & Availability Engine:**
  * Skill tagging, contact information, and timed away statuses with automated expiration.
* **🔐 Dual Authentication & Middleware Route Guard:**
  * Google OAuth and Email/Password authentication.
  * HTTP-only session cookies (`clubops_session`) verified through Next.js middleware.
* **🎨 Modern Responsive UI:**
  * Dark & Light theme switcher (`next-themes`), Framer Motion micro-animations, and mobile bottom navigation.

---

## 🔮 Future Goals & Roadmap

* **📲 External Push & WhatsApp Notifications:** Automated reminders and task alerts sent directly via WhatsApp and push notifications.
* **📅 Calendar Synchronization:** Two-way synchronization with Google Calendar and iCal feeds.
* **📦 Integrated Cloud Object Storage:** Direct storage bucket integration for club posters, media banners, and archived recordings.
* **🧪 Automated Test Coverage:** End-to-end testing pipelines utilizing Vitest, Jest, and Playwright.
* **📊 Club Analytics & Volunteer Badges:** Gamified volunteer reputation scores and automated event post-mortem analytics.

---

## 📊 Key Measurable Outcomes

| Metric / Parameter | Outcome / Benchmark |
| :--- | :--- |
| **Concurrent Active Task Limit** | **Strictly 1 active task** per volunteer (0 double-assignment rate) |
| **Orphaned Task Handover Speed** | **< 1.5 seconds** automated AI skill-based reallocation |
| **Audio File Upload Capacity** | **25 MB** maximum file size |
| **Browser Recording Precision** | **16,000 Hz Mono PCM** clean audio capture |
| **Chatbot Context Capacity** | **128K token window** with real-time DB grounding & multi-turn memory |
| **Live SSE Heartbeat Frequency** | **15 seconds** keep-alive stream connection |

---

## 🌐 Live Deployment

* **Production URL:** `<!-- ADD YOUR DEPLOYMENT LINK HERE (e.g. https://clubops-ai.vercel.app) -->`
* **Demo Video / Pitch:** `<!-- ADD YOUR DEMO VIDEO / LOOM / YOUTUBE LINK HERE -->`

---

## 📸 Screenshots

| | | |
| :---: | :---: | :---: |
| ![s1](public/s1.jpeg) | ![s2](public/s2.jpeg) | ![s3](public/s3.jpeg) |
| ![s4](public/s4.jpeg) | ![s5](public/s5.jpeg) | ![s6](public/s6.jpeg) |
| ![s7](public/s7.jpeg) |  |  |

---

## 🛠️ Full Stack Technology Stack

* **Core Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Route Handlers)
* **Programming Language:** [TypeScript 5](https://www.typescriptlang.org/)
* **Database & ORM:** [Neon PostgreSQL](https://neon.tech/) (Serverless PostgreSQL with connection pooling)
* **AI & Machine Learning APIs:**
  * **Groq Cloud SDK:** Llama 3.3 70B, GPT-OSS 120B, Whisper Large v3 (Transcription, Workload Guard, Live RAG Chatbot)
  * **Google Gemini API:** Gemini 2.5/2.0 Flash (Multimodal Audio Understanding & Task Extraction)
  * **Sarvam AI:** Saaras v4 (India-optimized Speech-to-Text & Regional LLMs)
* **Authentication:**
  * Firebase Authentication (Google OAuth & Email/Password)
  * Firebase Admin SDK (Server-side token verification)
  * Custom HTTP-Only Cookie Session Engine & Next.js Middleware Route Protection
* **Styling & Design System:**
  * [Tailwind CSS v4](https://tailwindcss.com/)
  * PostCSS
  * Custom Glassmorphism, Dark/Light Themes via `next-themes`
* **Libraries & Utilities:**
  * `framer-motion`: Smooth UI transitions and micro-animations
  * Web Audio API: 16kHz Mono audio recording in-browser
  * Server-Sent Events (SSE): Real-time event streaming bus via Node.js `EventEmitter`

---

## 💻 How to Run Locally

### 1. Prerequisites
Ensure you have installed:
* **Node.js**: v18.18.0 or higher (v20+ recommended)
* **npm**, **pnpm**, or **yarn**
* **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/NandCode24/ClubOps-AI-Bit-N-Build-.git
cd ClubOps-AI-Bit-N-Build-
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the example environment template and populate your keys:
```bash
cp .env.example .env.local
```
*(Open `.env.local` and add your database credentials and API keys).*

### 5. Run Database Migrations
Initialize the Neon PostgreSQL tables, indexes, and constraints:
```bash
node scripts/migrate-neon.mjs
```

### 6. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to explore ClubOps AI.

---

## 🔑 Environment Configuration (`.env.example`)

Below is the required template for `.env.local` (also provided in [`.env.example`](file:///.env.example)):

```env
# ------------------------------------------------------------------------------
# 1. Neon Serverless PostgreSQL Database
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://neondb_owner:<password>@<pooler-host>.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:<password>@<direct-host>.neon.tech/neondb?sslmode=require"
NEON_BRANCH="production"
NEON_AUTH_BASE_URL="https://<neon-auth-endpoint>.neon.tech/neondb/auth"
NEON_AUTH_JWKS_URL="https://<neon-auth-endpoint>.neon.tech/neondb/auth/.well-known/jwks.json"
NEON_AUTH_COOKIE_SECRET="your_neon_auth_cookie_secret_base64_or_random_key"

# ------------------------------------------------------------------------------
# 2. AI API Keys (LLMs & Speech Engines)
# ------------------------------------------------------------------------------
GROQ_API_KEY="gsk_your_groq_api_key_here"
GEMINI_API_KEY="your_google_gemini_api_key_here"
SARVAM_API_KEY="sk_your_sarvam_api_key_here"

# ------------------------------------------------------------------------------
# 3. Firebase Authentication (Client & Server-Side Admin)
# ------------------------------------------------------------------------------
NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_web_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app-id.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_web_app_id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"

# Firebase Admin SDK Credentials
FIREBASE_PROJECT_ID="your-app-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-app-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

---

## 👥 Contributors & Acknowledgements
Built with ❤️ by team BitByBit for student clubs and college organizations everywhere. Contributions, feature suggestions, and pull requests are warmly welcome!
