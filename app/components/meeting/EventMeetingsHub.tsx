"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ScheduleMeetingModal from "./ScheduleMeetingModal";
import MeetingSummaryModal from "./MeetingSummaryModal";

interface EventMeetingItem {
  id: string;
  event_id: string;
  club_id: string;
  title: string;
  meeting_code: string;
  status: "live" | "scheduled" | "completed" | "ended";
  scheduled_time: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  recording_url: string | null;
  recording_mime: string | null;
  processing_status: string;
  is_summary_published: boolean;
  published_announcement_id: string | null;
  created_by: string;
  created_at: string;
  creator_name: string | null;
  creator_photo: string | null;
  participant_count: number;
}

interface EventMeetingsHubProps {
  eventId: string;
  clubId: string;
  clubCode: string;
  eventName: string;
  isLeader: boolean;
  onAnnouncementsRefresh?: () => void;
  onTasksRefresh?: () => void;
}

export default function EventMeetingsHub({
  eventId,
  clubCode,
  eventName,
  isLeader,
  onAnnouncementsRefresh,
  onTasksRefresh,
}: EventMeetingsHubProps) {
  const router = useRouter();

  const [liveMeetings, setLiveMeetings] = useState<EventMeetingItem[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<EventMeetingItem[]>([]);
  const [pastMeetings, setPastMeetings] = useState<EventMeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingInstant, setStartingInstant] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSummaryCode, setSelectedSummaryCode] = useState<string | null>(null);

  async function loadMeetings() {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/meetings`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLiveMeetings(data.meetings.live || []);
        setUpcomingMeetings(data.meetings.upcoming || []);
        setPastMeetings(data.meetings.past || []);
      }
    } catch (err) {
      console.error("Error loading event meetings:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId) {
      loadMeetings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleStartInstantMeeting() {
    try {
      setStartingInstant(true);
      const res = await fetch(`/api/events/${eventId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate: true, title: `${eventName} Live Session` }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to start meeting.");
      }

      router.push(`/meeting/${data.meeting.meeting_code}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error starting meeting.");
      setStartingInstant(false);
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function formatDuration(sec: number) {
    if (!sec || sec <= 0) return "0 min";
    const mins = Math.round(sec / 60);
    return mins > 0 ? `${mins} min${mins === 1 ? "" : "s"}` : `${sec}s`;
  }

  return (
    <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#859B62]/20 border border-[#859B62]/40 text-[#8FA96D] text-lg font-bold">
              📹
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Event Meetings & Video Intelligence
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time WebRTC conferencing with multi-member screen sharing, audio recording, and automated AI minutes (10-day active retention).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>📅 Schedule</span>
          </button>

          <button
            type="button"
            onClick={handleStartInstantMeeting}
            disabled={startingInstant}
            className="px-4 py-2 rounded-xl bg-[#859B62] hover:bg-[#738852] disabled:opacity-50 text-xs font-bold text-white shadow-sm shadow-[#859B62]/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>{startingInstant ? "Starting..." : "● Start Live Meeting"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading meeting sessions...</div>
      ) : (
        <div className="space-y-6">
          {/* 1. Live Meetings Section */}
          {liveMeetings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Live Now ({liveMeetings.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveMeetings.map((mtg) => (
                  <div
                    key={mtg.id}
                    className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20 flex flex-col justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {mtg.meeting_code}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase animate-pulse">
                          In Progress
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{mtg.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Started by {mtg.creator_name || "Host"} • {mtg.participant_count} active participant{mtg.participant_count === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/20">
                      <button
                        onClick={() => handleCopy(mtg.meeting_code)}
                        className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-white dark:bg-slate-900 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 transition"
                      >
                        {copiedCode === mtg.meeting_code ? "Copied! ✓" : "Copy Code"}
                      </button>
                      <Link
                        href={`/meeting/${mtg.meeting_code}`}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center shadow-xs transition"
                      >
                        Join Live Room →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Scheduled Upcoming Meetings */}
          {upcomingMeetings.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Scheduled Upcoming ({upcomingMeetings.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcomingMeetings.map((mtg) => (
                  <div
                    key={mtg.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                          {mtg.meeting_code}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                          Scheduled
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{mtg.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {mtg.scheduled_time
                          ? new Date(mtg.scheduled_time).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Scheduled for later"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
                      <button
                        onClick={() => handleCopy(mtg.meeting_code)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
                      >
                        {copiedCode === mtg.meeting_code ? "Copied! ✓" : "Copy Code"}
                      </button>
                      <Link
                        href={`/meeting/${mtg.meeting_code}`}
                        className="flex-1 py-1.5 rounded-xl bg-[#859B62] hover:bg-[#738852] text-white text-xs font-bold text-center shadow-xs transition"
                      >
                        Enter Room →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Past Meetings (Previous 10 Days Retention) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Past Meetings (Previous 10 Days)
              </h3>
              <span className="text-[11px] text-slate-400">
                {pastMeetings.length} record{pastMeetings.length === 1 ? "" : "s"}
              </span>
            </div>

            {pastMeetings.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No completed meetings in the previous 10 days. Start a meeting above to record minutes and extract action items!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {pastMeetings.map((mtg) => {
                  const hasRecording = Boolean(mtg.recording_url);
                  const isProcessing =
                    mtg.processing_status === "transcribing" || mtg.processing_status === "analyzing";

                  return (
                    <div
                      key={mtg.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {mtg.title}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {mtg.meeting_code}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            {new Date(mtg.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span>•</span>
                          <span>Duration: {formatDuration(mtg.duration_seconds)}</span>
                          <span>•</span>
                          {hasRecording ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Recording Available ✓</span>
                          ) : (
                            <span>No Audio</span>
                          )}
                          {isProcessing && (
                            <span className="text-amber-500 font-medium animate-pulse">
                              Processing AI Summary...
                            </span>
                          )}
                          {mtg.is_summary_published && (
                            <span className="text-[#8FA96D] font-medium">Announcement Broadcasted ✓</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(mtg.meeting_code)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          {copiedCode === mtg.meeting_code ? "Copied! ✓" : "Copy Code"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSummaryCode(mtg.meeting_code)}
                          className="px-3 py-1.5 rounded-lg bg-[#859B62] hover:bg-[#738852] text-white text-xs font-bold shadow-xs transition"
                        >
                          View Summary & Tasks →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <ScheduleMeetingModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          eventId={eventId}
          eventName={eventName}
          onMeetingCreated={() => {
            loadMeetings();
          }}
        />
      )}

      {/* Meeting Summary & Intelligence Modal */}
      {selectedSummaryCode && (
        <MeetingSummaryModal
          isOpen={Boolean(selectedSummaryCode)}
          onClose={() => setSelectedSummaryCode(null)}
          meetingCode={selectedSummaryCode}
          isLeader={isLeader}
          onTaskCreated={() => {
            loadMeetings();
            onTasksRefresh?.();
          }}
          onAnnouncementPublished={() => {
            loadMeetings();
            onAnnouncementsRefresh?.();
          }}
        />
      )}
    </div>
  );
}
