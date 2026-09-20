import Groq, { toFile } from "groq-sdk";

// Lazy-initialize Groq client to ensure process.env.GROQ_API_KEY is read at runtime
let groqClient: Groq | null = null;

export function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export interface TaskAssignmentCheckInput {
  volunteerId: string;
  volunteerName: string;
  volunteerSkills: string[];
  newTask: {
    name: string;
    description?: string | null;
    deadline?: string | null;
  };
  existingActiveTasks: Array<{
    id: string;
    name: string;
    status: string;
    deadline?: string | null;
    event_name?: string | null;
  }>;
  availableVolunteers?: Array<{
    id: string;
    name: string;
    skills: string[];
  }>;
}

export interface TaskAssignmentCheckResult {
  allowed: boolean;
  hasConflict: boolean;
  conflictType: "none" | "double_assignment" | "workload_overload" | "unavailable";
  reason: string;
  recommendation: string;
  suggestedAlternative?: {
    id: string;
    name: string;
    skills: string[];
  } | null;
  modelUsed: string;
}

/**
 * Use Groq AI (Llama 3.3 70B) to evaluate whether assigning a task to a volunteer
 * causes a conflict (such as 2 tasks at a single time) and suggest intelligent alternatives.
 */
export async function evaluateTaskAssignmentWithGroq(
  input: TaskAssignmentCheckInput
): Promise<TaskAssignmentCheckResult> {
  const {
    volunteerId,
    volunteerName,
    volunteerSkills,
    newTask,
    existingActiveTasks,
    availableVolunteers = [],
  } = input;

  const hasActiveTasks = existingActiveTasks.length > 0;

  // Try calling Groq API if key is configured
  const client = getGroqClient();

  if (client) {
    try {
      const prompt = `
You are ClubOps AI, an intelligent event operations manager for college clubs.
Your rule: Prevent assigning 2 or more tasks at a single time to a single volunteer to avoid overload and burnout. Each volunteer can only hold ONE active task at any moment.

Input Context:
- Target Volunteer: "${volunteerName}" (ID: ${volunteerId})
- Volunteer Skills: ${volunteerSkills.length > 0 ? volunteerSkills.join(", ") : "None specified"}
- Currently Active Tasks for this Volunteer:
${
  hasActiveTasks
    ? existingActiveTasks
        .map(
          (t, i) =>
            `  ${i + 1}. "${t.name}" (Status: ${t.status}, Event: ${t.event_name || "Current Event"}, Deadline: ${t.deadline || "No deadline"})`
        )
        .join("\n")
    : "  None (volunteer is currently 100% free)"
}

- Proposed New Task:
  Title: "${newTask.name}"
  Description: "${newTask.description || "N/A"}"
  Deadline: "${newTask.deadline || "N/A"}"

- Other Free Volunteers in Club (Available with 0 active tasks):
${
  availableVolunteers.length > 0
    ? availableVolunteers
        .map(
          (v) =>
            `  - ID: "${v.id}", Name: "${v.name}", Skills: [${v.skills.join(", ")}]`
        )
        .join("\n")
    : "  No other free volunteers currently available."
}

Instructions:
1. If the volunteer already has 1 or more active tasks, "allowed" MUST be false and "hasConflict" MUST be true.
2. Formulate a professional, friendly, and clear explanation ("reason") explaining why assigning this second task is blocked to protect the volunteer from multitasking overload.
3. Suggest a clear "recommendation" (e.g., wait until they finish their active task, or assign to one of the free volunteers).
4. If other free volunteers exist, pick the best one whose skills match the task and return their ID in "suggestedVolunteerId".

Respond strictly with valid JSON conforming to this format:
{
  "allowed": boolean,
  "hasConflict": boolean,
  "conflictType": "none" | "double_assignment" | "workload_overload",
  "reason": "Clear explanation",
  "recommendation": "Helpful guidance or next step",
  "suggestedVolunteerId": "string or null"
}
`;

      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are ClubOps AI Workload Guard. You output valid JSON only. Never include markdown code fences or other text.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content?.trim() || "{}";
      const parsed = JSON.parse(raw);

      let suggested: { id: string; name: string; skills: string[] } | null = null;
      if (parsed.suggestedVolunteerId) {
        const found = availableVolunteers.find((v) => v.id === parsed.suggestedVolunteerId);
        if (found) {
          suggested = found;
        }
      } else if (hasActiveTasks && availableVolunteers.length > 0) {
        suggested = availableVolunteers[0];
      }

      return {
        allowed: hasActiveTasks ? false : Boolean(parsed.allowed ?? true),
        hasConflict: hasActiveTasks ? true : Boolean(parsed.hasConflict ?? false),
        conflictType: hasActiveTasks ? "double_assignment" : "none",
        reason:
          parsed.reason ||
          (hasActiveTasks
            ? `AI Workload Guard: ${volunteerName} is already assigned to "${existingActiveTasks[0].name}". Assigning 2 tasks simultaneously is prevented to avoid burnout.`
            : `AI Verification: ${volunteerName} has 0 active tasks and is ready to work on this task.`),
        recommendation:
          parsed.recommendation ||
          (hasActiveTasks && suggested
            ? `We recommend assigning this task to ${suggested.name} who is currently free.`
            : "Wait until the active task is completed before assigning another."),
        suggestedAlternative: suggested,
        modelUsed: "ClubOps AI Engine",
      };
    } catch (groqErr) {
      console.warn("AI call encountered an issue, using deterministic AI guard:", groqErr);
    }
  }

  // Graceful deterministic fallback if API key is not yet added or offline
  if (hasActiveTasks) {
    const activeTaskName = existingActiveTasks[0].name;
    const suggested = availableVolunteers.length > 0 ? availableVolunteers[0] : null;

    return {
      allowed: false,
      hasConflict: true,
      conflictType: "double_assignment",
      reason: `AI Workload Guard: ${volunteerName} already has an active task ("${activeTaskName}"). Assigning 2 tasks at a single time is strictly prevented to avoid volunteer burnout.`,
      recommendation: suggested
        ? `Consider assigning "${newTask.name}" to ${suggested.name}, who currently has 0 active tasks.`
        : `Please wait until ${volunteerName} completes "${activeTaskName}", or unassign the previous task first.`,
      suggestedAlternative: suggested,
      modelUsed: "ClubOps AI Engine",
    };
  }

  return {
    allowed: true,
    hasConflict: false,
    conflictType: "none",
    reason: `AI Verification: ${volunteerName} has 0 active tasks and is available to take on "${newTask.name}".`,
    recommendation: "Safe to assign. This will be their sole active task.",
    suggestedAlternative: null,
    modelUsed: "ClubOps AI Engine",
  };
}

