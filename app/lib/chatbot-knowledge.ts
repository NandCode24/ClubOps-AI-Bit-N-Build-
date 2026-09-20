import { sql } from "./db";

/**
 * Complete, authoritative website manual for ClubOps AI.
 * Injected directly into the Groq model context (128K context window).
 */
export const WEBSITE_KNOWLEDGE_MANUAL = `
# CLUBOPS AI - OFFICIAL PLATFORM MANUAL & ARCHITECTURE

## 1. Overview & Core Mission
ClubOps AI is a centralized event operations platform designed specifically for college clubs, student chapters, technical societies, and cultural organizations.
College clubs often face common operational hurdles:
- Volunteer burnout from over-assigning tasks to the same few active members.
- Lost productivity when a key member suddenly falls sick or deactivates before an event.
- Disorganized planning meetings with scattered WhatsApp messages and lost action items.
- Scattered join requests and messy club joining links.

ClubOps AI solves these problems with intelligent automation, AI workload protection, multimodal meeting summarization, and streamlined club operations.

---

## 2. Authentication & Account Setup
- **Sign In / Sign Up**: Supports Google OAuth (One-Tap / Firebase) and secure Email/Password authentication.
- **Neon Postgres Sync**: User profiles are synchronized in real-time into the Neon PostgreSQL database ('users' table).
- **Session Management**: Authenticated users receive a secure HTTP-only session cookie ('clubops_session').
- **Protected Routes**: '/dashboard', '/club/[code]', '/createClub', '/joinClub', and '/profile' are protected by Next.js middleware ('proxy.ts').

---

## 3. Club Creation & Management
- **Creating a Club ('/createClub')**:
  * Any authenticated student can create a new club.
  * The creator automatically becomes the **Club Leader**.
  * A unique, human-readable **Club Code** is automatically generated in the format 'CLB-XXXXXX' (e.g., 'CLB-MQQELV', 'CLB-9K2P4X').
  * The leader provides the club name, description, location/college, and optional logo.
- **Club Code System**:
  * The Club Code is the primary identifier for joining.
  * Leaders can copy and share this code with students across campus.
- **Join Requests & Approvals ('/joinClub')**:
  * Students enter the 6-character Club Code to look up the club and submit a join request.
  * The Club Leader receives the request in their club dashboard with options to **Accept** or **Reject**.
  * Accepted members are added to the club roster as volunteers/members.
- **Club Roles**:
  * 'leader': Full administrative permissions (create events, summarize meetings, assign tasks, delete club).
  * 'volunteer' / 'member': Can participate in events, receive task assignments, view announcements, and manage their availability.

---

## 4. Event Operations ('/club/[code]/create-event')
- Leaders can create offline or online events within their club.
- Details include:
  * Event Name and Description.
  * Start Time and End Time.
  * Event Mode: 'offline' (with physical venue, e.g. "Main Auditorium") or 'online' (with Meeting Link & Meeting Code).
- **Event Participants**:
  * Club members can join event rosters or be assigned event responsibilities.

---

## 5. AI Meeting Summarizer & Task Generator
- **Location**: Found inside any event page ('/club/[code]/event/[id]') by clicking the **"🎙️ AI Meeting Summarizer"** button (Leader Only).
- **Audio Input Options**:
  1. **Live Microphone Recording**: Uses the browser's Web Audio API recording at 16kHz mono PCM (ideal for speech AI) and encodes it into a clean .wav file.
  2. **File Upload**: Accepts audio files up to 25MB (.mp3, .wav, .m4a, .webm, .ogg).
- **Multilingual AI Engine**:
  * Supports English, Hindi, Hinglish (Hindi + English colloquial mix), Gujarati, Spanish, French, etc.
  * Can transcribe Indian names, nicknames, and colloquial terms (e.g. "Nand bhai backend Sambhalenge", "Dev tu banner design kar lena").
- **What It Generates**:
  1. **Verbatim Transcript & Language Detected**.
  2. **Official Broadcast Announcement Draft**: Formatted as an inspiring, team-facing announcement ready to publish directly to the club feed with 1-click.
  3. **Key Decisions & Action Items**: Bullet points with emojis highlighting who is leading what.
  4. **Task Matrix**: Actionable tasks mapped to specific members based on attendee name matching, with deadlines and priorities.
- **1-Click Publishing**:
  * Clicking **"📢 Publish as Event Announcement"** immediately broadcasts the formatted post to the club announcement feed.
  * Clicking **"Assign All Tasks"** saves tasks in batch to Neon DB and broadcasts a live Server-Sent Event (SSE) to notify members.

---

## 6. AI Workload Guard (1-Active Task Rule)
- **Problem Solved**: Prevents leader bias and volunteer burnout.
- **The Core Rule**: **Each volunteer is strictly restricted to ONE active task at any moment.**
- **How It Works**:
  * When a leader tries to assign a task to a volunteer who already has an ongoing task:
  * The AI Workload Guard immediately blocks the double assignment.
  * The AI analyzes other free club volunteers (with 0 active tasks) and recommends the best alternate volunteer whose skills match the task.

---

## 7. AI Risk Identification & Smart Skill Reallocation
- **Problem Solved**: When a critical team member falls sick, marks themselves away, or deactivates their account right before an event.
- **How It Works**:
  * When a volunteer deactivates or sets their status to 'Unavailable', the system detects orphaned active tasks.
  * ClubOps AI analyzes the task requirements and the deactivating member's skillset.
  * It compares available free members in the club using AI skill matching.
  * The task is automatically reallocated to the volunteer who has the most compatible skillset and availability score.

---

## 8. User Profile & Availability Settings ('/profile')
- Users can update their:
  * Full Name, Username, College Name, and Mobile Number.
  * Skills list (e.g. Python, React, UI/UX, Graphic Design, Sponsorship, Event Logistics).
- **Availability Toggle**:
  * Toggle between "Available" and "Away / Unavailable".
  * When marking away, users can specify an **"Unavailable Until"** date/time and an **"Unavailable Reason"** (e.g. "End-semester exams", "Medical leave", "Hackathon trip").
  * Once the expiration date passes, the system automatically reactivates the volunteer.

---

## 9. Real-Time Announcements & SSE Feeds
- Leaders can post announcements to the club or event feed.
- Live Server-Sent Events (SSE) push updates in real-time without needing page refreshes.
`;

