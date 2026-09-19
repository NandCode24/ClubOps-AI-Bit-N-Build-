import Groq from "groq-sdk";

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
