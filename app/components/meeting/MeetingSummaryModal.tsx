"use client";

import React, { useState, useEffect, useRef } from "react";

interface ActionItem {
  task: string;
  owner?: string | null;
  owner_id?: string | null;
  deadline?: string | null;
  priority?: "high" | "medium" | "low";
}

interface RiskItem {
  risk: string;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
}

interface MeetingSummaryData {
  id: string;
  meeting_code: string;
  event_id: string;
  club_id: string;
  title: string;
  status: string;
  scheduled_time: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  transcript: string | null;
  summary_title: string | null;
  summary_content: string | null;
  summary_decisions: string[];
  extracted_tasks: ActionItem[];
  summary_risks: RiskItem[];
  summary_next_steps: string[];
  recording_url: string | null;
  recording_mime: string | null;
  recording_size: number | null;
  processing_status: string;
  is_summary_published: boolean;
  published_announcement_id: string | null;
  isLeader: boolean;
  event_name: string;
  club_name: string;
}

interface MeetingSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingCode: string;
  isLeader: boolean;
  onTaskCreated?: () => void;
  onAnnouncementPublished?: () => void;
}

export default function MeetingSummaryModal({
  isOpen,
  onClose,
  meetingCode,
  isLeader,
  onTaskCreated,
  onAnnouncementPublished,
}: MeetingSummaryModalProps) {
  const [data, setData] = useState<MeetingSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Task creation state
  const [createdTaskIndices, setCreatedTaskIndices] = useState<Set<number>>(new Set());
  const [creatingTaskIdx, setCreatingTaskIdx] = useState<number | null>(null);
  const [creatingAllTasks, setCreatingAllTasks] = useState(false);
  const [taskSuccessMsg, setTaskSuccessMsg] = useState("");

  // Announcement Publish State
  const [showPublishPreview, setShowPublishPreview] = useState(false);
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementSuccess, setAnnouncementSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !meetingCode) return;

    async function loadSummary() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/meetings/${meetingCode}/summary`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Failed to load meeting summary.");
        }
        setData(json.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading summary.");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [isOpen, meetingCode]);

  // Audio Player Handlers
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const formatAudioTime = (sec: number) => {
    if (isNaN(sec) || sec < 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Convert Single Action Item to Task
  const handleCreateTask = async (item: ActionItem, idx: number) => {
    try {
      setCreatingTaskIdx(idx);
      const res = await fetch(`/api/meetings/${meetingCode}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.message || "Failed to create task.");
      }

      setCreatedTaskIndices((prev) => new Set(prev).add(idx));
      setTaskSuccessMsg(`Task "${item.task.slice(0, 30)}..." added to event tasks!`);
      setTimeout(() => setTaskSuccessMsg(""), 3500);
      onTaskCreated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating task.");
    } finally {
      setCreatingTaskIdx(null);
    }
  };

  // Convert All Action Items to Tasks
  const handleCreateAllTasks = async () => {
    if (!data?.extracted_tasks || data.extracted_tasks.length === 0) return;

    try {
      setCreatingAllTasks(true);
      const uncreated = data.extracted_tasks.filter((_, idx) => !createdTaskIndices.has(idx));
      if (uncreated.length === 0) {
        alert("All action items have already been created as tasks!");
        return;
      }

      const res = await fetch(`/api/meetings/${meetingCode}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: uncreated }),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.message || "Failed to batch create tasks.");
      }

      // Mark all as created
      const allIdx = new Set(data.extracted_tasks.map((_, i) => i));
      setCreatedTaskIndices(allIdx);
      setTaskSuccessMsg(`Successfully created ${uncreated.length} event task${uncreated.length === 1 ? "" : "s"}!`);
      setTimeout(() => setTaskSuccessMsg(""), 4000);
      onTaskCreated?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating tasks.");
    } finally {
      setCreatingAllTasks(false);
    }
  };

  // Publish Summary as Announcement
  const handlePublishAnnouncement = async () => {
    try {
      setPublishingAnnouncement(true);
      const res = await fetch(`/api/meetings/${meetingCode}/publish-announcement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.message || "Failed to publish announcement.");
      }

      setAnnouncementSuccess(true);
      setShowPublishPreview(false);
      setData((prev) => (prev ? { ...prev, is_summary_published: true } : prev));
      onAnnouncementPublished?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error publishing announcement.");
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#192015] border border-[#283422] rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-[#F4F6F0] overflow-hidden">
        {/* Top Header */}
        <header className="p-5 sm:p-6 border-b border-[#283422] flex items-center justify-between shrink-0 bg-[#121810]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#859B62]/20 border border-[#859B62]/40 text-[#8FA96D] flex items-center justify-center font-bold text-base shadow-sm">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  {data?.summary_title || data?.title || "Meeting Summary & Intelligence"}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#202A1B] border border-[#283422] text-[#8FA96D]">
                  {meetingCode}
                </span>
              </div>
              <p className="text-xs text-[#98AA90] mt-0.5">
                {data ? `${data.club_name} • ${data.event_name}` : "Loading meeting details..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Publish Summary Button (Leader Only) */}
            {isLeader && data && (
              data.is_summary_published ? (
                <span className="px-3 py-1.5 rounded-xl bg-[#859B62]/20 border border-[#859B62]/40 text-xs font-semibold text-[#8FA96D] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Published ✓</span>
                </span>
              ) : (
                <button
                  onClick={() => setShowPublishPreview(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#859B62] hover:bg-[#738852] text-xs font-bold text-white shadow-md shadow-[#859B62]/20 transition flex items-center gap-1.5"
                >
                  <span>📢 Publish Summary</span>
                </button>
              )
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#202A1B] hover:bg-[#283422] text-[#98AA90] hover:text-white flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#859B62] border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-xs text-[#98AA90]">Loading meeting intelligence and audio...</p>
            </div>
          ) : error || !data ? (
            <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
              {error || "Unable to load meeting summary."}
            </div>
          ) : (
            <>
              {/* Status Banner */}
              {data.processing_status === "transcribing" || data.processing_status === "analyzing" ? (
                <div className="p-4 rounded-2xl bg-[#859B62]/10 border border-[#859B62]/30 flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-[#8FA96D] border-t-transparent animate-spin" />
                  <div>
                    <h4 className="text-xs font-bold text-[#D5E2C5]">
                      {data.processing_status === "transcribing" ? "Transcribing meeting audio with Sarvam AI..." : "Extracting structured insights with Gemini..."}
                    </h4>
                    <p className="text-[11px] text-[#98AA90]">Results will populate automatically once processing is complete.</p>
                  </div>
                </div>
              ) : null}

              {/* Toast Message */}
              {taskSuccessMsg && (
                <div className="p-3 rounded-xl bg-[#859B62]/20 border border-[#859B62]/40 text-[#D5E2C5] text-xs font-medium flex items-center gap-2">
                  <span>✓</span>
                  <span>{taskSuccessMsg}</span>
                </div>
              )}

              {/* Audio Recording Player */}
              {data.recording_url ? (
                <div className="p-4 rounded-2xl bg-[#121810] border border-[#283422] shadow-inner space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#D5E2C5] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8FA96D]" />
                      Meeting Audio Recording
                    </span>
                    <span className="text-[#98AA90] font-mono text-[11px]">
                      {formatAudioTime(currentTime)} / {formatAudioTime(duration || data.duration_seconds)}
                    </span>
                  </div>

                  <audio
                    ref={audioRef}
                    src={data.recording_url}
                    onTimeUpdate={() => {
                      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                    }}
                    onLoadedMetadata={() => {
                      if (audioRef.current) setDuration(audioRef.current.duration);
                    }}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />

                  {/* Scrubber */}
                  <input
                    type="range"
                    min="0"
                    max={duration || data.duration_seconds || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-[#859B62] h-1.5 bg-[#202A1B] rounded-lg cursor-pointer"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePlayAudio}
                        className="px-3.5 py-1.5 rounded-xl bg-[#859B62] hover:bg-[#738852] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        {isPlaying ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <span>Play Recording</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#6B7E64]">Vol</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 accent-[#859B62] h-1 bg-[#202A1B] rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Executive Overview */}
              {data.summary_content && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8FA96D]">Executive Briefing</h4>
                  <div className="p-4 rounded-2xl bg-[#121810]/70 border border-[#283422] text-xs sm:text-sm text-[#F4F6F0] leading-relaxed">
                    {data.summary_content}
                  </div>
                </section>
              )}

              {/* Key Decisions */}
              {data.summary_decisions && data.summary_decisions.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8FA96D]">Key Decisions Made</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {data.summary_decisions.map((dec, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#121810] border border-[#283422] flex items-start gap-2.5 text-xs">
                        <span className="text-[#8FA96D] font-bold">✓</span>
                        <span className="text-[#D5E2C5]">{dec}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Action Items → Event Tasks */}
              {data.extracted_tasks && data.extracted_tasks.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#8FA96D]">Action Items & Delegations</h4>
                      <p className="text-[11px] text-[#98AA90]">Click &ldquo;Create Task&rdquo; to sync an action item into the event task board.</p>
                    </div>

                    {isLeader && (
                      <button
                        onClick={handleCreateAllTasks}
                        disabled={creatingAllTasks}
                        className="px-3 py-1.5 bg-[#202A1B] hover:bg-[#283422] border border-[#859B62]/40 text-xs font-bold text-[#8FA96D] rounded-xl transition disabled:opacity-50"
                      >
                        {creatingAllTasks ? "Creating..." : "Create All Tasks"}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {data.extracted_tasks.map((task, idx) => {
                      const isCreated = createdTaskIndices.has(idx);
                      const priorityColor =
                        task.priority === "high"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : task.priority === "medium"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30";

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[#121810] border border-[#283422] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">{task.task}</span>
                              {task.priority && (
                                <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-mono ${priorityColor}`}>
                                  {task.priority}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[#98AA90]">
                              <span>Assignee: <strong className="text-[#D5E2C5]">{task.owner || "Unassigned"}</strong></span>
                              {task.deadline && (
                                <span>Due: <strong className="text-[#D5E2C5]">{task.deadline.slice(0, 10)}</strong></span>
                              )}
                            </div>
                          </div>

                          {isLeader && (
                            <button
                              onClick={() => handleCreateTask(task, idx)}
                              disabled={isCreated || creatingTaskIdx === idx}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                                isCreated
                                  ? "bg-[#202A1B] text-[#8FA96D] border border-[#859B62]/40"
                                  : "bg-[#859B62] hover:bg-[#738852] text-white shadow-sm"
                              }`}
                            >
                              {isCreated ? "Created ✓" : creatingTaskIdx === idx ? "Creating..." : "Create Task"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Identified Risks */}
              {data.summary_risks && data.summary_risks.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8FA96D]">Risks & Bottlenecks Detected</h4>
                  <div className="space-y-2">
                    {data.summary_risks.map((r, idx) => {
                      const sevColor =
                        r.severity === "critical" || r.severity === "high"
                          ? "border-red-500/40 bg-red-500/10 text-red-300"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-300";

                      return (
                        <div key={idx} className={`p-3 rounded-xl border ${sevColor} text-xs space-y-1`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{r.risk}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/40">
                              {r.severity}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-90">{r.explanation}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Transcript Viewer */}
              {data.transcript && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8FA96D]">Meeting Transcript (Multilingual)</h4>
                  <div className="p-4 rounded-2xl bg-[#0E140D] border border-[#283422] max-h-56 overflow-y-auto font-mono text-xs text-[#98AA90] leading-relaxed whitespace-pre-wrap">
                    {data.transcript}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-[#283422] bg-[#121810]/50 flex justify-between items-center text-xs text-[#6B7E64]">
          <span>AI Pipeline: Sarvam Saaras v4 STT • Google Gemini 2.5 Flash</span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-[#202A1B] text-[#D5E2C5] hover:bg-[#283422] font-semibold">
            Close
          </button>
        </footer>

        {/* Publish Summary Announcement Preview Modal */}
        {showPublishPreview && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-[#192015] border border-[#283422] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <h4 className="text-base font-bold text-white">Broadcast Announcement Preview</h4>
              <p className="text-xs text-[#98AA90]">
                The following briefing will be published as an official event announcement for all members:
              </p>

              <div className="p-4 rounded-xl bg-[#0E140D] border border-[#283422] max-h-60 overflow-y-auto text-xs text-[#D5E2C5] space-y-3 font-sans leading-relaxed">
                <div>
                  <h5 className="font-bold text-white mb-1">Meeting Summary — {data?.title}</h5>
                  <p className="text-[11px] text-[#98AA90]">{data?.summary_content}</p>
                </div>

                {data?.summary_decisions && data.summary_decisions.length > 0 && (
                  <div>
                    <h6 className="font-semibold text-[#8FA96D] text-[11px]">Decisions:</h6>
                    <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                      {data.summary_decisions.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}

                {data?.extracted_tasks && data.extracted_tasks.length > 0 && (
                  <div>
                    <h6 className="font-semibold text-[#8FA96D] text-[11px]">Action Items:</h6>
                    <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                      {data.extracted_tasks.map((t, i) => (
                        <li key={i}>{t.task} ({t.owner || "Unassigned"})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishPreview(false)}
                  className="px-4 py-2 rounded-xl bg-[#202A1B] text-xs font-semibold text-[#D5E2C5]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePublishAnnouncement}
                  disabled={publishingAnnouncement}
                  className="px-4 py-2 rounded-xl bg-[#859B62] hover:bg-[#738852] disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-[#859B62]/20"
                >
                  {publishingAnnouncement ? "Publishing..." : "Confirm & Broadcast Announcement"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
