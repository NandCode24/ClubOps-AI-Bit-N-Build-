/**
 * Meeting AI Processing Pipeline
 *
 * Specialization:
 *   1. Sarvam AI (saaras:v4): Multilingual Indian Speech-to-Text (Hindi, Gujarati, English, Hinglish, code-mixed)
 *   2. Google Gemini (gemini-2.5-flash / gemini-2.0-flash): Primary structured analysis from transcript
 *   3. Grok (Groq SDK / XAI): Intelligent fallback and validation
 *
 * Fully idempotent and asynchronous.
 */

import { sql } from "./db";
import { transcribeMeetingAudioWithSarvam } from "./sarvam";
import { getGroqClient } from "./groq";

export interface StructuredActionItem {
  task: string;
  owner: string | null;
  owner_id?: string | null;
  deadline: string | null;
  priority: "high" | "medium" | "low";
}

export interface StructuredRiskItem {
  risk: string;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
}

export interface StructuredMeetingAnalysis {
  title: string;
  overview: string;
  key_discussion_points: string[];
  decisions: string[];
  action_items: StructuredActionItem[];
  risks: StructuredRiskItem[];
  next_steps: string[];
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

/**
 * Stage 1: Multilingual Speech-to-Text via Sarvam AI with Groq Whisper Fallback
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
  attendeeNames: string[],
  eventName: string
): Promise<{ transcript: string; language: string }> {
  try {
    const result = await transcribeMeetingAudioWithSarvam(
      audioBuffer,
      fileName,
      attendeeNames,
      eventName
    );
    return {
      transcript: result.text || "",
      language: result.language || "auto-detected",
    };
  } catch (err) {
    console.error("Transcription error in Sarvam, attempting direct Groq Whisper fallback:", err);
    const { transcribeMeetingAudioWithGroq } = await import("./groq");
    const groqRes = await transcribeMeetingAudioWithGroq(audioBuffer, fileName, attendeeNames, eventName);
    return {
      transcript: groqRes.text || "",
      language: "auto-detected",
    };
  }
}

/**
 * Stage 2: Analyze Transcript with Google Gemini (Primary Engine)
 */
export async function analyzeTranscriptWithGemini(
  transcript: string,
  eventName: string,
  attendees: Array<{ id: string; name: string; role?: string }>
): Promise<StructuredMeetingAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const attendeeRoster = attendees.map((a) => `- ${a.name} (${a.role || "Member"}, ID: ${a.id})`).join("\n");

  const prompt = `
You are the Executive Meeting Intelligence AI for ClubOps.AI (college club and event operations platform).
Analyze the following meeting transcript for the event "${eventName}".

CRITICAL ACCURACY RULES:
1. Ground truth strictly in the transcript. DO NOT hallucinate or invent tasks or decisions not discussed.
2. If an action item does not have a clearly stated owner, set owner = null and owner_id = null. Match names to the attendee roster when explicitly spoken.
3. If no deadline was explicitly stated, set deadline = null.
4. If something is uncertain or debated, preserve that uncertainty in the discussion points.
5. Identify concrete risks or bottlenecks mentioned during the discussion.

Attendee Roster:
${attendeeRoster || "No attendee roster provided"}

Meeting Transcript:
"""
${transcript}
"""

Return a strictly valid JSON object matching this schema:
{
  "title": "Concise professional meeting title",
  "overview": "2-3 sentence executive briefing of what took place",
  "key_discussion_points": ["Point 1", "Point 2"],
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": [
    {
      "task": "Specific actionable task description",
      "owner": "Exact name if spoken or null",
      "owner_id": "Matched user ID from roster if known or null",
      "deadline": "ISO date string or spoken timeline or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "risks": [
    {
      "risk": "Identified risk or bottleneck",
      "severity": "low" | "medium" | "high" | "critical",
      "explanation": "Why this risk matters according to the meeting context"
    }
  ],
  "next_steps": ["Next Step 1", "Next Step 2"]
}
`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini (${model}) returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) throw new Error("Gemini returned empty response parts.");

      const cleaned = cleanJsonResponse(rawJson);
      const parsed = JSON.parse(cleaned) as StructuredMeetingAnalysis;
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Gemini model ${model} failed, trying next...`, lastError.message);
    }
  }

  throw lastError || new Error("All Gemini models failed.");
}

/**
 * Stage 3: Intelligent Fallback & Validation with Grok (Groq LLM)
 */
export async function analyzeTranscriptWithGrokFallback(
  transcript: string,
  eventName: string,
  attendees: Array<{ id: string; name: string; role?: string }>
): Promise<StructuredMeetingAnalysis> {
  const client = getGroqClient();
  if (!client) {
    throw new Error("GROQ_API_KEY is not configured for fallback.");
  }

  const attendeeRoster = attendees.map((a) => `- ${a.name} (${a.role || "Member"}, ID: ${a.id})`).join("\n");

  const prompt = `
You are the Executive Meeting Intelligence AI for ClubOps.AI.
Analyze the following meeting transcript for the event "${eventName}".

