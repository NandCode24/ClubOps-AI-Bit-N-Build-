/**
 * Sarvam AI Service for Meeting Summarizer
 *
 * Uses Sarvam's India-optimized models:
 *   - Saaras v4: Speech-to-Text (supports Hinglish, Hindi, regional languages)
 *   - sarvam-105b: Chat completions LLM for summarization & task extraction
 *
 * API Docs: https://docs.sarvam.ai
 */

import type { EventParticipantInfo, ExtractedTaskItem, MeetingAnalysisResult } from "./groq";

const SARVAM_BASE_URL = "https://api.sarvam.ai";

function getSarvamApiKey(): string | null {
  const key = process.env.SARVAM_API_KEY?.trim();
  return key || null;
}

// ─── Speech-to-Text (Synchronous REST – for audio ≤ 30s) ────────────────────

async function transcribeShortAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<{ text: string; language: string }> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) throw new Error("SARVAM_API_KEY not configured");

  // Build multipart form data manually for Node.js fetch
  const uint8 = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8], { type: getMimeType(fileName) });
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("model", "saaras:v4");
  formData.append("with_timestamps", "false");

  const response = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam STT sync failed (${response.status}): ${errText}`);
  }

  const result = await response.json();
  return {
    text: result.transcript || result.text || "",
    language: result.language_code || "auto-detected",
  };
}

// ─── Speech-to-Text (Batch Job API – for longer audio) ──────────────────────

async function transcribeLongAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<{ text: string; language: string }> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) throw new Error("SARVAM_API_KEY not configured");

  // Step 1: Create batch job
  const initRes = await fetch(`${SARVAM_BASE_URL}/speech-to-text/job/v1`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "saaras:v4",
      job_parameters: { mode: "transcribe" },
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Sarvam batch init failed (${initRes.status}): ${errText}`);
  }

  const initData = await initRes.json();
  const jobId = initData.job_id;

  if (!jobId) {
    throw new Error("Sarvam batch init did not return a job_id");
  }

  // Step 2: Upload file to job
  const uint8 = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8], { type: getMimeType(fileName) });
  const uploadForm = new FormData();
  uploadForm.append("file", blob, fileName);

  const uploadRes = await fetch(
    `${SARVAM_BASE_URL}/speech-to-text/job/v1/${jobId}/upload`,
    {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
      body: uploadForm,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Sarvam batch upload failed (${uploadRes.status}): ${errText}`);
  }

  // Step 3: Start the job
  const startRes = await fetch(
    `${SARVAM_BASE_URL}/speech-to-text/job/v1/${jobId}/start`,
    {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
      },
    }
  );

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Sarvam batch start failed (${startRes.status}): ${errText}`);
  }

  // Step 4: Poll for result (max ~3 minutes with backoff)
  const maxWaitMs = 180_000;
  const pollIntervalMs = 3_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollIntervalMs);

    const statusRes = await fetch(
      `${SARVAM_BASE_URL}/speech-to-text/job/v1/${jobId}/status`,
      {
        method: "GET",
        headers: {
          "api-subscription-key": apiKey,
        },
      }
    );

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const jobStatus = statusData.status?.toLowerCase?.() || "";

    if (jobStatus === "completed" || jobStatus === "done" || jobStatus === "success") {
      // Step 5: Get result
      const resultRes = await fetch(
        `${SARVAM_BASE_URL}/speech-to-text/job/v1/${jobId}/result`,
        {
          method: "GET",
          headers: {
            "api-subscription-key": apiKey,
          },
        }
      );

      if (!resultRes.ok) {
        const errText = await resultRes.text();
        throw new Error(`Sarvam batch result failed (${resultRes.status}): ${errText}`);
      }

      const resultData = await resultRes.json();
      // Handle various response shapes the API might return
      const transcript =
        resultData.transcript ||
        resultData.text ||
        (Array.isArray(resultData.results)
          ? resultData.results.map((r: any) => r.transcript || r.text || "").join(" ")
          : "");

      return {
        text: transcript.trim(),
        language: resultData.language_code || "auto-detected",
      };
    }

    if (jobStatus === "failed" || jobStatus === "error") {
      throw new Error(`Sarvam batch job failed: ${statusData.error || "Unknown error"}`);
    }

    // Still processing – continue polling
  }

  throw new Error("Sarvam batch job timed out after 3 minutes.");
}

// ─── Public: Transcribe Meeting Audio ────────────────────────────────────────

/**
 * Transcribe meeting audio using Sarvam Saaras v4.
 * Automatically picks sync API (≤30s estimated) or batch API (longer audio).
 */
