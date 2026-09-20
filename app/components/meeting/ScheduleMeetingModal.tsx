"use client";

import React, { useState } from "react";

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  onMeetingCreated: () => void;
}

export default function ScheduleMeetingModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  onMeetingCreated,
}: ScheduleMeetingModalProps) {
  const [title, setTitle] = useState(`${eventName} Planning Meeting`);
  const [date, setDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("17:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdMeeting, setCreatedMeeting] = useState<{ code: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      setError("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const scheduledDateTime = new Date(`${date}T${time}:00`).toISOString();

      const res = await fetch(`/api/events/${eventId}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          immediate: false,
          title: title.trim(),
          scheduled_time: scheduledDateTime,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to schedule meeting.");
      }

      setCreatedMeeting({
        code: data.meeting.meeting_code,
        title: data.meeting.title,
      });

      onMeetingCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error scheduling meeting.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!createdMeeting) return;
    navigator.clipboard.writeText(createdMeeting.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#192015] border border-[#283422] rounded-2xl max-w-lg w-full p-6 shadow-2xl text-[#F4F6F0]">
        <div className="flex items-center justify-between pb-4 border-b border-[#283422] mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#859B62]/20 border border-[#859B62]/40 text-[#8FA96D] flex items-center justify-center font-bold text-sm">
              📅
            </div>
            <div>
              <h3 className="text-base font-bold">Schedule Event Meeting</h3>
              <p className="text-xs text-[#98AA90]">{eventName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#98AA90] hover:text-white text-sm p-1 rounded-lg hover:bg-[#202A1B]"
          >
            ✕
          </button>
        </div>

        {createdMeeting ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-[#859B62]/20 border border-[#859B62]/40 text-[#8FA96D] flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-bold mb-1">Meeting Scheduled!</h4>
            <p className="text-xs text-[#98AA90] mb-5">Share this unique meeting code with event members:</p>

            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="px-4 py-2 bg-[#0E140D] border border-[#859B62]/50 rounded-xl font-mono text-base font-bold text-[#D5E2C5]">
                {createdMeeting.code}
              </span>
              <button
                onClick={handleCopy}
                className="px-3.5 py-2 bg-[#859B62] hover:bg-[#738852] text-white text-xs font-semibold rounded-xl transition"
              >
                {copied ? "Copied! ✓" : "Copy Code"}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#202A1B] text-xs font-semibold text-[#D5E2C5] hover:bg-[#283422]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleScheduleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#D5E2C5] mb-1">Meeting Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Stage Setup & Logistics Dry Run"
                className="w-full px-3.5 py-2.5 bg-[#0E140D] border border-[#283422] rounded-xl text-xs text-white focus:outline-none focus:border-[#859B62]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#D5E2C5] mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#0E140D] border border-[#283422] rounded-xl text-xs text-white focus:outline-none focus:border-[#859B62]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D5E2C5] mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#0E140D] border border-[#283422] rounded-xl text-xs text-white focus:outline-none focus:border-[#859B62]"
                  required
                />
              </div>
            </div>

            <p className="text-[11px] text-[#6B7E64]">
              A unique human-readable meeting code will be generated. Camera and mic permissions are requested only when participants join.
            </p>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#202A1B] text-xs font-semibold text-[#D5E2C5] hover:bg-[#283422]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#859B62] hover:bg-[#738852] disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-[#859B62]/20 transition"
              >
                {loading ? "Scheduling..." : "Schedule Meeting"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