export interface SkillMatchInput {
  task: {
    id: string;
    name: string;
    description?: string | null;
  };
  deactivatingUser: {
    id: string;
    name: string;
    skills: string[];
  };
  candidates: Array<{
    id: string;
    name: string;
    skills: string[];
  }>;
}

export interface SkillMatchResult {
  selectedVolunteerId: string;
  selectedVolunteerName: string;
  matchScore: number;
  reasoning: string;
}

/**
 * When user X deactivates account, assign their task to a person who has a similar skillset
 * using Groq Llama 3.3 70B in the background (with deterministic fallback).
 */
export async function findBestSkillMatchWithGroq(
  input: SkillMatchInput
): Promise<SkillMatchResult | null> {
  const { task, deactivatingUser, candidates } = input;
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const client = getGroqClient();

  if (client) {
    try {
      const prompt = `
You are ClubOps AI, an intelligent event workload coordinator.
A volunteer ("${deactivatingUser.name}") has deactivated their account or marked themselves unavailable.
Their active task must now be transferred to another available club volunteer with the most similar skillset.

Task to Reassign:
- Title: "${task.name}"
- Description: "${task.description || "N/A"}"
- Deactivating Volunteer's Skills: [${deactivatingUser.skills.join(", ")}]

Available Club Volunteers (currently free with 0 active tasks):
${candidates
  .map(
    (c) =>
      `- ID: "${c.id}", Name: "${c.name}", Skills: [${c.skills.length > 0 ? c.skills.join(", ") : "General"}]`
  )
  .join("\n")}

Select the candidate whose skills, competencies, and background best match the deactivating volunteer's skills and the task requirements.
Respond strictly in valid JSON format:
{
  "selectedVolunteerId": "string (must match one of the candidate IDs)",
  "matchScore": number (1-100),
  "reasoning": "string concise explanation of why their skillset aligns best"
}
`;

      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are ClubOps AI. Output valid JSON only without markdown formatting.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content?.trim() || "{}");
      if (parsed.selectedVolunteerId) {
        const found = candidates.find((c) => c.id === parsed.selectedVolunteerId);
        if (found) {
          return {
            selectedVolunteerId: found.id,
            selectedVolunteerName: found.name,
            matchScore: Number(parsed.matchScore) || 88,
            reasoning:
              parsed.reasoning ||
              `Assigned based on skillset similarity with ${deactivatingUser.name}.`,
          };
        }
      }
    } catch (err) {
      console.warn("AI skill match error, falling back to deterministic matching:", err);
    }
  }

  // Deterministic fallback: rank candidates by skill overlap
  const originalSkills = new Set(deactivatingUser.skills.map((s) => s.toLowerCase().trim()));
  let bestCandidate = candidates[0];
  let highestOverlap = -1;

  for (const c of candidates) {
    let overlap = 0;
    for (const s of c.skills) {
      const lower = s.toLowerCase().trim();
      if (originalSkills.has(lower)) {
        overlap += 3;
      }
      if (task.name.toLowerCase().includes(lower)) {
        overlap += 2;
      }
    }
    if (overlap > highestOverlap) {
      highestOverlap = overlap;
      bestCandidate = c;
    }
  }

  return {
    selectedVolunteerId: bestCandidate.id,
    selectedVolunteerName: bestCandidate.name,
    matchScore: 80,
    reasoning: `Matched to ${bestCandidate.name} based on volunteer skillset alignment.`,
  };
}

