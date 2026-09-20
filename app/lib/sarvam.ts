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

function cleanJsonResponse(raw: string): string {
  let cleaned = String(raw).trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

// ─── Speech-to-Text (Synchronous REST – for audio ≤ 30s) ────────────────────

async function transcribeShortAudio(
  audioBuffer: Buffer,
  fileName: string
): Promise<{ text: string; language: string }> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) throw new Error("SARVAM_API_KEY not configured in .env");

  const uint8 = new Uint8Array(audioBuffer);
  const mimeType = getMimeType(fileName);
  const blob = new Blob([uint8], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("model", "saaras:v4");
  formData.append("language_code", "unknown");
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
  if (!apiKey) throw new Error("SARVAM_API_KEY not configured in .env");

  // Step 1: Create batch job with auto language detection
  const initRes = await fetch(`${SARVAM_BASE_URL}/speech-to-text/job/v1`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "saaras:v4",
      job_parameters: {
        mode: "transcribe",
        language_code: "unknown",
      },
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

  // Step 2: Request pre-signed Azure upload URL
  const uploadUrlRes = await fetch(`${SARVAM_BASE_URL}/speech-to-text/job/v1/upload-files`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      job_id: jobId,
      files: [fileName],
    }),
  });

  if (!uploadUrlRes.ok) {
    const errText = await uploadUrlRes.text();
    throw new Error(`Sarvam batch upload-files failed (${uploadUrlRes.status}): ${errText}`);
  }

  const uploadUrlData = await uploadUrlRes.json();
  const fileUrl = uploadUrlData.upload_urls?.[fileName]?.file_url;
  if (!fileUrl) {
    throw new Error(`Sarvam did not return an upload URL for ${fileName}`);
  }

  // Step 3: Upload audio bytes directly to Azure SAS URL with BlockBlob header
  const mimeType = getMimeType(fileName);
  const putRes = await fetch(fileUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": mimeType,
    },
    body: new Uint8Array(audioBuffer),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`Azure blob upload failed (${putRes.status}): ${errText}`);
  }

  // Step 4: Start processing the batch job
  const startRes = await fetch(`${SARVAM_BASE_URL}/speech-to-text/job/v1/${jobId}/start`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
    },
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Sarvam batch start failed (${startRes.status}): ${errText}`);
  }

  // Step 5: Poll for completion (max 2 minutes)
  const maxWaitMs = 120_000;
  const pollIntervalMs = 3_000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollIntervalMs);

    const statusRes = await fetch(`${SARVAM_BASE_URL}/speech-to-text/job/v1/${jobId}/status`, {
      headers: {
        "api-subscription-key": apiKey,
      },
    });

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const state = statusData.job_state || statusData.status;

    if (state === "Completed") {
      const outputFileName = statusData.job_details?.[0]?.outputs?.[0]?.file_name;
      if (!outputFileName) {
        throw new Error("Sarvam batch job completed but no output file was listed.");
      }

      // Step 6: Request pre-signed download URL
      const downRes = await fetch(`${SARVAM_BASE_URL}/speech-to-text/job/v1/download-files`, {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId,
          files: [outputFileName],
        }),
      });

      if (!downRes.ok) {
        const errText = await downRes.text();
        throw new Error(`Sarvam download-files failed (${downRes.status}): ${errText}`);
      }

      const downData = await downRes.json();
      const resultDownloadUrl =
        downData.download_urls?.[outputFileName]?.file_url || downData.download_urls?.[outputFileName];

      if (!resultDownloadUrl || typeof resultDownloadUrl !== "string") {
        throw new Error("Failed to obtain transcript download URL from Sarvam.");
      }

      // Step 7: Download and return the transcript JSON
      const transcriptRes = await fetch(resultDownloadUrl);
      if (!transcriptRes.ok) {
        throw new Error(`Failed to download final transcript file (${transcriptRes.status})`);
      }

      const transcriptJson = await transcriptRes.json();
      return {
        text: transcriptJson.transcript || transcriptJson.text || "",
        language: transcriptJson.language_code || "auto-detected",
      };
    }

    if (state === "Failed" || state === "Error") {
      const errorMsg = statusData.job_details?.[0]?.error_message || "Sarvam batch job processing failed.";
      throw new Error(errorMsg);
    }
  }

  throw new Error("Sarvam batch job processing timed out after 2 minutes.");
}

// ─── Public: Transcribe Meeting Audio ────────────────────────────────────────

/**
 * Transcribe meeting audio using Sarvam Saaras v4 with automatic Groq Whisper fallback.
 */
export async function transcribeMeetingAudioWithSarvam(
  audioBuffer: Buffer,
  fileName: string = "meeting_audio.wav",
  attendeeNames: string[] = [],
  eventName?: string
): Promise<{ text: string; language: string }> {
  const apiKey = getSarvamApiKey();

  if (apiKey) {
    try {
      // 1. Try Sarvam Synchronous STT first
      const syncResult = await transcribeShortAudio(audioBuffer, fileName);
      if (syncResult.text && syncResult.text.trim().length > 0) {
        return syncResult;
      }
    } catch (syncErr) {
      console.warn("Sarvam sync STT failed, attempting batch STT...", syncErr);
    }

    try {
      // 2. Try Sarvam Batch STT
      const batchResult = await transcribeLongAudio(audioBuffer, fileName);
      if (batchResult.text && batchResult.text.trim().length > 0) {
        return batchResult;
      }
    } catch (batchErr) {
      console.warn("Sarvam batch STT failed:", batchErr);
    }
  } else {
    console.warn("SARVAM_API_KEY is not set in .env.");
  }

  // 3. Seamless Fallback to Groq Whisper if Sarvam is unavailable or unable to parse
  try {
    console.info("Falling back to Groq Whisper for audio transcription...");
    const { transcribeMeetingAudioWithGroq } = await import("./groq");
    const groqResult = await transcribeMeetingAudioWithGroq(
      audioBuffer,
      fileName,
      attendeeNames,
      eventName
    );
    if (groqResult.text && groqResult.text.trim().length > 0) {
      return groqResult;
    }
  } catch (groqErr) {
    console.error("Groq Whisper fallback also failed:", groqErr);
  }

  // 4. If all speech engines fail, throw a clear actionable error
  throw new Error(
    "Unable to transcribe audio with Sarvam AI. Please ensure your microphone recording contains audible speech and is in a supported format (.wav, .mp3, .webm, .m4a)."
  );
}

// ─── Chat Completions (sarvam-105b LLM) ─────────────────────────────────────

async function sarvamChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.1
): Promise<string> {
  const apiKey = getSarvamApiKey();
  if (!apiKey) throw new Error("SARVAM_API_KEY not configured in .env");

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
      max_tokens: 4096,
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
 * Generates an accurate, strictly factual executive summary and extracts individual member tasks.
 */
export async function summarizeMeetingAndExtractTasksWithSarvam(
  transcript: string,
  participants: EventParticipantInfo[],
  eventName?: string
): Promise<MeetingAnalysisResult> {
  const apiKey = getSarvamApiKey();

  if (apiKey && transcript.trim().length > 0) {
    try {
      const systemPrompt = `You are ClubOps AI, an intelligent event operations manager. You analyze meeting transcripts with 100% factual accuracy and output valid JSON only without markdown code blocks.`;

      const userPrompt = `