export interface LivePlatformContext {
  allClubs: Array<{ id: string; name: string; club_code: string; location?: string | null }>;
  allUpcomingEvents: Array<{
    id: string;
    club_name: string;
    name: string;
    venue?: string | null;
    mode: string;
    start_time?: string | null;
    meeting_link?: string | null;
  }>;
}

export interface LiveClubContext {
  user?: {
    userId: string;
    userName: string;
    userEmail: string;
    userSkills: string[];
    isAvailable: boolean;
    unavailableUntil?: string | null;
    unavailableReason?: string | null;
    clubsLed: Array<{ id: string; name: string; club_code: string; location?: string | null }>;
    clubsJoined: Array<{ id: string; name: string; club_code: string; role_type: string; assigned_role?: string | null }>;
    upcomingEvents: Array<{
      id: string;
      club_name: string;
      name: string;
      venue?: string | null;
      mode: string;
      start_time?: string | null;
      meeting_link?: string | null;
    }>;
    assignedTasks: Array<{
      id: string;
      task_name: string;
      club_name?: string;
      event_name?: string;
      status: string;
      deadline?: string | null;
    }>;
  } | null;
  platform: LivePlatformContext;
}

/**
 * Queries Neon PostgreSQL in real-time to fetch the authenticated user's current clubs, events, and tasks,
 * as well as platform-wide active clubs and events.
 */
