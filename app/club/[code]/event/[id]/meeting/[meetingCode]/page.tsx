"use client";

import { use } from "react";
import MeetingPage from "../../../../../../meeting/[code]/page";

export default function EventMeetingPage({
  params,
}: {
  params: Promise<{ code: string; id: string; meetingCode: string }>;
}) {
  const { meetingCode } = use(params);
  // Forward to standard meeting page component with meetingCode
  return <MeetingPage params={Promise.resolve({ code: meetingCode })} />;
}