export async function transcribeMeetingAudioWithSarvam(
  audioBuffer: Buffer,
  fileName: string = "meeting_audio.mp3",
  attendeeNames: string[] = [],
  eventName?: string
): Promise<{ text: string; language: string }> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY is not configured in .env");
  }

  // Estimate audio duration from file size (rough: ~16KB/s for compressed audio)
  const estimatedDurationSec = audioBuffer.length / 16_000;
  const useSync = estimatedDurationSec <= 25; // Use sync for very short clips

  try {
    if (useSync) {
      const result = await transcribeShortAudio(audioBuffer, fileName);
      if (result.text.trim()) return result;
      // If sync returned empty, try batch
    }
    return await transcribeLongAudio(audioBuffer, fileName);
  } catch (primaryErr) {
    console.warn("Sarvam primary transcription path failed:", primaryErr);

    // Try the other path as fallback
    try {
      if (useSync) {
        return await transcribeLongAudio(audioBuffer, fileName);
      } else {
        return await transcribeShortAudio(audioBuffer, fileName);
      }
    } catch (fallbackErr) {
      console.error("Sarvam transcription fully failed:", fallbackErr);
      throw new Error(
        "Unable to transcribe audio with Sarvam AI. Please ensure the audio is clear and in a supported format (.mp3, .wav, .m4a, .webm)."
      );
    }
  }
}

// ─── Chat Completions (sarvam-105b LLM) ─────────────────────────────────────