export async function fetchLiveUserClubOpsContext(userId?: string | null): Promise<LiveClubContext> {
  let platformContext: LivePlatformContext = {
    allClubs: [],
    allUpcomingEvents: [],
  };

  try {
    // 1. Fetch platform-wide active clubs
    const platformClubs = await sql`
      SELECT id, name, club_code, location
      FROM clubs
      ORDER BY created_at DESC
      LIMIT 15
    `;

    // 2. Fetch platform-wide upcoming events
    const platformEvents = await sql`
      SELECT e.id, c.name as club_name, e.name, e.venue, e.mode, e.start_time, e.meeting_link
      FROM events e
      JOIN clubs c ON c.id = e.club_id
      ORDER BY e.start_time ASC NULLS LAST
      LIMIT 15
    `;

    platformContext = {
      allClubs: platformClubs.map((c) => ({
        id: String(c.id),
        name: String(c.name),
        club_code: String(c.club_code),
        location: c.location ? String(c.location) : null,
      })),
      allUpcomingEvents: platformEvents.map((e) => ({
        id: String(e.id),
        club_name: String(e.club_name),
        name: String(e.name),
        venue: e.venue ? String(e.venue) : null,
        mode: String(e.mode || "offline"),
        start_time: e.start_time ? String(e.start_time) : null,
        meeting_link: e.meeting_link ? String(e.meeting_link) : null,
      })),
    };
  } catch (err) {
    console.error("Error fetching platform-wide live context:", err);
  }

  if (!userId) {
    return {
      user: null,
      platform: platformContext,
    };
  }

  try {
    // 3. Fetch user profile
    const userRows = await sql`
      SELECT id, full_name, email, skills, is_available, unavailable_until, unavailable_reason
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (userRows.length === 0) {
      return { user: null, platform: platformContext };
    }
    const u = userRows[0];

    // 4. Fetch clubs led by this user
    const clubsLedRows = await sql`
      SELECT id, name, club_code, location
      FROM clubs
      WHERE leader_id = ${userId}
      ORDER BY created_at DESC
    `;

    // 5. Fetch clubs joined by this user as member/volunteer
    const clubsJoinedRows = await sql`
      SELECT c.id, c.name, c.club_code, cm.role_type, cm.assigned_role
      FROM club_members cm
      JOIN clubs c ON c.id = cm.club_id
      WHERE cm.user_id = ${userId} AND c.leader_id != ${userId}
      ORDER BY cm.joined_at DESC
    `;

    // 6. Fetch upcoming events in user's clubs
    const allClubIds = [
      ...clubsLedRows.map((c) => c.id),
      ...clubsJoinedRows.map((c) => c.id),
    ];

    let upcomingEvents: any[] = [];
    if (allClubIds.length > 0) {
      upcomingEvents = await sql`
        SELECT e.id, c.name as club_name, e.name, e.venue, e.mode, e.start_time, e.meeting_link
        FROM events e
        JOIN clubs c ON c.id = e.club_id
        WHERE e.club_id = ANY(${allClubIds})
        ORDER BY e.start_time ASC NULLS LAST
        LIMIT 10
      `;
    }

    // 7. Fetch active tasks assigned to this user
    const taskRows = await sql`
      SELECT t.id, t.name as task_name, t.status, t.deadline, c.name as club_name, e.name as event_name
      FROM tasks t
      JOIN clubs c ON c.id = t.club_id
      LEFT JOIN events e ON e.id = t.event_id
      WHERE t.assigned_to = ${userId}
      ORDER BY t.created_at DESC
      LIMIT 10
    `;

    return {
      platform: platformContext,
      user: {
        userId: u.id,
        userName: u.full_name || "Club Member",
        userEmail: u.email,
        userSkills: Array.isArray(u.skills) ? u.skills : [],
        isAvailable: u.is_available !== false,
        unavailableUntil: u.unavailable_until ? String(u.unavailable_until) : null,
        unavailableReason: u.unavailable_reason || null,
        clubsLed: clubsLedRows.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          club_code: String(c.club_code),
          location: c.location ? String(c.location) : null,
        })),
        clubsJoined: clubsJoinedRows.map((c) => ({
          id: String(c.id),
          name: String(c.name),
          club_code: String(c.club_code),
          role_type: String(c.role_type),
          assigned_role: c.assigned_role ? String(c.assigned_role) : null,
        })),
        upcomingEvents: upcomingEvents.map((e) => ({
          id: String(e.id),
          club_name: String(e.club_name),
          name: String(e.name),
          venue: e.venue ? String(e.venue) : null,
          mode: String(e.mode || "offline"),
          start_time: e.start_time ? String(e.start_time) : null,
          meeting_link: e.meeting_link ? String(e.meeting_link) : null,
        })),
        assignedTasks: taskRows.map((t) => ({
          id: String(t.id),
          task_name: String(t.task_name),
          club_name: t.club_name ? String(t.club_name) : undefined,
          event_name: t.event_name ? String(t.event_name) : undefined,
          status: String(t.status),
          deadline: t.deadline ? String(t.deadline) : null,
        })),
      },
    };
  } catch (err) {
    console.error("Error fetching live user ClubOps context:", err);
    return { user: null, platform: platformContext };
  }
}

/**
 * Builds the complete system prompt for Groq Cloud.
 */
export function buildSystemPrompt(liveContext: LiveClubContext): string {
  const { user, platform } = liveContext;

  const platformSection = `
---
## LIVE DATABASE STATE (REAL-TIME NEON POSTGRESQL):

### Active Clubs on the Platform (${platform.allClubs.length}):
${
  platform.allClubs.length > 0
    ? platform.allClubs
        .map((c) => `* Club: "${c.name}" | Code: "${c.club_code}" | Location: "${c.location || "Campus"}"`)
        .join("\n")
    : "* (No clubs currently registered)"
}

### Platform Upcoming Scheduled Events (${platform.allUpcomingEvents.length}):
${
  platform.allUpcomingEvents.length > 0
    ? platform.allUpcomingEvents
        .map(
          (e) =>
            `* Event: "${e.name}" in "${e.club_name}" | Mode: ${e.mode} | Venue/Link: "${e.venue || e.meeting_link || "TBD"}" | Time: ${e.start_time ? new Date(e.start_time).toLocaleString() : "Date TBD"}`
        )
        .join("\n")
    : "* (No upcoming events scheduled right now)"
}
`;

  let userSection = "";
  if (user) {
    userSection = `
---
## AUTHENTICATED USER STATE:
- User Name: "${user.userName}"
- Email: "${user.userEmail}"
- Availability: ${user.isAvailable ? "🟢 Available" : `🔴 Away / Unavailable (Reason: ${user.unavailableReason || "None"}, Until: ${user.unavailableUntil || "Not specified"})`}
- Registered Skills: ${user.userSkills.length > 0 ? user.userSkills.join(", ") : "None registered"}

### Clubs Led by this User (${user.clubsLed.length}):
${
  user.clubsLed.length > 0
    ? user.clubsLed
        .map((c) => `  * Club Name: "${c.name}" | Unique Club Code: "${c.club_code}" | Location: "${c.location || "Main Campus"}"`)
        .join("\n")
    : "  * (None currently led)"
}

### Clubs Joined by this User (${user.clubsJoined.length}):
${
  user.clubsJoined.length > 0
    ? user.clubsJoined
        .map((c) => `  * Club Name: "${c.name}" | Club Code: "${c.club_code}" | Role: ${c.role_type} (${c.assigned_role || "General"})`)
        .join("\n")
    : "  * (None currently joined)"
}

### User's Upcoming Events (${user.upcomingEvents.length}):
${
  user.upcomingEvents.length > 0
    ? user.upcomingEvents
        .map(
          (e) =>
            `  * Event: "${e.name}" in club "${e.club_name}" | Mode: ${e.mode} | Venue: "${e.venue || e.meeting_link || "TBD"}" | Date: ${e.start_time ? new Date(e.start_time).toLocaleString() : "TBD"}`
        )
        .join("\n")
    : "  * (No events currently scheduled in user's clubs)"
}

### Tasks Assigned to this User (${user.assignedTasks.length}):
${
  user.assignedTasks.length > 0
    ? user.assignedTasks
        .map(
          (t) =>
            `  * Task: "${t.task_name}" | Event: "${t.event_name || t.club_name || "General"}" | Status: ${t.status} | Deadline: ${t.deadline || "No deadline"}`
        )
        .join("\n")
    : "  * (0 active tasks assigned to this user - 100% free!)"
}
`;
  } else {
    userSection = `
---
## USER STATE:
The user is currently browsing as a guest (not logged in). They can still ask about any public club or event on the platform, or ask questions about ClubOps AI features. Encourage them to sign in or create an account to start leading clubs, organizing events, and assigning tasks.
`;
  }

  return `
You are the official **ClubOps AI Copilot**, an intelligent, friendly, and expert assistant dedicated EXCLUSIVELY to helping users with the **ClubOps AI** website and its features.

${WEBSITE_KNOWLEDGE_MANUAL}

${platformSection}

${userSection}

---
## STRICT OPERATIONAL GUARDRAILS & BOUNDARIES:

1. **WEBSITE-ONLY SCOPE**:
   - You MUST answer questions ONLY about ClubOps AI, its features, workflows (creating clubs, club codes, joining, event management, AI meeting summarizer, AI workload guard, volunteer task allocation, profile availability), and the live clubs and events listed above.
   - If the user asks about anything unrelated (e.g. general Python/JavaScript homework, general world history, cooking recipes, weather, celebrity gossip, stock market, etc.):
     * DO NOT answer the off-topic question.
     * Politely decline with a helpful, courteous response:
       "I am dedicated exclusively to assisting with ClubOps AI and college club operations. How can I help you with your clubs, events, volunteer tasks, or meeting summaries today?"

2. **REAL-TIME ACCURACY (LIVE NEON DB REFLECTION)**:
   - When asked about clubs, club codes, events, or tasks, use the LIVE DATABASE STATE above!
   - If they just created a club or event, refer to it by its exact name, club code, venue, and timings.
   - If they ask "What is my club code?" or "What clubs exist?", provide the actual club codes (e.g. "CLB-XXXXXX") and explain how students can use them to submit join requests.

3. **TONE & FORMATTING**:
   - Professional, inspiring, approachable, and encouraging.
   - Use clean Markdown formatting: bold text, bullet points, and clear steps.
   - Keep answers concise, clear, and action-oriented.

4. **NO DEVELOPER OR INFRASTRUCTURE JARGON**:
   - NEVER mention internal backend infrastructure, database vendors, or model providers (such as "Neon", "Postgres", "Groq", "Llama", "Vector DB", or "database schema") to the user.
   - Always refer to data naturally as "ClubOps AI records", "your club directory", "the platform", or "the event schedule".
`;
}