CRITICAL ACCURACY RULES:
1. Ground truth strictly in the transcript. DO NOT invent tasks.
2. If an action item does not have a clearly stated owner, set owner = null.
3. If no deadline was explicitly stated, set deadline = null.
4. Detect risks, decisions, and action items.

Attendee Roster:
${attendeeRoster}

Meeting Transcript:
"""
${transcript}
"""

Return a JSON object with:
{
  "title": "Meeting Title",
  "overview": "Summary overview",
  "key_discussion_points": ["Point 1"],
  "decisions": ["Decision 1"],
  "action_items": [
    {
      "task": "Task description",
      "owner": "Name or null",
      "owner_id": "User ID or null",
      "deadline": null,
      "priority": "medium"
    }
  ],
  "risks": [
    {
      "risk": "Risk description",
      "severity": "medium",
      "explanation": "Risk explanation"
    }
  ],
  "next_steps": ["Next step 1"]
}
`;

  const models = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

  for (const model of models) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are an expert event operations meeting intelligence analyst. Respond in strict JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) continue;
      const parsed = JSON.parse(cleanJsonResponse(raw)) as StructuredMeetingAnalysis;
      return parsed;
    } catch (e) {
      console.warn(`Groq model ${model} failed:`, e);
    }
  }

  throw new Error("Grok fallback also failed to analyze transcript.");
}

/**
 * Execute Full Meeting AI Processing Pipeline (Idempotent)
 */
export async function processMeetingAudioPipeline(meetingId: string, audioBuffer: Buffer, fileName: string) {
  try {
    // 1. Fetch meeting and event details
    const meetingRows = await sql`
      SELECT m.id, m.meeting_code, m.event_id, m.club_id, m.title, m.processing_status, e.name as event_name, c.name as club_name
      FROM event_meetings m
      JOIN events e ON e.id = m.event_id
      JOIN clubs c ON c.id = m.club_id
      WHERE m.id = ${meetingId}
      LIMIT 1
    `;

    if (meetingRows.length === 0) {
      console.error(`Meeting ${meetingId} not found for AI pipeline.`);
      return;
    }

    const meeting = meetingRows[0];

    // Mark status: transcribing
    await sql`
      UPDATE event_meetings
      SET processing_status = 'transcribing', updated_at = NOW()
      WHERE id = ${meetingId}
    `;

    // Fetch event participants for roster matching
    const participantRows = await sql`
      SELECT u.id, u.full_name as name, ep.assigned_role as role
      FROM event_participants ep
      JOIN users u ON u.id = ep.user_id
      WHERE ep.event_id = ${meeting.event_id}
    `;

    const attendees = participantRows.map((p) => ({
      id: String(p.id),
      name: String(p.name),
      role: p.role ? String(p.role) : undefined,
    }));

    // Step 1: Speech-to-Text via Sarvam
    const { transcript, language } = await transcribeAudio(
      audioBuffer,
      fileName,
      attendees.map((a) => a.name),
      meeting.event_name
    );

    // Save transcript and advance status to analyzing
    await sql`
      UPDATE event_meetings
      SET transcript = ${transcript},
          processing_status = 'analyzing',
          updated_at = NOW()
      WHERE id = ${meetingId}
    `;

    // Step 2: Primary analysis with Gemini, falling back to Grok
    let analysis: StructuredMeetingAnalysis;
    try {
      analysis = await analyzeTranscriptWithGemini(transcript, meeting.event_name, attendees);
    } catch (geminiErr) {
      console.warn("Gemini failed or unavailable, using Grok fallback reviewer:", geminiErr);
      analysis = await analyzeTranscriptWithGrokFallback(transcript, meeting.event_name, attendees);
    }

    // Step 3: Commit structured summary, decisions, action items, risks, and next steps to DB
    await sql`
      UPDATE event_meetings
      SET summary_title = ${analysis.title || `${meeting.title} Summary`},
          summary_content = ${analysis.overview || ""},
          summary_decisions = ${JSON.stringify(analysis.decisions || [])}::jsonb,
          extracted_tasks = ${JSON.stringify(analysis.action_items || [])}::jsonb,
          summary_risks = ${JSON.stringify(analysis.risks || [])}::jsonb,
          summary_next_steps = ${JSON.stringify(analysis.next_steps || [])}::jsonb,
          processing_status = 'completed',
          status = 'completed',
          updated_at = NOW()
      WHERE id = ${meetingId}
    `;

    console.log(`Successfully completed AI processing for meeting ${meeting.meeting_code} (Language: ${language})`);
  } catch (pipelineErr) {
    console.error(`Error in processMeetingAudioPipeline for meeting ${meetingId}:`, pipelineErr);
    await sql`
      UPDATE event_meetings
      SET processing_status = 'failed',
          processing_error = ${pipelineErr instanceof Error ? pipelineErr.message : "AI Processing failed"},
          updated_at = NOW()
      WHERE id = ${meetingId}
    `;
  }
}