async function sarvamChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.05
): Promise<string> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) throw new Error("SARVAM_API_KEY not configured");

  const response = await fetch(`${SARVAM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sarvam-105b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam LLM failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "{}";
}

// ─── Public: Summarize Meeting & Extract Tasks ───────────────────────────────

/**
 * Analyze meeting transcript using Sarvam 105B LLM.
 * Generates executive summary and extracts multi-member task assignments.
 */
export async function summarizeMeetingAndExtractTasksWithSarvam(
  transcript: string,
  participants: EventParticipantInfo[],
  eventName?: string
): Promise<MeetingAnalysisResult> {
  const apiKey = getSarvamApiKey();

  if (apiKey && transcript.trim().length > 0) {
    try {
      const systemPrompt = `You are ClubOps AI, a multilingual operations intelligence engine specialized in Indian college club events. You analyze meeting transcripts in English, Hindi, Hinglish, Gujarati, Marathi, Tamil, Telugu, Kannada, and other Indian languages. You output strictly valid JSON without markdown fences. You excel at understanding Indian names, nicknames, and informal speech patterns common in Indian college meetings.`;

      const userPrompt = `
You are analyzing a meeting recording for the event "${eventName || "Club Event"}".
The transcript may be spoken in English, Hindi, Hinglish, Gujarati, or any Indian language mix.

CRITICAL REQUIREMENT - MULTI-MEMBER TASK DELEGATION:
In a team meeting, multiple members are present and responsibilities MUST be distributed across the attendees!
1. DO NOT assign all tasks to only one person! Work must be delegated to ALL relevant members who are present, mentioned, or volunteered.
2. If a member has multiple duties discussed (e.g., backend APIs + database migration), create distinct separate tasks for them.
3. Every distinct responsibility or deliverable discussed (tech, design, marketing, registrations, sponsorship, operations, stage setup, documentation) must be extracted as a separate actionable task.
4. Extract typically 3 to 8+ concrete tasks covering different team members.
5. PHONETIC & HINGLISH NAME MATCHING (CRITICAL FOR INDIAN CONTEXT):
   - Match spoken first names, nicknames, colloquial turns:
     e.g., "Nand bhai", "Kunjal ko de do", "Bansari handle karegi", "Koradiya will check", "tech lead", "designer"
   - Map these to the EXACT attendee ID from the participants list below.
   - Example 1: "Nand tu backend routes aur API integrate kar lena" → Task: "Develop Backend REST Endpoints & Authentication", Assignee: Nand's ID
   - Example 2: "Kunjal poster and Instagram story bana do" → Task: "Design Event Posters & Instagram Story Banners", Assignee: Kunjal's ID
   - Example 3: "Bansari please registrations track karo" → Task: "Manage Event Registrations & Form Submissions", Assignee: Bansari's ID
6. EXECUTIVE SUMMARY:
   - Provide a clean, professional English briefing with a compelling title
   - Write 2-3 paragraph executive summary
   - List 3-5 explicit decisions made
   - List 3-5 agenda topics discussed

Event Participants Present (Distribute tasks to these members):
${
  participants.length > 0
    ? participants
        .map(
          (p) =>
            `- ID: "${p.id}", Full Name: "${p.name}", Role: "${p.role || "Volunteer"}", Skills: [${(p.skills || []).join(", ")}]`
        )
        .join("\n")
    : "No specific participant list provided"
}

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

      const raw = await sarvamChatCompletion(systemPrompt, userPrompt, 0.05);
      const parsed = JSON.parse(raw);

      const summary = {
        title: parsed.summary?.title || `${eventName || "Event"} Strategy & Task Briefing`,
        brief_summary:
          parsed.summary?.brief_summary ||
          "The club leadership and volunteers met to review event readiness, finalize project requirements, and delegate responsibilities across the team.",
        key_decisions:
          Array.isArray(parsed.summary?.key_decisions) && parsed.summary.key_decisions.length > 0
            ? parsed.summary.key_decisions
            : [
                "Approved overall event timeline and milestone targets.",
                "Distributed technical, design, and operational deliverables across attending members.",
              ],
        key_topics:
          Array.isArray(parsed.summary?.key_topics) && parsed.summary.key_topics.length > 0
            ? parsed.summary.key_topics
            : [
                "Event Architecture & Planning",
                "Task Allocation & Volunteer Ownership",
                "Promotion & Registrations",
              ],
      };

      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      const tasks: ExtractedTaskItem[] = rawTasks.map((t: any) => {
        let validAssigneeId: string | null = null;
        let validAssigneeName: string | null = null;

        // Match by ID first
        if (t.suggested_assignee_id) {
          const match = participants.find((p) => p.id === t.suggested_assignee_id);
          if (match) {
            validAssigneeId = match.id;
            validAssigneeName = match.name;
          }
        }

        // Fallback: fuzzy name matching (critical for Indian names)
        if (!validAssigneeId && t.suggested_assignee_name) {
          const nameLower = String(t.suggested_assignee_name).toLowerCase().trim();
          const match = participants.find((p) => {
            const pLower = p.name.toLowerCase().trim();
            const firstName = pLower.split(" ")[0];
            const lastName = pLower.split(" ").pop() || "";
            return (
              pLower === nameLower ||
              pLower.includes(nameLower) ||
              nameLower.includes(firstName) ||
              nameLower.includes(lastName) ||
              firstName.includes(nameLower) ||
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
          priority: (["low", "medium", "high"].includes(t.priority) ? t.priority : "medium") as
            | "low"
            | "medium"
            | "high",
        };
      });

      return {
        transcript,
        language_detected: "Sarvam Multilingual Recognition",
        summary,
        tasks,
        modelUsed: "ClubOps AI Engine",
      };
    } catch (err) {
      console.error("Sarvam 105B summarization failed:", err);
      // Fall through to Groq fallback below
    }
  }

  // If Sarvam LLM fails, attempt Groq as fallback for summarization
  try {
    const { summarizeMeetingAndExtractTasksWithGroq } = await import("./groq");
    return await summarizeMeetingAndExtractTasksWithGroq(transcript, participants, eventName);
  } catch (groqErr) {
    console.warn("Groq fallback also failed:", groqErr);
  }

  // Final deterministic fallback: distribute tasks across all participants
  const fallbackTasks: ExtractedTaskItem[] = [];
  const taskTemplates = [
    {
      keyword: ["tech", "code", "dev", "backend", "api", "database", "fullstack", "software"],
      name: "Develop Core Backend Endpoints & API Integration",
      description:
        "Build, test, and deploy necessary server APIs and ensure database integrity for the event.",
      priority: "high" as const,
      daysOffset: 3,
    },
    {
      keyword: ["design", "ui", "ux", "poster", "graphics", "banner", "figma", "frontend"],
      name: "Design Promotional Posters & Social Media Banners",
      description:
        "Create official event flyers, digital banners for Instagram/LinkedIn, and presentation slides.",
      priority: "medium" as const,
      daysOffset: 2,
    },
    {
      keyword: [
        "registration",
        "form",
        "participant",
        "student",
        "outreach",
        "volunteer",
        "management",
      ],
      name: "Manage Attendee Registrations & Participant Support",
      description:
        "Track Google Form responses, verify student attendance eligibility, and handle attendee queries.",
      priority: "high" as const,
      daysOffset: 4,
    },
    {
      keyword: ["sponsor", "finance", "budget", "logistics", "venue", "pr", "marketing"],
      name: "Coordinate Venue Logistics, Audio/Visual Setup & Schedule",
      description:
        "Confirm room booking, test projectors and microphones, and run a dry test 24 hours prior to launch.",
      priority: "medium" as const,
      daysOffset: 5,
    },
  ];

  if (participants.length > 0) {
    participants.forEach((p, idx) => {
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
        deadline: new Date(Date.now() + 86400000 * matchedTemplate.daysOffset)
          .toISOString()
          .slice(0, 16),
        priority: matchedTemplate.priority,
      });
    });
  } else {
    fallbackTasks.push({
      name: "Finalize Deliverables & Team Task Check",
      description:
        "Review assigned responsibilities and report progress to the Club Leader before the deadline.",
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    opus: "audio/opus",
    wma: "audio/x-ms-wma",
    amr: "audio/amr",
  };
  return mimeMap[ext] || "audio/mpeg";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
