import { EventEmitter } from "events";

// Use a global singleton so that all Next.js API routes and SSE streams share the same event bus
declare global {
  // eslint-disable-next-line no-var
  var __clubEventEmitter: EventEmitter | undefined;
}

if (!globalThis.__clubEventEmitter) {
  globalThis.__clubEventEmitter = new EventEmitter();
  // Increase max listeners for multiple connected clients
  globalThis.__clubEventEmitter.setMaxListeners(100);
}

export const clubEvents: EventEmitter = globalThis.__clubEventEmitter;

export interface RealtimeJoinRequestEvent {
  request_id: string;
  club_id: string;
  user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  full_name: string;
  email: string;
  skills: string[];
  photo_url: string | null;
}

export function emitNewJoinRequest(clubId: string, payload: RealtimeJoinRequestEvent) {
  clubEvents.emit(`club:${clubId}:request`, payload);
  // Also emit to general club events for multi-club dashboards
  clubEvents.emit(`club:any:request`, payload);
}

export interface RealtimeTaskEvent {
  action: "created" | "updated" | "status_change" | "reallocated";
  task_id: string;
  club_id: string;
  event_id: string;
  name: string;
  status: string;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  previous_assignee_name?: string | null;
  deadline?: string | null;
  updated_at: string;
}

export function emitTaskEvent(clubId: string, payload: RealtimeTaskEvent) {
  clubEvents.emit(`club:${clubId}:tasks`, payload);
  clubEvents.emit(`club:any:tasks`, payload);
}

export interface RealtimeEventEvent {
  action: "created" | "updated" | "deleted" | "participant_added" | "participant_removed" | "announcement_posted";
  event_id?: string;
  club_id: string;
  name?: string;
  user_id?: string;
  announcement?: any;
}

export function emitClubEventUpdate(clubId: string, payload: RealtimeEventEvent) {
  clubEvents.emit(`club:${clubId}:events`, payload);
}