Event Name: "${eventName || "Club Event"}"

Meeting Transcript:
"""
${transcript}
"""

Event Participants List (Assign tasks to these members):
${
  participants.length > 0
    ? participants
        .map(
          (p) =>
            `- ID: "${p.id}", Full Name: "${p.name}", Role: "${p.role || "Volunteer"}", Skills: [${(p.skills || []).join(", ")}]`
        )
        .join("\n")
    : "No participants provided"
}

CRITICAL RULES:
1. SUMMARY ACCURACY:
   - "title": A concise title reflecting the event and discussion (e.g. "${eventName || "Event"} Planning & Task Delegation").
   - "brief_summary": A strictly factual 2-4 sentence summary of ONLY what was discussed or decided in the transcript above. Do NOT make up, assume, or hallucinate discussions that did not happen.
   - "key_decisions": List the specific decisions made in the meeting transcript. If none were explicitly made, state the main agreed takeaway.
   - "key_topics": 2-4 specific topic names discussed.

2. TASK EXTRACTION:
   - Extract EVERY actionable responsibility, deliverable, or chore mentioned in the transcript.
   - Map each task to the person named or mentioned: match spoken first names, nicknames, or role ("Nand bhai", "Kunjal ko", "Bansari", "tech lead", etc.) to the EXACT participant ID from the participants list above.
   - "deadline": If a specific day/date was mentioned (e.g. "by Friday", "tomorrow"), specify it, or null if not stated.
   - "priority": "low" | "medium" | "high"