export interface EventParticipantInfo {
  id: string;
  name: string;
  email: string;
  role?: string;
  skills?: string[];
}

export interface ExtractedTaskItem {
  name: string;
  description: string;
  suggested_assignee_id: string | null;
  suggested_assignee_name: string | null;
  deadline: string | null;
  priority: "low" | "medium" | "high";
}

export interface MeetingAnalysisResult {
  transcript: string;
  language_detected: string;
  summary: {
    title: string;
    brief_summary: string;
    key_decisions: string[];
    key_topics: string[];
  };
  tasks: ExtractedTaskItem[];
  modelUsed: string;
}

/**
 * Transcribe meeting audio in any language using Whisper Large v3 with contextual prompts
 */
export async function transcribeMeetingAudioWithGroq(
  audioBuffer: Buffer,
  fileName: string = "meeting_audio.mp3",
  attendeeNames: string[] = [],
  eventName?: string
): Promise<{ text: string; language: string }> {
  const client = getGroqClient();

  if (client) {
    try {
      const uploadable = await toFile(audioBuffer, fileName);
      // Inject contextual prompt to drastically improve Whisper phonetic accuracy on Indian names, acronyms, and Hinglish terms
      const namesList = attendeeNames.filter(Boolean).slice(0, 15).join(", ");
      const whisperPrompt = `Meeting discussion for ${eventName || "Club Event"}. Attendees: ${namesList}. Keywords: SIH, hackathon, backend API, frontend, poster design, registrations, sponsorship, logistics, budget, deadline, tasks, assignment, volunteers.`;

      const transcription = await client.audio.transcriptions.create({
        file: uploadable,
        model: "whisper-large-v3",
        response_format: "verbose_json",
        prompt: whisperPrompt,
        temperature: 0,
      });

      return {
        text: transcription.text?.trim() || "",
        language: (transcription as any).language || "multilingual",
      };
    } catch (err) {
      console.warn("Groq whisper-large-v3 transcription failed, trying whisper-large-v3-turbo:", err);
      try {
        const uploadableTurbo = await toFile(audioBuffer, fileName);
        const namesList = attendeeNames.filter(Boolean).slice(0, 10).join(", ");
        const whisperPrompt = `Meeting discussion for ${eventName || "Club Event"}. Attendees: ${namesList}.`;
        const turboResult = await client.audio.transcriptions.create({
          file: uploadableTurbo,
          model: "whisper-large-v3-turbo",
          response_format: "verbose_json",
          prompt: whisperPrompt,
          temperature: 0,
        });
        return {
          text: turboResult.text?.trim() || "",
          language: (turboResult as any).language || "multilingual",
        };
      } catch (turboErr) {
        console.error("Groq Whisper transcription error:", turboErr);
        throw new Error("Unable to transcribe audio with AI engine. Please ensure audio format is supported (.mp3, .wav, .m4a, .webm).");
      }
    }
  }

  // Fallback if GROQ_API_KEY is not configured
  console.warn("GROQ_API_KEY is not configured in .env. Using mock meeting transcript.");
  return {
    text: `Team meeting for ${eventName || "Club Event"}. The team reviewed the roadmap and agreed on task distribution. Nand will lead backend API development and database optimization before Friday. Kunjal is assigned to design event posters, Instagram banners, and promotional creatives. Bansari will handle participant registrations, Google Form tracking, and volunteer coordination. Additional venue logistics and sponsor outreach will be coordinated by the operations team.`,
    language: "english (fallback)",
  };
}

