"use client";

import { use, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import UniversalLoader from "@/app/components/UniversalLoader";

interface Participant {
  participant_id: string;
  user_id: string;
  assigned_role: string | null;
  joined_event_at: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  skills: string[];
  is_available?: boolean;
  unavailable_until?: string | null;
  unavailable_reason?: string | null;
  is_active?: boolean;
}

interface TaskItem {
  id: string;
  club_id: string;
  event_id: string;
  name: string;
  description: string | null;
  assigned_to: string | null;
  deadline: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
  created_at: string;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_photo: string | null;
  assigned_to_skills: string[] | null;
}

interface AnnouncementItem {
  id: string;
  club_id: string;
  event_id: string;
  title: string;
  content: string;
  audio_url: string | null;
  created_by: string;
  created_at: string;
  author_name: string | null;
  author_photo: string | null;
}

interface ClubMemberOption {
  membership_id: string;
  user_id: string;
  role_type: string;
  assigned_role: string;
  joined_at: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  skills: string[];
  is_available: boolean;
  is_active: boolean;
  unavailable_reason: string | null;
  is_participant: boolean;
}

interface EventDetails {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  venue: string | null;
  mode: "offline" | "online" | "hybrid";
  start_time: string;
  end_time: string;
  meeting_link: string | null;
  meeting_code: string | null;
  meeting_time: string | null;
  created_by: string;
  created_at: string;
  club_name: string;
  club_code: string;
  leader_id: string;
  leader_name: string;
  is_leader: boolean;
  is_participant: boolean;
  participants: Participant[];
  tasks: TaskItem[];
  user_tasks: TaskItem[];
}

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 min-w-0 group">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="sm:w-5 sm:h-5"
        >
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <span className="text-[15px] sm:text-[19px] font-bold tracking-tight text-slate-900 dark:text-white truncate block">
          ClubOps <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">AI</span>
        </span>
        <span className="hidden sm:block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
          Event Operations
        </span>
      </div>
    </Link>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ code: string; id: string }>;
}) {
  const router = useRouter();
  const { code: rawCode, id: eventId } = use(params);
  const clubCode = rawCode?.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<EventDetails | null>(null);
  const [error, setError] = useState("");

  // Live Toast for Real-time Task Updates
  const [realtimeToast, setRealtimeToast] = useState<{
    title: string;
    message: string;
    type: "completed" | "created" | "updated";
  } | null>(null);

  // New Task Modal for Leader
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [addTaskLoading, setAddTaskLoading] = useState(false);
  const [addTaskError, setAddTaskError] = useState("");

  // Groq AI Workload & Conflict Check
  const [aiChecking, setAiChecking] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<{
    allowed: boolean;
    hasConflict: boolean;
    conflictType: string;
    reason: string;
    recommendation: string;
    suggestedAlternative?: { id: string; name: string; skills: string[] } | null;
    modelUsed: string;
  } | null>(null);

  async function runAiWorkloadCheck(volunteerId: string) {
    if (!volunteerId || !eventData) {
      setAiCheckResult(null);
      return;
    }

    try {
      setAiChecking(true);
      const res = await fetch("/api/ai/task-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club_id: eventData.club_id,
          event_id: eventId,
          volunteer_id: volunteerId,
          task_name: newTaskName.trim() || "Event Task",
          task_description: newTaskDesc.trim(),
          task_deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAiCheckResult({
          allowed: data.allowed,
          hasConflict: data.hasConflict,
          conflictType: data.conflictType,
          reason: data.reason,
          recommendation: data.recommendation,
          suggestedAlternative: data.suggestedAlternative,
          modelUsed: data.modelUsed,
        });
      }
    } catch (err) {
      console.error("AI check error:", err);
    } finally {
      setAiChecking(false);
    }
  }

  // Reallocate Task Modal for Leader
  const [showReallocModal, setShowReallocModal] = useState(false);
  const [reallocatingTask, setReallocatingTask] = useState<TaskItem | null>(null);
  const [reallocAssignee, setReallocAssignee] = useState("");
  const [reallocAiChecking, setReallocAiChecking] = useState(false);
  const [reallocAiCheckResult, setReallocAiCheckResult] = useState<{
    allowed: boolean;
    hasConflict: boolean;
    reason: string;
    recommendation: string;
    suggestedAlternative?: { id: string; name: string; skills: string[] } | null;
  } | null>(null);
  const [reallocLoading, setReallocLoading] = useState(false);
  const [reallocError, setReallocError] = useState("");
  const [reallocSuccess, setReallocSuccess] = useState("");

  function openReallocateModal(task: TaskItem) {
    setReallocatingTask(task);
    setReallocAssignee("");
    setReallocAiCheckResult(null);
    setReallocError("");
    setReallocSuccess("");
    setShowReallocModal(true);
  }

  async function runReallocAiCheck(volunteerId: string) {
    if (!volunteerId || !eventData || !reallocatingTask) {
      setReallocAiCheckResult(null);
      return;
    }

    try {
      setReallocAiChecking(true);
      const res = await fetch("/api/ai/task-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club_id: eventData.club_id,
          event_id: eventId,
          volunteer_id: volunteerId,
          task_name: reallocatingTask.name,
          task_description: reallocatingTask.description,
          task_deadline: reallocatingTask.deadline,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReallocAiCheckResult({
          allowed: data.allowed,
          hasConflict: data.hasConflict,
          reason: data.reason,
          recommendation: data.recommendation,
          suggestedAlternative: data.suggestedAlternative,
        });
      }
    } catch (err) {
      console.error("AI check error during reallocate:", err);
    } finally {
      setReallocAiChecking(false);
    }
  }

  async function handleConfirmReallocate(e: React.FormEvent) {
    e.preventDefault();
    if (!reallocatingTask || !reallocAssignee) {
      setReallocError("Please select a volunteer to inform and reassign this task to.");
      return;
    }

    try {
      setReallocLoading(true);
      setReallocError("");
      setReallocSuccess("");

      const res = await fetch(`/api/tasks/${reallocatingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: reallocAssignee }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.ai_blocked) {
          setReallocError(`${data.message}${data.recommendation ? `\n💡 Suggestion: ${data.recommendation}` : ""}`);
          return;
        }
        throw new Error(data.message || "Failed to reallocate task.");
      }

      setReallocSuccess(data.message || "Task reallocated successfully!");
      await loadEvent();
      setTimeout(() => {
        setShowReallocModal(false);
        setReallocatingTask(null);
      }, 1000);
    } catch (err) {
      setReallocError(err instanceof Error ? err.message : "Error reallocating task.");
    } finally {
      setReallocLoading(false);
    }
  }

  // AI Meeting Summarizer & Task Extraction State (Leader Only)
  interface EditableExtractedTask {
    tempId: string;
    name: string;
    description: string;
    assigned_to: string;
    deadline: string;
    priority: "low" | "medium" | "high";
  }

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingStep, setMeetingStep] = useState<"upload" | "processing" | "review">("upload");
  const [meetingInputTab, setMeetingInputTab] = useState<"upload" | "record">("upload");
  const [meetingAudioFile, setMeetingAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [meetingAnalyzing, setMeetingAnalyzing] = useState(false);
  const [meetingProcessingStage, setMeetingProcessingStage] = useState("");
  const [meetingError, setMeetingError] = useState("");

  // Live Microphone Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Review & Edit State
  const [transcriptText, setTranscriptText] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryBrief, setSummaryBrief] = useState("");
  const [summaryDecisions, setSummaryDecisions] = useState<string[]>([]);
  const [summaryTopics, setSummaryTopics] = useState<string[]>([]);
  const [newDecisionInput, setNewDecisionInput] = useState("");

  // Announcement Publishing
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementPublished, setAnnouncementPublished] = useState(false);

  // Extracted Tasks Matrix
  const [extractedTasks, setExtractedTasks] = useState<EditableExtractedTask[]>([]);
  const [savingBatchTasks, setSavingBatchTasks] = useState(false);
  const [batchTasksSuccess, setBatchTasksSuccess] = useState("");
  const [batchTasksError, setBatchTasksError] = useState("");

  function openMeetingModal() {
    loadClubMembersForEvent();
    setMeetingStep("upload");
    setMeetingInputTab("upload");
    setMeetingAudioFile(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setMeetingError("");
    setAnnouncementPublished(false);
    setBatchTasksSuccess("");
    setBatchTasksError("");
    setShowMeetingModal(true);
  }

  function closeMeetingModal() {
    if (isRecording) {
      stopRecording();
    }
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setShowMeetingModal(false);
  }

  function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(v: DataView, offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16 bits per sample
    writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  async function startRecording() {
    try {
      setMeetingError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        // Record directly at 16kHz PCM (Sarvam AI's optimal format)
        const audioCtx = new AudioContextClass({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        audioProcessorRef.current = processor;
        pcmChunksRef.current = [];

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          pcmChunksRef.current.push(new Float32Array(input));
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      } else {
        // Fallback to MediaRecorder if AudioContext is unavailable
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start(250);
      }

      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      setMeetingError("Unable to access microphone. Please check browser microphone permissions.");
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    setIsRecording(false);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // 1. If Web Audio API was used, build 16kHz WAV
    if (audioProcessorRef.current && audioContextRef.current) {
      try {
        audioProcessorRef.current.disconnect();
        audioProcessorRef.current = null;
      } catch {}

      const chunks = pcmChunksRef.current;
      const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const sampleRate = audioContextRef.current.sampleRate || 16000;
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }

      const wavBlob = encodeWAV(merged, sampleRate);
      const file = new File([wavBlob], `meeting-record-${Date.now()}.wav`, { type: "audio/wav" });
      setMeetingAudioFile(file);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(URL.createObjectURL(wavBlob));
      return;
    }

    // 2. MediaRecorder fallback
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], `meeting-record-${Date.now()}.webm`, { type: "audio/webm" });
        setMeetingAudioFile(file);
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(URL.createObjectURL(audioBlob));
      };
      mediaRecorderRef.current.stop();
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    }
  }

  function handleAudioFileSelect(file: File | null) {
    if (!file) return;
    setMeetingError("");
    setMeetingAudioFile(file);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(URL.createObjectURL(file));
  }

  async function handleAnalyzeMeetingAudio() {
    if (!meetingAudioFile) {
      setMeetingError("Please select an audio file or record a meeting audio snippet.");
      return;
    }

    try {
      setMeetingAnalyzing(true);
      setMeetingError("");
      setMeetingStep("processing");
      setMeetingProcessingStage("Uploading meeting audio to ClubOps AI Engine...");

      const timer1 = setTimeout(() => {
        setMeetingProcessingStage("Transcribing speech with multilingual AI Whisper...");
      }, 1600);

      const timer2 = setTimeout(() => {
        setMeetingProcessingStage("Extracting executive brief, decisions & volunteer tasks...");
      }, 4200);

      const formData = new FormData();
      formData.append("audio", meetingAudioFile);

      const res = await fetch(`/api/events/${eventId}/meeting-summary`, {
        method: "POST",
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to analyze meeting audio.");
      }

      setTranscriptText(data.transcript || "");
      setSummaryTitle(data.summary?.title || `${eventData?.name || "Event"} Meeting Summary`);
      setSummaryBrief(data.summary?.brief_summary || "");
      setSummaryDecisions(data.summary?.key_decisions || []);
      setSummaryTopics(data.summary?.key_topics || []);

      const mappedTasks: EditableExtractedTask[] = (data.tasks || []).map((t: any, idx: number) => ({
        tempId: `extracted-${Date.now()}-${idx}`,
        name: t.name || "",
        description: t.description || "",
        assigned_to: t.suggested_assignee_id || "",
        deadline: t.deadline || "",
        priority: t.priority || "medium",
      }));

      setExtractedTasks(mappedTasks);
      setMeetingStep("review");
      setAnnouncementPublished(false);
      setBatchTasksSuccess("");
      setBatchTasksError("");
    } catch (err) {
      setMeetingError(err instanceof Error ? err.message : "Error analyzing meeting audio.");
      setMeetingStep("upload");
    } finally {
      setMeetingAnalyzing(false);
    }
  }

  async function handlePublishMeetingAnnouncement() {
    if (!summaryBrief.trim()) {
      alert("Executive summary content cannot be empty.");
      return;
    }

    try {
      setPublishingAnnouncement(true);
      let contentToPost = summaryBrief.trim();
      if (summaryDecisions.length > 0) {
        contentToPost += `\n\n📌 Key Decisions & Action Plan:\n${summaryDecisions.map((d) => `• ${d}`).join("\n")}`;
      }
      contentToPost += `\n\n⚡ Let's execute these smoothly! All volunteers, please check your assigned tasks below.`;

      const res = await fetch(`/api/events/${eventId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: summaryTitle.trim() || `📢 ${eventData?.name || "Event"} Official Announcement`,
          content: contentToPost,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to publish announcement.");
      }

      setAnnouncementPublished(true);
      setAnnouncements((prev) => [data.announcement, ...prev]);
      playSuccessChime();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error publishing announcement.");
    } finally {
      setPublishingAnnouncement(false);
    }
  }

  async function handleSaveBatchTasks() {
    if (extractedTasks.length === 0) {
      setBatchTasksError("No tasks to assign. Click '+ Add Another Task' to add one.");
      return;
    }

    // Validate tasks: name and assigned_to are strictly required
    for (let i = 0; i < extractedTasks.length; i++) {
      const t = extractedTasks[i];
      if (!t.name.trim()) {
        setBatchTasksError(`Task #${i + 1} requires a task name.`);
        return;
      }
      if (!t.assigned_to) {
        setBatchTasksError(`Task "${t.name}" requires an assigned volunteer. "Whom to inform" is compulsory.`);
        return;
      }
    }

    try {
      setSavingBatchTasks(true);
      setBatchTasksError("");
      setBatchTasksSuccess("");

      const res = await fetch(`/api/events/${eventId}/tasks/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: extractedTasks.map((t) => ({
            name: t.name.trim(),
            description: t.description.trim(),
            assigned_to: t.assigned_to,
            deadline: (() => {
              if (!t.deadline) return null;
              const d = new Date(t.deadline);
              return !isNaN(d.getTime()) ? d.toISOString() : null;
            })(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to assign tasks.");
      }

      setBatchTasksSuccess(`🎉 Successfully assigned ${data.count} tasks to volunteers!`);
      playSuccessChime();
      await loadEvent();
    } catch (err) {
      setBatchTasksError(err instanceof Error ? err.message : "Error saving tasks.");
    } finally {
      setSavingBatchTasks(false);
    }
  }

  function handleUpdateExtractedTask(index: number, field: keyof EditableExtractedTask, value: any) {
    setExtractedTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function handleDeleteExtractedTask(index: number) {
    setExtractedTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddNewTask() {
    setExtractedTasks((prev) => [
      ...prev,
      {
        tempId: `manual-${Date.now()}`,
        name: "",
        description: "",
        assigned_to: "",
        deadline: "",
        priority: "medium",
      },
    ]);
  }

  function handleAddDecision() {
    if (!newDecisionInput.trim()) return;
    setSummaryDecisions((prev) => [...prev, newDecisionInput.trim()]);
    setNewDecisionInput("");
  }

  function handleDeleteDecision(idx: number) {
    setSummaryDecisions((prev) => prev.filter((_, i) => i !== idx));
  }

  // Manage Event Members Modal for Leader
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [allClubMembers, setAllClubMembers] = useState<ClubMemberOption[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [memberActionMsg, setMemberActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Combined Volunteer Assignee Options for AI Task Extraction and Reassignment
  const availableAssigneeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    if (allClubMembers && allClubMembers.length > 0) {
      for (const m of allClubMembers) {
        map.set(m.user_id, {
          id: m.user_id,
          name: m.full_name,
          role: m.assigned_role || undefined,
        });
      }
    }
    if (eventData?.participants) {
      for (const p of eventData.participants) {
        if (!map.has(p.user_id)) {
          map.set(p.user_id, {
            id: p.user_id,
            name: p.full_name,
            role: p.assigned_role || "Participant",
          });
        }
      }
    }
    return Array.from(map.values());
  }, [allClubMembers, eventData?.participants]);

  // Delete Event Modal for Leader
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteEventError, setDeleteEventError] = useState("");

  // Browser Notification state
  const [notificationPerm, setNotificationPerm] = useState<string>("default");

  // Toggling Task Loading Map
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Event Announcements
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [announcementSuccess, setAnnouncementSuccess] = useState("");

  async function loadAnnouncements() {
    try {
      setAnnouncementsLoading(true);
      const res = await fetch(`/api/events/${eventId}/announcements`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      }
    } catch (e) {
      console.error("Error loading announcements:", e);
    } finally {
      setAnnouncementsLoading(false);
    }
  }

  async function handlePostAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementContent.trim()) return;

    try {
      setPostingAnnouncement(true);
      setAnnouncementError("");
      setAnnouncementSuccess("");

      const res = await fetch(`/api/events/${eventId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementTitle.trim() || "Leader Announcement",
          content: announcementContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to post announcement.");
      }

      setAnnouncements((prev) => [data.announcement, ...prev]);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementSuccess("Announcement broadcasted successfully to all joined members!");
      setTimeout(() => setAnnouncementSuccess(""), 4000);
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : "Failed to post announcement.");
    } finally {
      setPostingAnnouncement(false);
    }
  }

  function playSuccessChime() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.3); // C6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch {
      // Audio context error or blocked
    }
  }

  // Load Event Details
  async function loadEvent() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/events/${eventId}`);
      if (res.status === 401) {
        router.push(`/signin?redirect=/club/${clubCode}/event/${eventId}`);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load event.");
      }
      setEventData(data.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading event.");
    } finally {
      setLoading(false);
    }
  }

  // Load All Club Members for Event Member Management (Leader Only)
  async function loadClubMembersForEvent() {
    try {
      setMembersLoading(true);
      const res = await fetch(`/api/events/${eventId}/participants`);
      const data = await res.json();
      if (data.success && Array.isArray(data.all_club_members)) {
        setAllClubMembers(data.all_club_members);
      }
    } catch (err) {
      console.error("Error loading club members for event:", err);
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleAddMemberToEvent(userId: string) {
    setMemberActionLoading(userId);
    setMemberActionMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to add member to event.");
      setMemberActionMsg({ type: "success", text: "Member added to event!" });
      await loadEvent();
      await loadClubMembersForEvent();
    } catch (err) {
      setMemberActionMsg({ type: "error", text: err instanceof Error ? err.message : "Error adding member." });
    } finally {
      setMemberActionLoading(null);
    }
  }

  async function handleRemoveMemberFromEvent(userId: string) {
    setMemberActionLoading(userId);
    setMemberActionMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/participants?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to remove member from event.");
      setMemberActionMsg({ type: "success", text: "Member removed from event." });
      await loadEvent();
      await loadClubMembersForEvent();
    } catch (err) {
      setMemberActionMsg({ type: "error", text: err instanceof Error ? err.message : "Error removing member." });
    } finally {
      setMemberActionLoading(null);
    }
  }

  async function handleDeleteEvent() {
    setDeletingEvent(true);
    setDeleteEventError("");
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete event.");
      router.push(`/club/${clubCode}`);
    } catch (err) {
      setDeleteEventError(err instanceof Error ? err.message : "Failed to delete event.");
      setDeletingEvent(false);
    }
  }

  useEffect(() => {
    if (eventId) {
      loadEvent();
      loadAnnouncements();
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPerm(Notification.permission);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Real-time SSE Connection for this Event
  useEffect(() => {
    if (!eventData?.club_id) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/clubs/${eventData.club_id}/events`);

      eventSource.addEventListener("task_updated", (e) => {
        const payload = JSON.parse(e.data);
        if (payload.event_id !== eventId) return;

        setEventData((prev) => {
          if (!prev) return prev;
          const updatedStatus = payload.status as "pending" | "in_progress" | "completed";
          const updatedTasks = prev.tasks.map((t) => {
            if (t.id === payload.task_id) {
              return {
                ...t,
                status: updatedStatus,
                completed_at: payload.status === "completed" ? new Date().toISOString() : null,
              };
            }
            return t;
          });

          // Also update user_tasks
          const updatedUserTasks = prev.user_tasks.map((t) => {
            if (t.id === payload.task_id) {
              return {
                ...t,
                status: updatedStatus,
                completed_at: payload.status === "completed" ? new Date().toISOString() : null,
              };
            }
            return t;
          });

          return {
            ...prev,
            tasks: updatedTasks,
            user_tasks: updatedUserTasks,
          };
        });

        // Trigger chime & toast if marked completed
        if (payload.status === "completed") {
          playSuccessChime();
          setRealtimeToast({
            title: "Task Completed! 🎉",
            message: `"${payload.name}" was marked as done by ${payload.assigned_to_name || "Volunteer"}.`,
            type: "completed",
          });
        }

        if (payload.action === "reallocated") {
          loadEvent();
          setRealtimeToast({
            title: "Task Reallocated 🔄",
            message: `"${payload.name}" was reallocated to ${payload.assigned_to_name || "Volunteer"}.`,
            type: "updated",
          });
        }
      });
    } catch (err) {
      console.error("SSE stream error:", err);
    }

    // Auto-polling fallback every 4 seconds to guarantee sync
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.event) {
            setEventData((prev) => {
              if (!prev) return data.event;
              return {
                ...prev,
                tasks: data.event.tasks,
                user_tasks: data.event.user_tasks,
              };
            });
          }
        }
      } catch {
        // silent sync
      }
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [eventData?.club_id, eventId]);

  // Request Browser Push Notification Permission
  async function requestNotificationPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPerm(permission);
      if (permission === "granted") {
        new Notification("ClubOps AI Notifications Active", {
          body: `You will be alerted about task updates and approaching deadlines for "${eventData?.name}".`,
          icon: "/favicon.ico",
        });
      }
    }
  }

  // Toggle Task Completion (by Volunteer or Leader)
  async function handleToggleTask(task: TaskItem) {
    const newStatus: "pending" | "in_progress" | "completed" =
      task.status === "completed" ? "pending" : "completed";
    setTogglingTaskId(task.id);

    // Optimistic state update
    setEventData((prev) => {
      if (!prev) return prev;
      const patchTasks = (list: TaskItem[]) =>
        list.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                completed_at: newStatus === "completed" ? new Date().toISOString() : null,
              }
            : t
        );
      return {
        ...prev,
        tasks: patchTasks(prev.tasks),
        user_tasks: patchTasks(prev.user_tasks),
      };
    });

    if (newStatus === "completed") {
      playSuccessChime();
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update task status.");
      }
    } catch (err) {
      // Revert optimistic update on failure
      alert(err instanceof Error ? err.message : "Error updating task.");
      loadEvent();
    } finally {
      setTogglingTaskId(null);
    }
  }

  // Leader: Add Task to Event
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!eventData) return;
    setAddTaskError("");

    if (!newTaskName.trim()) {
      setAddTaskError("Task name is required.");
      return;
    }

    if (!newTaskAssignee) {
      setAddTaskError("Whom to inform is compulsory. Please select an active volunteer to assign and notify.");
      return;
    }

    try {
      setAddTaskLoading(true);

      const res = await fetch(`/api/events/${eventId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          description: newTaskDesc.trim(),
          assigned_to: newTaskAssignee || null,
          deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.ai_blocked) {
          setAddTaskError(`${data.message}${data.recommendation ? `\n💡 Suggestion: ${data.recommendation}` : ""}`);
          return;
        }
        throw new Error(data.message || "Failed to assign task.");
      }

      // Reset form and close modal
      setNewTaskName("");
      setNewTaskDesc("");
      setNewTaskAssignee("");
      setNewTaskDeadline("");
      setAiCheckResult(null);
      setShowAddTaskModal(false);

      // Reload fresh event data
      await loadEvent();
    } catch (err) {
      setAddTaskError(err instanceof Error ? err.message : "Error creating task.");
    } finally {
      setAddTaskLoading(false);
    }
  }

  // Calculate Urgency & Approaching Deadlines for Volunteer's Tasks
  const urgentTasks = useMemo(() => {
    if (!eventData?.user_tasks) return [];
    return eventData.user_tasks.filter((t) => {
      if (t.status === "completed" || !t.deadline) return false;
      const dueTime = new Date(t.deadline).getTime();
      const now = Date.now();
      const hoursRemaining = (dueTime - now) / (1000 * 60 * 60);
      // Alert if due within 24 hours or already overdue
      return hoursRemaining <= 24;
    });
  }, [eventData?.user_tasks]);

  // Overall Task Metrics
  const taskMetrics = useMemo(() => {
    if (!eventData?.tasks) return { total: 0, completed: 0, percentage: 0 };
    const total = eventData.tasks.length;
    const completed = eventData.tasks.filter((t) => t.status === "completed").length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }, [eventData?.tasks]);

  if (loading) {
    return (
      <UniversalLoader
        badge="Live Event Operations"
        text="Loading live event workspace..."
        subtext="Syncing event tasks, volunteer assignments, and real-time status board..."
      />
    );
  }

  if (error || !eventData) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/50 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Event Not Found</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || "Unable to locate this event."}</p>
          <div className="mt-6">
            <Link
              href={`/club/${clubCode}`}
              className="inline-block rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition"
            >
              Back to Club
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const startDateFormatted = new Date(eventData.start_time).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const endDateFormatted = new Date(eventData.end_time).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="min-h-screen bg-[#F6F4EE] dark:bg-[#121810] text-[#1B2213] dark:text-[#F4F6F0] transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#E2DDD0] dark:border-[#283422] bg-[#F6F4EE]/90 dark:bg-[#121810]/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/profile"
              className="hidden sm:inline-flex items-center rounded-xl border border-indigo-200/70 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/50 px-3 sm:px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
            >
              👤 <span className="hidden sm:inline">Profile &amp; Availability</span>
            </Link>
            <Link
              href={`/club/${clubCode}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              ← <span className="hidden sm:inline">Back to </span>Club
            </Link>
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Floating Real-Time SSE Notification Toast */}
      {realtimeToast && (
        <div className="fixed top-16 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:max-w-sm rounded-2xl border-2 border-emerald-400 dark:border-emerald-500 bg-white dark:bg-slate-900 p-4 shadow-2xl ring-4 ring-emerald-500/20 transition-all animate-bounce">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⚡</span>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                Live Real-Time Sync
              </span>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-1 truncate">{realtimeToast.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">{realtimeToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setRealtimeToast(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-3 sm:px-8 py-4 sm:py-8 pb-28 md:pb-8">
        {/* Dynamic Breadcrumbs & Leader Actions */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300 transition">
              Dashboard
            </Link>
            <span>/</span>
            <Link href={`/club/${clubCode}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition truncate max-w-[150px] sm:max-w-none">
              {eventData.club_name} ({clubCode})
            </Link>
            <span>/</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[180px] sm:max-w-none">{eventData.name}</span>
          </div>

          {eventData.is_leader && (
            <button
              type="button"
              onClick={() => {
                setDeleteEventError("");
                setShowDeleteEventModal(true);
              }}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shadow-2xs"
            >
              <span>🗑️</span> Delete Event
            </button>
          )}
        </div>

        {/* URGENT DEADLINE BANNER FOR VOLUNTEERS */}
        {urgentTasks.length > 0 && (
          <div className="mb-6 rounded-3xl border-2 border-rose-400 dark:border-rose-700/80 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-rose-950/60 dark:via-amber-950/40 dark:to-orange-950/40 p-4 sm:p-5 shadow-lg shadow-rose-500/10 ring-4 ring-rose-500/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white text-xl animate-pulse shadow-md">
                  ⏰
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      Action Required: Approaching Deadline
                    </span>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      {urgentTasks.length} task{urgentTasks.length === 1 ? "" : "s"} due soon!
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                    Complete your task: &ldquo;{urgentTasks[0].name}&rdquo;
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Deadline:{" "}
                    <strong className="text-rose-700 dark:text-rose-300">
                      {new Date(urgentTasks[0].deadline!).toLocaleString()}
                    </strong>
                    . Please tick the checkbox once completed to notify the leader in real time.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {notificationPerm !== "granted" ? (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 px-4 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-2xs hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                  >
                    🔔 Enable Push Alerts
                  </button>
                ) : (
                  <span className="min-h-[44px] flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ Alerts Enabled
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleTask(urgentTasks[0])}
                  disabled={togglingTaskId === urgentTasks[0].id}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition disabled:opacity-50"
                >
                  {togglingTaskId === urgentTasks[0].id ? "Saving..." : "✓ Mark as Completed"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HERO EVENT CARD */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                    eventData.mode === "online"
                      ? "bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300"
                      : eventData.mode === "hybrid"
                      ? "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300"
                      : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {eventData.mode === "online"
                    ? "🌐 Online Virtual"
                    : eventData.mode === "hybrid"
                    ? "⚡ Hybrid (Campus + Virtual)"
                    : "🏛️ In-Person Campus"}
                </span>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    eventData.is_leader
                      ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300"
                      : "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {eventData.is_leader ? "👑 Club Leader" : "🤝 Volunteer"}
                </span>

                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Created by <strong className="text-slate-700 dark:text-slate-300">{eventData.leader_name}</strong>
                </span>
              </div>

              <h1 className="text-xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white break-words">
                {eventData.name}
              </h1>

              {eventData.description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                  {eventData.description}
                </p>
              )}

              {/* Timing & Venue details */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-3 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Starts:</strong> {startDateFormatted}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏁</span>
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Ends:</strong> {endDateFormatted}
                  </span>
                </div>
                {eventData.venue && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">Venue:</strong> {eventData.venue}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics Badge */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/80 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/60 p-4 sm:p-5 text-center w-full lg:w-auto lg:min-w-[240px] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-1">
                Real-Time Task Progress
              </span>
              <div className="text-3xl font-black text-indigo-950 dark:text-indigo-200">
                {taskMetrics.percentage}%
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${taskMetrics.percentage}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {taskMetrics.completed} of {taskMetrics.total} tasks completed
              </div>
            </div>
          </div>

          {/* Virtual Meeting Section (if online or hybrid) */}
          {eventData.mode !== "offline" && eventData.meeting_link && (
            <div className="mt-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-lg">
                  📹
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Official Event Video Meeting</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect with fellow volunteers and leaders directly via this room.
                  </p>
                  {eventData.meeting_code && (
                    <span className="inline-block text-[11px] font-mono text-indigo-800 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 mt-1">
                      Room Code: <strong>{eventData.meeting_code}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(eventData.meeting_link!);
                    alert("Meeting link copied to clipboard!");
                  }}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
                >
                  Copy Link
                </button>
                {eventData.is_leader && (
                  <button
                    type="button"
                    onClick={openMeetingModal}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition shadow-2xs"
                  >
                    🎙️ Summarize Meeting Audio
                  </button>
                )}
                <a
                  href={eventData.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
                >
                  Join Meeting Now →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* EVENT ANNOUNCEMENTS SECTION (LEADER BROADCASTS & MEMBER FEED) */}
        <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-sm shadow-indigo-500/20">
                  📢
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Event Announcements ({announcements.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official briefings and live broadcasts from the Club Leader. All past announcements are preserved for newly joined members.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {eventData.is_leader ? (
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200/70 dark:border-indigo-800/70">
                  👑 Leader Broadcast Mode
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  Joined Member View
                </span>
              )}
            </div>
          </div>

          {/* LEADER ONLY: BROADCAST COMPOSER FORM */}
          {eventData.is_leader && (
            <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Post New Announcement to Joined Members
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Visible to all volunteers
                </span>
              </div>

              {announcementError && (
                <div className="mb-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-400">
                  {announcementError}
                </div>
              )}

              {announcementSuccess && (
                <div className="mb-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  ✓ {announcementSuccess}
                </div>
              )}

              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <div>
                  <input
                    type="text"
                    placeholder="Announcement Title (e.g. Schedule Update, Stage Briefing)"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Write your announcement message for all joined members and volunteers..."
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={postingAnnouncement || !announcementContent.trim()}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition active:scale-98 disabled:opacity-50 min-h-[40px] flex items-center gap-2"
                  >
                    {postingAnnouncement ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Broadcasting...</span>
                      </>
                    ) : (
                      <>
                        <span>📢 Broadcast Announcement</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ANNOUNCEMENTS LIST / FEED */}
          {announcementsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span>Loading announcements...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-10 px-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/80 text-2xl mb-3">
                📭
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Announcements Posted Yet
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {eventData.is_leader
                  ? "Use the composer above to share instructions, schedule updates, or urgent briefs with joined members."
                  : "The Club Leader has not posted any announcements for this event yet. Check back soon for live updates."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 sm:p-5 hover:border-indigo-200 dark:hover:border-indigo-800 transition shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-xs shadow-xs">
                        {a.author_name ? a.author_name.charAt(0) : "L"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {a.author_name || eventData.leader_name}
                          </span>
                          <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                            👑 Club Leader
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {a.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {a.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 1: MY ASSIGNED TASKS (FOR VOLUNTEER & LEADER) */}
        <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                  ✓
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  My Assigned Tasks ({eventData.user_tasks.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tasks specifically assigned to you by the Club Leader. Tick the box when finished to sync in real time.
              </p>
            </div>

            {eventData.user_tasks.length > 0 && (
              <span className="self-start sm:self-auto text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {eventData.user_tasks.filter((t) => t.status === "completed").length} /{" "}
                {eventData.user_tasks.length} Completed
              </span>
            )}
          </div>

          {eventData.user_tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              ✨ You currently have no tasks assigned to you for this event.
            </div>
          ) : (
            <div className="space-y-3">
              {eventData.user_tasks.map((task) => {
                const isDone = task.status === "completed";
                const isToggling = togglingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isDone
                        ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleTask(task)}
                        className={`flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90 ${
                          isDone
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 text-transparent"
                        }`}
                        title={isDone ? "Mark incomplete" : "Tick as completed"}
                      >
                        {isDone ? "✓" : ""}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`font-bold text-sm sm:text-base transition ${
                              isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {task.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              isDone
                                ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                                : "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {isDone ? "Completed ✓" : "Pending"}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{task.description}</p>
                        )}

                        {task.deadline && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span>⏰ Deadline:</span>
                            <span
                              className={`font-semibold ${
                                isDone
                                  ? "text-slate-400 dark:text-slate-500"
                                  : new Date(task.deadline).getTime() - Date.now() < 86400000
                                  ? "text-rose-600 dark:text-rose-400 font-bold"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {new Date(task.deadline).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleTask(task)}
                      className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
                        isDone
                          ? "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                          : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs active:scale-95"
                      }`}
                    >
                      {isToggling ? "Updating..." : isDone ? "Mark Incomplete" : "✓ Mark Done"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: ALL EVENT TASKS (VISIBLE TO BOTH VOLUNTEERS & LEADER) */}
        <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                  📋
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  All Event Tasks ({eventData.tasks.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live roster of assigned event responsibilities across all volunteers and leaders.
              </p>
            </div>

            {eventData.is_leader && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={openMeetingModal}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:scale-95 transition shadow-2xs"
                >
                  🎙️ AI Meeting Summarizer
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(true)}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition"
                >
                  + Assign New Task
                </button>
              </div>
            )}
          </div>

          {eventData.tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No tasks have been created for this event yet.
            </div>
          ) : (
            <div className="space-y-3">
              {eventData.tasks.map((task) => {
                const isDone = task.status === "completed";

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isDone
                        ? "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 opacity-80"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                          isDone
                            ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                            : "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60"
                        }`}
                      >
                        {isDone ? "✓" : "⚡"}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`font-bold text-sm sm:text-base ${
                              isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {task.name}
                          </h4>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              isDone
                                ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                                : "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {isDone ? "Completed" : "In Progress"}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {task.assigned_to_name ? (
                            <div className="flex items-center gap-1.5">
                              <span className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                {task.assigned_to_name.charAt(0)}
                              </span>
                              <span>
                                Assigned to: <strong className="text-slate-700 dark:text-slate-200">{task.assigned_to_name}</strong>
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">⚠️ Unassigned</span>
                          )}

                          {task.deadline && (
                            <div className="flex items-center gap-1">
                              <span>⏱️ Due:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {new Date(task.deadline).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                      {eventData.is_leader && !isDone && (
                        <button
                          type="button"
                          onClick={() => openReallocateModal(task)}
                          className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition flex items-center gap-1.5 min-h-[38px] shadow-2xs"
                          title="Reallocate this task to another volunteer"
                        >
                          🔄 Reallocate
                        </button>
                      )}

                      {(eventData.is_leader || eventData.user_tasks.some((ut) => ut.id === task.id)) && (
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shrink-0 min-h-[38px]"
                        >
                          {isDone ? "Reopen Task" : "✓ Mark as Done"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: PARTICIPATING MEMBERS ROSTER */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                👥
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Participating Roster ({eventData.participants.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Club volunteers and leaders designated to run this event.
                </p>
              </div>
            </div>

            {eventData.is_leader && (
              <button
                type="button"
                onClick={() => {
                  setShowMembersModal(true);
                  loadClubMembersForEvent();
                }}
                className="w-full sm:w-auto min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition"
              >
                <span>👥</span> Manage Event Members
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {eventData.participants.map((member) => {
              const activeTaskCount = eventData.tasks.filter(
                (t) => t.assigned_to === member.user_id && t.status !== "completed"
              ).length;

              return (
                <div
                  key={member.user_id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-sm">
                      {member.full_name?.charAt(0) || "M"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {member.full_name}
                        </span>
                        {member.user_id === eventData.leader_id && (
                          <span className="shrink-0 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.2 text-[9px] font-bold">
                            Leader
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                        {member.assigned_role || "Volunteer"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Availability Badge */}
                    {member.is_active === false ? (
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                        title={member.unavailable_reason ? `Reason: ${member.unavailable_reason}` : "Temporarily on leave"}
                      >
                        🔴 Away
                      </span>
                    ) : activeTaskCount > 0 ? (
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        🟡 1 Task
                      </span>
                    ) : (
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                        🟢 Free
                      </span>
                    )}

                    {/* Leader Quick Remove */}
                    {eventData.is_leader && member.user_id !== eventData.leader_id && (
                      <button
                        type="button"
                        disabled={memberActionLoading === member.user_id}
                        onClick={() => handleRemoveMemberFromEvent(member.user_id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition text-xs"
                        title="Remove member from this event"
                      >
                        {memberActionLoading === member.user_id ? "..." : "✕"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* LEADER ADD TASK MODAL */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-2xl space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assign New Task</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assign a volunteer responsibility. Workload rule: 1 active task per volunteer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {addTaskError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
                ⚠️ {addTaskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="e.g. Photography, Sound check, Welcome desk"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Assign &amp; Inform Volunteer * <span className="text-rose-500 font-normal">(Compulsory)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    ⚡ AI Workload Guard
                  </span>
                </div>
                <select
                  required
                  value={newTaskAssignee}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewTaskAssignee(val);
                    runAiWorkloadCheck(val);
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                >
                  <option value="" disabled>-- Select Volunteer to Assign &amp; Inform * --</option>
                  {eventData.participants.map((p) => {
                    const hasActiveTask = eventData.tasks.some(
                      (t) => t.assigned_to === p.user_id && t.status !== "completed"
                    );
                    const isAway = p.is_active === false;

                    return (
                      <option key={p.user_id} value={p.user_id} disabled={isAway}>
                        {p.full_name} ({p.assigned_role || "Volunteer"}) {isAway ? "🔴 [Away / Deactivated]" : hasActiveTask ? "🟡 [1 Active Task]" : "🟢 [Available]"}
                      </option>
                    );
                  })}
                </select>

                {/* Live AI Workload & Conflict Status */}
                {newTaskAssignee && (
                  <div className="mt-2.5">
                    {aiChecking ? (
                      <div className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 text-xs text-indigo-700 dark:text-indigo-300">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                        <span className="font-semibold text-[11px]">
                          AI Workload Guard: Analyzing volunteer active workload &amp; potential collision...
                        </span>
                      </div>
                    ) : aiCheckResult ? (
                      <div
                        className={`rounded-2xl border p-3.5 text-xs space-y-2 transition-all ${
                          !aiCheckResult.allowed
                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                            : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span>{!aiCheckResult.allowed ? "🛡️ AI Workload Guard" : "✨ AI Verification Passed"}</span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                              !aiCheckResult.allowed
                                ? "bg-amber-200/90 dark:bg-amber-900 text-amber-950 dark:text-amber-200"
                                : "bg-emerald-200/90 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200"
                            }`}
                          >
                            {!aiCheckResult.allowed ? "⚠️ AI Advisory • Active Workload" : "✅ Available • 0 Active Tasks"}
                          </span>
                        </div>

                        <p className="text-[11px] leading-relaxed opacity-90">
                          {aiCheckResult.reason}
                        </p>

                        {!aiCheckResult.allowed && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-800 dark:text-amber-300 font-semibold bg-amber-100/70 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg">
                            <span>👑 Advisory only — Club Leader retains full assignment authority.</span>
                          </div>
                        )}

                        {!aiCheckResult.allowed && aiCheckResult.recommendation && (
                          <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                            <span className="font-semibold block text-[10px] text-amber-800 dark:text-amber-300">
                              💡 AI Recommendation:
                            </span>
                            <span className="text-[11px] text-amber-900 dark:text-amber-200 block mt-0.5">
                              {aiCheckResult.recommendation}
                            </span>
                          </div>
                        )}

                        {!aiCheckResult.allowed && aiCheckResult.suggestedAlternative && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const altId = aiCheckResult.suggestedAlternative!.id;
                                setNewTaskAssignee(altId);
                                runAiWorkloadCheck(altId);
                              }}
                              className="rounded-xl bg-amber-800 dark:bg-amber-700 hover:bg-amber-900 text-white px-3 py-1.5 text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs"
                            >
                              👉 Assign to {aiCheckResult.suggestedAlternative.name} instead
                            </button>
                          </div>
                        )}

                        <div className="text-[9px] opacity-60 text-right pt-0.5">
                          Powered by ClubOps AI Engine
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Deliverables
                </label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Specific actions, files to prepare, or expectations..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Deadline
                </label>
                <input
                  type="datetime-local"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAiCheckResult(null);
                    setShowAddTaskModal(false);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTaskLoading || !newTaskAssignee}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {addTaskLoading
                    ? "Assigning..."
                    : aiCheckResult && !aiCheckResult.allowed
                    ? "Assign Anyway (Leader Override)"
                    : "Assign & Inform Volunteer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEADER REALLOCATE TASK MODAL */}
      {showReallocModal && reallocatingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-2xl space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reallocate Task</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transfer task responsibility from current volunteer to another active club member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReallocModal(false);
                  setReallocatingTask(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {reallocError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-xs font-semibold text-red-700 dark:text-red-300 whitespace-pre-line">
                ⚠️ {reallocError}
              </div>
            )}

            {reallocSuccess && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                ✓ {reallocSuccess}
              </div>
            )}

            {/* Current Task Details Box */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Target Task
              </span>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {reallocatingTask.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Currently assigned to: <strong className="text-slate-700 dark:text-slate-300">{reallocatingTask.assigned_to_name || "Unassigned"}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmReallocate} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Reallocate To Volunteer * <span className="text-rose-500 font-normal">(Compulsory)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    ⚡ AI Workload Guard
                  </span>
                </div>
                <select
                  required
                  value={reallocAssignee}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReallocAssignee(val);
                    runReallocAiCheck(val);
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                >
                  <option value="" disabled>-- Select Volunteer to Inform &amp; Reallocate * --</option>
                  {eventData.participants
                    .filter((p) => p.user_id !== reallocatingTask.assigned_to)
                    .map((p) => {
                      const hasActiveTask = eventData.tasks.some(
                        (t) => t.id !== reallocatingTask.id && t.assigned_to === p.user_id && t.status !== "completed"
                      );
                      const isAway = p.is_active === false;

                      return (
                        <option key={p.user_id} value={p.user_id} disabled={isAway}>
                          {p.full_name} ({p.assigned_role || "Volunteer"}) {isAway ? "🔴 [Away / Deactivated]" : hasActiveTask ? "🟡 [1 Active Task]" : "🟢 [Available]"}
                        </option>
                      );
                    })}
                </select>

                {/* AI Workload Check Status */}
                {reallocAssignee && (
                  <div className="mt-2.5">
                    {reallocAiChecking ? (
                      <div className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 text-xs text-indigo-700 dark:text-indigo-300">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                        <span className="font-semibold text-[11px]">
                          AI Workload Guard: Analyzing volunteer workload &amp; potential collision...
                        </span>
                      </div>
                    ) : reallocAiCheckResult ? (
                      <div
                        className={`rounded-2xl border p-3.5 text-xs space-y-2 transition-all ${
                          !reallocAiCheckResult.allowed
                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                            : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span>{!reallocAiCheckResult.allowed ? "🛡️ AI Workload Guard" : "✨ AI Verification Passed"}</span>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                              !reallocAiCheckResult.allowed
                                ? "bg-amber-200/90 dark:bg-amber-900 text-amber-950 dark:text-amber-200"
                                : "bg-emerald-200/90 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200"
                            }`}
                          >
                            {!reallocAiCheckResult.allowed ? "⚠️ AI Advisory • Active Workload" : "✅ Available • 0 Active Tasks"}
                          </span>
                        </div>

                        <p className="text-[11px] leading-relaxed opacity-90">
                          {reallocAiCheckResult.reason}
                        </p>

                        {!reallocAiCheckResult.allowed && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-800 dark:text-amber-300 font-semibold bg-amber-100/70 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg">
                            <span>👑 Advisory only — Club Leader retains full reallocation authority.</span>
                          </div>
                        )}

                        {!reallocAiCheckResult.allowed && reallocAiCheckResult.recommendation && (
                          <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                            <span className="font-semibold block text-[10px] text-amber-800 dark:text-amber-300">
                              💡 AI Recommendation:
                            </span>
                            <span className="text-[11px] text-amber-900 dark:text-amber-200 block mt-0.5">
                              {reallocAiCheckResult.recommendation}
                            </span>
                          </div>
                        )}

                        {!reallocAiCheckResult.allowed && reallocAiCheckResult.suggestedAlternative && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const altId = reallocAiCheckResult.suggestedAlternative!.id;
                                setReallocAssignee(altId);
                                runReallocAiCheck(altId);
                              }}
                              className="rounded-xl bg-amber-800 dark:bg-amber-700 hover:bg-amber-900 text-white px-3 py-1.5 text-[11px] font-bold transition flex items-center gap-1.5 shadow-xs"
                            >
                              👉 Reallocate to {reallocAiCheckResult.suggestedAlternative.name} instead
                            </button>
                          </div>
                        )}

                        <div className="text-[9px] opacity-60 text-right pt-0.5">
                          Powered by ClubOps AI Engine
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowReallocModal(false);
                    setReallocatingTask(null);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reallocLoading || !reallocAssignee}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {reallocLoading
                    ? "Reallocating..."
                    : reallocAiCheckResult && !reallocAiCheckResult.allowed
                    ? "Confirm Reallocation (Leader Override)"
                    : "Confirm Reallocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEADER MANAGE EVENT MEMBERS MODAL */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Manage Event Members</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select and assign who from the club participates in this specific event.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Member Action Message Banner */}
            {memberActionMsg && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold shrink-0 ${
                  memberActionMsg.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                }`}
              >
                {memberActionMsg.text}
              </div>
            )}

            {/* Search filter input */}
            <div className="shrink-0">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search club members by name, role, or email..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
              />
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1 space-y-2">
              {membersLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  Loading club members...
                </div>
              ) : allClubMembers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  No club members found.
                </div>
              ) : (
                allClubMembers
                  .filter(
                    (m) =>
                      m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      m.assigned_role.toLowerCase().includes(memberSearch.toLowerCase()) ||
                      m.email.toLowerCase().includes(memberSearch.toLowerCase())
                  )
                  .map((m) => {
                    const isProcessing = memberActionLoading === m.user_id;
                    const isLeaderUser = m.user_id === eventData.leader_id;

                    return (
                      <div
                        key={m.user_id}
                        className="pt-2 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                            {m.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                                {m.full_name}
                              </span>
                              {isLeaderUser && (
                                <span className="rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.2 text-[9px] font-bold shrink-0">
                                  👑 Leader
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                              {m.assigned_role} • {m.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {m.is_participant ? (
                            <>
                              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                ✓ Added
                              </span>
                              {!isLeaderUser && (
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleRemoveMemberFromEvent(m.user_id)}
                                  className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition min-h-[34px]"
                                >
                                  {isProcessing ? "Removing..." : "Remove"}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleAddMemberToEvent(m.user_id)}
                              className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition min-h-[34px] shadow-2xs"
                            >
                              {isProcessing ? "Adding..." : "+ Add to Event"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2 text-xs font-bold transition min-h-[40px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEADER DELETE EVENT CONFIRMATION MODAL */}
      {showDeleteEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Event?</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">&ldquo;{eventData.name}&rdquo;</strong>?
              All assigned tasks, volunteer responsibilities, and announcements for this event will be permanently erased.
            </p>

            {deleteEventError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
                ⚠️ {deleteEventError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={deletingEvent}
                onClick={() => setShowDeleteEventModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingEvent}
                onClick={handleDeleteEvent}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition disabled:opacity-50 min-h-[44px]"
              >
                {deletingEvent ? "Deleting..." : "Yes, Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI MEETING SUMMARIZER & TASK GENERATOR MODAL (LEADER ONLY) */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-4 shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 text-white font-bold text-lg shadow-md shadow-indigo-500/20">
                  🎙️
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                      AI Meeting Summarizer &amp; Task Generator
                    </h3>
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                      ClubOps AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Multilingual audio transcription, decision summaries, and volunteer task extraction.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeMeetingModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* STEP 1: UPLOAD OR RECORD */}
              {meetingStep === "upload" && (
                <div className="space-y-5">
                  {/* Mode Tabs */}
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isRecording) stopRecording();
                        setMeetingInputTab("upload");
                      }}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
                        meetingInputTab === "upload"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>📁</span> Upload Audio File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMeetingInputTab("record");
                      }}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 ${
                        meetingInputTab === "record"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>🎙️</span> Live Microphone Record
                    </button>
                  </div>

                  {/* Tab 1: Upload File */}
                  {meetingInputTab === "upload" && (
                    <div className="space-y-4">
                      <div
                        onClick={() => document.getElementById("meeting-audio-input")?.click()}
                        className="border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-400 dark:hover:border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-2xl p-6 text-center cursor-pointer transition hover:bg-indigo-50/40"
                      >
                        <input
                          id="meeting-audio-input"
                          type="file"
                          accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            handleAudioFileSelect(file);
                          }}
                          className="hidden"
                        />
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-2xl mb-3 shadow-inner">
                          🎵
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {meetingAudioFile ? meetingAudioFile.name : "Click to browse or drop meeting audio here"}
                        </h4>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          Supported formats: MP3, WAV, M4A, WEBM, OGG (Max 25MB)
                        </p>
                      </div>

                      {meetingAudioFile && (
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">🎧</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {meetingAudioFile.name}
                              </span>
                              <span className="text-slate-400 shrink-0">
                                ({(meetingAudioFile.size / (1024 * 1024)).toFixed(2)} MB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setMeetingAudioFile(null);
                                if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                                setAudioPreviewUrl(null);
                              }}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                          {audioPreviewUrl && (
                            <audio controls className="w-full h-10 rounded-lg" src={audioPreviewUrl} />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Live Recording */}
                  {meetingInputTab === "record" && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-6 text-center space-y-4">
                      {!isRecording && !meetingAudioFile && (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={startRecording}
                            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white text-2xl shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition cursor-pointer"
                          >
                            🎙️
                          </button>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Start Live Recording
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Record your meeting discussion directly through your device microphone.
                            </p>
                          </div>
                        </div>
                      )}

                      {isRecording && (
                        <div className="space-y-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <span className="flex h-3 w-3 rounded-full bg-rose-600 animate-ping" />
                            <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                              Recording Meeting Audio...
                            </span>
                          </div>
                          <div className="text-3xl font-mono font-black text-slate-900 dark:text-white">
                            {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                            {String(recordingSeconds % 60).padStart(2, "0")}
                          </div>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="mx-auto flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-500 active:scale-95 transition cursor-pointer"
                          >
                            ⏹️ Stop &amp; Save Recording
                          </button>
                        </div>
                      )}

                      {!isRecording && meetingAudioFile && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <span>✓</span>
                            <span>Recording Ready ({recordingSeconds}s)</span>
                          </div>
                          {audioPreviewUrl && (
                            <audio controls className="w-full max-w-md mx-auto h-10 rounded-lg" src={audioPreviewUrl} />
                          )}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setMeetingAudioFile(null);
                                if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                                setAudioPreviewUrl(null);
                              }}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                            >
                              🔄 Record Again
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Multilingual Support Banner */}
                  <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 to-violet-50/70 dark:from-indigo-950/40 dark:to-violet-950/40 p-4 flex items-start gap-3">
                    <span className="text-xl shrink-0">🌐</span>
                    <div className="text-xs space-y-0.5">
                      <strong className="text-indigo-950 dark:text-indigo-200 block">
                        Multilingual AI Engine
                      </strong>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        Speak in any language — <strong>English, Hindi, Hinglish, Spanish, French, Gujarati, German</strong>, etc.
                        ClubOps AI automatically transcribes speech, extracts key decisions, and maps tasks to event members in clean English.
                      </p>
                    </div>
                  </div>

                  {meetingError && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                      ⚠️ {meetingError}
                    </div>
                  )}

                  {/* Modal Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={closeMeetingModal}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!meetingAudioFile || isRecording || meetingAnalyzing}
                      onClick={handleAnalyzeMeetingAudio}
                      className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
                    >
                      <span>⚡</span> Analyze Meeting with ClubOps AI
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PROCESSING / AI ANALYSIS */}
              {meetingStep === "processing" && (
                <div className="py-12 text-center space-y-6">
                  <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-600/20 border-t-indigo-600 animate-spin" />
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl animate-pulse">
                      🎙️
                    </div>
                  </div>

                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Processing Meeting Audio
                    </h4>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                      {meetingProcessingStage}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                      Whisper speech model is converting speech and generating structured tasks...
                    </p>
                  </div>

                  <div className="flex justify-center items-center gap-2 pt-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & MANUAL EDITING (EXECUTIVE BRIEF & TASKS) */}
              {meetingStep === "review" && (
                <div className="space-y-6">
                  {/* Status & Re-Analyze Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/60">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-bold text-slate-900 dark:text-white">
                        AI Analysis Complete
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">•</span>
                      <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                        {extractedTasks.length} task{extractedTasks.length !== 1 ? "s" : ""} extracted
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMeetingStep("upload")}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                    >
                      ← Analyze Different Audio
                    </button>
                  </div>

                  {/* SECTION A: EXECUTIVE BRIEF & EVENT ANNOUNCEMENT */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📢</span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                          Official Broadcast Announcement Draft
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Editable before broadcasting
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Announcement Title
                      </label>
                      <input
                        type="text"
                        value={summaryTitle}
                        onChange={(e) => setSummaryTitle(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                        placeholder="e.g. 📢 Core Action Plan & Deliverables: Event Name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Announcement Body (Directly Broadcast to All Members)
                      </label>
                      <textarea
                        rows={4}
                        value={summaryBrief}
                        onChange={(e) => setSummaryBrief(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition leading-relaxed"
                        placeholder="Polished announcement message ready to be posted directly to the club feed..."
                      />
                    </div>

                    {/* Key Decisions Bullets */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Key Decisions Made ({summaryDecisions.length})
                      </label>
                      <div className="space-y-2">
                        {summaryDecisions.map((decision, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 shrink-0 font-bold">•</span>
                            <input
                              type="text"
                              value={decision}
                              onChange={(e) => {
                                const updated = [...summaryDecisions];
                                updated[idx] = e.target.value;
                                setSummaryDecisions(updated);
                              }}
                              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteDecision(idx)}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs px-1 cursor-pointer"
                              title="Delete decision"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="+ Add another decision point..."
                          value={newDecisionInput}
                          onChange={(e) => setNewDecisionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddDecision();
                            }
                          }}
                          className="flex-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddDecision}
                          disabled={!newDecisionInput.trim()}
                          className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-40 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Publish Announcement Card Action */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 rounded-xl">
                      <div className="text-xs">
                        <strong className="text-slate-800 dark:text-slate-200 block">
                          Broadcast to Event Announcements
                        </strong>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Publish this summary directly to the event announcements feed for all joined members.
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={publishingAnnouncement || announcementPublished || !summaryBrief.trim()}
                        onClick={handlePublishMeetingAnnouncement}
                        className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 min-h-[40px] cursor-pointer"
                      >
                        {publishingAnnouncement ? (
                          "Publishing..."
                        ) : announcementPublished ? (
                          "✓ Published to Announcements"
                        ) : (
                          "📢 Publish as Event Announcement"
                        )}
                      </button>
                    </div>
                  </div>

                  {/* SECTION B: EXTRACTED TASKS & VOLUNTEER ASSIGNMENTS */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎯</span>
                          <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                            Extracted Action Items &amp; Volunteer Assignments ({extractedTasks.length})
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Review, edit details, or reassign below. &ldquo;Whom to inform&rdquo; is compulsory for each task.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddNewTask}
                        className="self-start sm:self-auto rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                      >
                        + Add Another Task
                      </button>
                    </div>

                    {extractedTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
                        No tasks currently in list. Click &ldquo;+ Add Another Task&rdquo; to create one.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {extractedTasks.map((task, idx) => (
                          <div
                            key={task.tempId}
                            className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-900/60 p-4 space-y-3 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  Action Item
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <select
                                  value={task.priority}
                                  onChange={(e) =>
                                    handleUpdateExtractedTask(
                                      idx,
                                      "priority",
                                      e.target.value as "low" | "medium" | "high"
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                                >
                                  <option value="low">🟢 Low Priority</option>
                                  <option value="medium">🟡 Medium Priority</option>
                                  <option value="high">🔴 High Priority</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExtractedTask(idx)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                                  title="Delete task"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Task Title *
                              </label>
                              <input
                                type="text"
                                value={task.name}
                                onChange={(e) =>
                                  handleUpdateExtractedTask(idx, "name", e.target.value)
                                }
                                placeholder="e.g. Design Hackathon Poster & Social Banners"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Description &amp; Deliverables
                              </label>
                              <textarea
                                rows={2}
                                value={task.description}
                                onChange={(e) =>
                                  handleUpdateExtractedTask(idx, "description", e.target.value)
                                }
                                placeholder="Details, requirements, guidelines discussed..."
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Assign &amp; Inform Volunteer *
                                </label>
                                <select
                                  value={task.assigned_to}
                                  onChange={(e) =>
                                    handleUpdateExtractedTask(idx, "assigned_to", e.target.value)
                                  }
                                  className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none transition ${
                                    !task.assigned_to
                                      ? "border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                  }`}
                                >
                                  <option value="">-- Select volunteer to assign * --</option>
                                  {availableAssigneeOptions.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.name} {v.role ? `(${v.role})` : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Target Deadline
                                </label>
                                <input
                                  type="datetime-local"
                                  value={task.deadline ? task.deadline.slice(0, 16) : ""}
                                  onChange={(e) =>
                                    handleUpdateExtractedTask(idx, "deadline", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {batchTasksError && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        ⚠️ {batchTasksError}
                      </div>
                    )}

                    {batchTasksSuccess && (
                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {batchTasksSuccess}
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        Volunteers receive instant real-time notifications on assignment.
                      </span>

                      <button
                        type="button"
                        disabled={savingBatchTasks || extractedTasks.length === 0}
                        onClick={handleSaveBatchTasks}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-xs active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2 cursor-pointer"
                      >
                        <span>✓</span>
                        <span>
                          {savingBatchTasks
                            ? "Assigning Tasks..."
                            : `Assign & Save All Tasks (${extractedTasks.length})`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav clubCode={clubCode} />
    </main>
  );
}