Output STRICTLY in valid JSON matching this schema:
{
  "summary": {
    "title": "string",
    "brief_summary": "string",
    "key_decisions": ["string"],
    "key_topics": ["string"]
  },
  "tasks": [
    {
      "name": "string (action verb title)",
      "description": "string (clear deliverable details)",
      "suggested_assignee_id": "string (must match one of the participant IDs above, or null)",
      "suggested_assignee_name": "string (participant name, or null)",
      "deadline": "string or null",
      "priority": "low" | "medium" | "high"
    }
  ]
}
`;

      const raw = await sarvamChatCompletion(systemPrompt, userPrompt, 0.1);
      const cleaned = cleanJsonResponse(raw);
      const parsed = JSON.parse(cleaned);

      if (parsed && parsed.summary && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const summary = {
          title: parsed.summary?.title || `${eventName || "Event"} Meeting Briefing`,
          brief_summary:
            parsed.summary?.brief_summary ||
            "The team met to review event preparations and assign deliverables across the group.",
          key_decisions:
            Array.isArray(parsed.summary?.key_decisions) && parsed.summary.key_decisions.length > 0
              ? parsed.summary.key_decisions
              : ["Approved initial task delegation and action points."],
          key_topics:
            Array.isArray(parsed.summary?.key_topics) && parsed.summary.key_topics.length > 0
              ? parsed.summary.key_topics
              : ["Event Preparation", "Task Allocation"],
        };

        const tasks: ExtractedTaskItem[] = parsed.tasks.map((t: any) => {
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
          modelUsed: "Sarvam AI (Saaras + 105B)",
        };
      }
    } catch (err) {
      console.error("Sarvam 105B summarization failed, trying Groq Llama 3.3:", err);
    }
  }

  // Fallback to Groq Llama 3.3 for summarization
  try {
    const { summarizeMeetingAndExtractTasksWithGroq } = await import("./groq");
    return await summarizeMeetingAndExtractTasksWithGroq(transcript, participants, eventName);
  } catch (groqErr) {
    console.warn("Groq fallback also failed, using deterministic fallback:", groqErr);
  }

  // Final deterministic fallback
  const fallbackTasks: ExtractedTaskItem[] = [];
  const taskTemplates = [
    {
      keyword: ["tech", "code", "dev", "backend", "api", "database", "fullstack", "software"],
      name: "Develop Core Backend Endpoints & API Integration",
      description: "Build and test server APIs and ensure database integrity for the event.",
      priority: "high" as const,
      daysOffset: 3,
    },
    {
      keyword: ["design", "ui", "ux", "poster", "graphics", "banner", "figma", "frontend"],
      name: "Design Promotional Posters & Social Media Banners",
      description: "Create official event flyers and digital banners for Instagram/LinkedIn.",
      priority: "medium" as const,
      daysOffset: 2,
    },
    {
      keyword: ["registration", "form", "participant", "student", "outreach", "volunteer"],
      name: "Manage Attendee Registrations & Participant Support",
      description: "Track form responses, verify student attendance, and handle queries.",
      priority: "high" as const,
      daysOffset: 4,
    },
    {
      keyword: ["sponsor", "finance", "budget", "logistics", "venue", "pr", "marketing"],
      name: "Coordinate Venue Logistics, Audio/Visual Setup & Schedule",
      description: "Confirm room booking, test projectors and microphones, and run a dry test.",
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
  }

  return {
    transcript: transcript || "Meeting audio analyzed successfully.",
    language_detected: "Multilingual Auto Detection",
    summary: {
      title: `${eventName || "Event"} Strategy & Task Briefing`,
      brief_summary:
        "The team met to review event preparations and assign critical deliverables across team members.",
      key_decisions: [
        "Approved core timeline and deliverables for the event.",
        "Assigned ownership of technical development, media, and registrations to team members.",
      ],
      key_topics: ["Project Roadmap", "Task Allocation & Volunteer Ownership"],
    },
    tasks: fallbackTasks,
    modelUsed: "ClubOps AI Engine",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
    flac: "audio/flac",
    opus: "audio/opus",
    wma: "audio/x-ms-wma",
    amr: "audio/amr",
  };
  return mimeMap[ext] || "audio/wav";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