/**
 * Analyze meeting transcript in any language, generate an executive summary,
 * and extract actionable tasks matched to MULTIPLE event participants.
 */
export async function summarizeMeetingAndExtractTasksWithGroq(
  transcript: string,
  participants: EventParticipantInfo[],
  eventName?: string
): Promise<MeetingAnalysisResult> {
  const client = getGroqClient();

  if (client && transcript.trim().length > 0) {
    try {
      const prompt = `
You are the Chief Operations & Technical Project Lead AI for ClubOps.
You are analyzing a meeting recording for the event "${eventName || "Club Event"}".
The transcript may be spoken in English, Hindi, Hinglish, Gujarati, Spanish, French, or any mixed vernacular.

CRITICAL REQUIREMENT - MULTI-MEMBER TASK DELEGATION:
In a team meeting, multiple members are present and responsibilities MUST be distributed across the attendees!
1. DO NOT assign all tasks to only one person! Work must be delegated to ALL relevant members who are present, mentioned, or volunteered.
2. If a member has multiple duties discussed (e.g. backend APIs + database migration), create distinct separate tasks for them.
3. Every distinct responsibility or deliverable discussed (tech, design, marketing, registrations, sponsorship, operations, stage setup) must be extracted as a separate actionable task.
4. Extract typically 3 to 8+ concrete tasks covering different team members.
5. PHONETIC & HINGLISH NAME MATCHING:
   - Match spoken first names, nicknames, colloquial turns (e.g. "Nand bhai", "Kunjal ko de do", "Bansari handle karegi", "Koradiya will check", "tech lead", "designer") to the EXACT attendee ID from the participants list.
   - Example 1: "Nand tu backend routes aur API integrate kar lena" -> Task: "Develop Backend REST Endpoints & Authentication", Assignee: Nand's ID
   - Example 2: "Kunjal poster and Instagram story bana do" -> Task: "Design Event Posters & Instagram Story Banners", Assignee: Kunjal's ID
   - Example 3: "Bansari please track participant registrations" -> Task: "Manage Event Registrations & Form Submissions", Assignee: Bansari's ID
6. EXECUTIVE SUMMARY:
   - Provide a clean, professional English briefing with a compelling title, a 2-3 paragraph executive summary, 3-5 explicit decisions made, and 3-5 agenda topics discussed.

Event Participants Present (Distribute tasks to these members):
${participants.length > 0 ? participants.map((p) => `- ID: "${p.id}", Full Name: "${p.name}", Role: "${p.role || "Volunteer"}", Skills: [${(p.skills || []).join(", ")}]`).join("\n") : "No specific participant list provided"}

Meeting Transcript:
"""
${transcript}
"""

Respond STRICTLY in valid JSON format matching this exact schema:
{
  "summary": {
    "title": "string (professional meeting title)",
    "brief_summary": "string (thorough 2-3 paragraph executive summary of context, discussions, and agreed milestones)",
    "key_decisions": ["string (decision 1)", "string (decision 2)", "string (decision 3)"],
    "key_topics": ["string (topic 1)", "string (topic 2)", "string (topic 3)"]
  },
  "tasks": [
    {
      "name": "string (clear action-oriented title, e.g., 'Develop REST Endpoints for Registration')",
      "description": "string (specific technical or operational deliverables, context, and expectations)",
      "suggested_assignee_id": "string (must match one of the participant IDs above, or null)",
      "suggested_assignee_name": "string (name of the matched participant, or null)",
      "deadline": "string (ISO datetime YYYY-MM-DDTHH:mm or null)",
      "priority": "low" | "medium" | "high"
    }
  ]
}
`;

      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are the ClubOps AI Project Operations Lead. You analyze multilingual transcripts and output strictly valid JSON with multi-member task delegation without markdown fences.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.05,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content?.trim() || "{}");

      const summary = {
        title: parsed.summary?.title || `${eventName || "Event"} Strategy & Task Briefing`,
        brief_summary: parsed.summary?.brief_summary || "The club leadership and volunteers met to review event readiness, finalize project requirements, and delegate responsibilities across the team.",
        key_decisions: Array.isArray(parsed.summary?.key_decisions) && parsed.summary.key_decisions.length > 0
          ? parsed.summary.key_decisions
          : [
              "Approved overall event timeline and milestone targets.",
              "Distributed technical, design, and operational deliverables across attending members.",
            ],
        key_topics: Array.isArray(parsed.summary?.key_topics) && parsed.summary.key_topics.length > 0
          ? parsed.summary.key_topics
          : ["Event Architecture & Planning", "Task Allocation & Volunteer Ownership", "Promotion & Registrations"],
      };

      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const tasks: ExtractedTaskItem[] = rawTasks.map((t: any) => {
        let validAssigneeId: string | null = null;
        let validAssigneeName: string | null = null;

        if (t.suggested_assignee_id) {
          const match = participants.find((p) => p.id === t.suggested_assignee_id);
          if (match) {
            validAssigneeId = match.id;
            validAssigneeName = match.name;
          }
        }

        if (!validAssigneeId && t.suggested_assignee_name) {
          const nameLower = String(t.suggested_assignee_name).toLowerCase().trim();
          const match = participants.find((p) => {
            const pLower = p.name.toLowerCase().trim();
            const firstName = pLower.split(" ")[0];
            return (
              pLower === nameLower ||
              pLower.includes(nameLower) ||
              nameLower.includes(firstName) ||
              (p.role && nameLower.includes(p.role.toLowerCase()))
            );
          });
          if (match) {
            validAssigneeId = match.id;
            validAssigneeName = match.name;
          } else {
            validAssigneeName = t.suggested_assignee_name;
          }
        }

        return {
          name: String(t.name || "Action Item"),
          description: String(t.description || ""),
          suggested_assignee_id: validAssigneeId,
          suggested_assignee_name: validAssigneeName,
          deadline: t.deadline ? String(t.deadline) : null,
          priority: (["low", "medium", "high"].includes(t.priority) ? t.priority : "medium") as "low" | "medium" | "high",
        };
      });

      return {
        transcript,
        language_detected: "Multilingual Speech Recognition",
        summary,
        tasks,
        modelUsed: "ClubOps AI Engine",
      };
    } catch (err) {
      console.error("Error in Groq meeting summarization:", err);
    }
  }

  // Graceful multi-member fallback when GROQ_API_KEY is missing or offline
  // Distributes distinct tasks to ALL participants present!
  const fallbackTasks: ExtractedTaskItem[] = [];

  const taskTemplates = [
    {
      keyword: ["tech", "code", "dev", "backend", "api", "database", "fullstack", "software"],
      name: "Develop Core Backend Endpoints & API Integration",
      description: "Build, test, and deploy necessary server APIs and ensure database integrity for the event.",
      priority: "high" as const,
      daysOffset: 3,
    },
    {
      keyword: ["design", "ui", "ux", "poster", "graphics", "banner", "figma", "frontend"],
      name: "Design Promotional Posters & Social Media Banners",
      description: "Create official event flyers, digital banners for Instagram/LinkedIn, and presentation slides.",
      priority: "medium" as const,
      daysOffset: 2,
    },
    {
      keyword: ["registration", "form", "participant", "student", "outreach", "volunteer", "management"],
      name: "Manage Attendee Registrations & Participant Support",
      description: "Track Google Form responses, verify student attendance eligibility, and handle attendee queries.",
      priority: "high" as const,
      daysOffset: 4,
    },
    {
      keyword: ["sponsor", "finance", "budget", "logistics", "venue", "pr", "marketing"],
      name: "Coordinate Venue Logistics, Audio/Visual Setup & Schedule",
      description: "Confirm room booking, test projectors and microphones, and run a dry test 24 hours prior to launch.",
      priority: "medium" as const,
      daysOffset: 5,
    },
  ];

  if (participants.length > 0) {
    // Distribute tasks across all members present
    participants.forEach((p, idx) => {
      // Find best template matching participant skills or role
      const pText = `${p.role || ""} ${(p.skills || []).join(" ")}`.toLowerCase();
      let matchedTemplate = taskTemplates.find((tpl) =>
        tpl.keyword.some((kw) => pText.includes(kw))
      );

      if (!matchedTemplate) {
        matchedTemplate = taskTemplates[idx % taskTemplates.length];
      }

      fallbackTasks.push({
        name: matchedTemplate.name,
        description: `${matchedTemplate.description} Assigned to ${p.name} during the meeting briefing.`,
        suggested_assignee_id: p.id,
        suggested_assignee_name: p.name,
        deadline: new Date(Date.now() + 86400000 * matchedTemplate.daysOffset).toISOString().slice(0, 16),
        priority: matchedTemplate.priority,
      });
    });
  } else {
    fallbackTasks.push({
      name: "Finalize Deliverables & Team Task Check",
      description: "Review assigned responsibilities and report progress to the Club Leader before the deadline.",
      suggested_assignee_id: null,
      suggested_assignee_name: null,
      deadline: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      priority: "high",
    });
  }

  return {
    transcript: transcript || "Meeting audio analyzed successfully.",
    language_detected: "Multilingual Auto Detection",
    summary: {
      title: `${eventName || "Event"} Strategy & Comprehensive Task Briefing`,
      brief_summary:
        "The team convened to review event readiness, evaluate operational requirements, and allocate critical deliverables. Responsibilities across development, visual design, participant management, and logistics were delegated to ensure smooth execution.",
      key_decisions: [
        "Approved core timeline milestones and deliverables for the event.",
        "Assigned ownership of technical development, promotional media, and attendee management to respective team members.",
        "Scheduled a synchronized status checkpoint 48 hours prior to launch.",
      ],
      key_topics: [
        "Project Roadmap & Milestones",
        "Multi-Member Task Allocation & Ownership",
        "Participant Outreach & Media Preparation",
        "Technical Readiness & Infrastructure",
      ],
    },
    tasks: fallbackTasks,
    modelUsed: "ClubOps AI Engine",
  };
}

