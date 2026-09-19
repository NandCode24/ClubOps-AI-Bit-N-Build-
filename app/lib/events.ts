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
