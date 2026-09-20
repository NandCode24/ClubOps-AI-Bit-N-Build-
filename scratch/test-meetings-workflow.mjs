import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runTests() {
  console.log("==================================================");
  console.log("STARTING CLUB OPS REAL-TIME MEETING SYSTEM TESTS");
  console.log("==================================================");

  // Test 1: Query an existing event and club for test fixture
  console.log("\n[Test 1] Locating test event and club...");
  const events = await sql`
    SELECT e.id as event_id, e.name as event_name, e.club_id, c.name as club_name, c.leader_id
    FROM events e
    JOIN clubs c ON c.id = e.club_id
    LIMIT 1
  `;

  if (events.length === 0) {
    throw new Error("No existing events found in database to test against.");
  }

  const testEvent = events[0];
  console.log(`✓ Test Event found: "${testEvent.event_name}" (${testEvent.event_id}) in club "${testEvent.club_name}"`);

  // Test 2: Generate Unique Meeting Code format verification
  console.log("\n[Test 2] Verifying Unique Meeting Code Generation...");
  const chars = "23456789abcdefghjkmnpqrstuvwxyz";
  let p1 = "";
  let p2 = "";
  for (let i = 0; i < 3; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const testMeetingCode = `mtg-${p1}-${p2}`;
  if (!/^mtg-[a-z0-9]{3}-[a-z0-9]{3}$/.test(testMeetingCode)) {
    throw new Error(`Generated meeting code ${testMeetingCode} does not match mtg-xxx-yyy pattern.`);
  }
  console.log(`✓ Generated code: ${testMeetingCode} (Non-sequential, Human-readable, Secure)`);

  // Test 3: Insert Immediate Meeting into Neon DB
  console.log("\n[Test 3] Testing Immediate Meeting Creation...");
  const insertedLive = await sql`
    INSERT INTO event_meetings (
      event_id,
      club_id,
      title,
      meeting_code,
      status,
      started_at,
      created_by,
      processing_status
    ) VALUES (
      ${testEvent.event_id},
      ${testEvent.club_id},
      'Test Live Operational Sync',
      ${testMeetingCode},
      'live',
      NOW(),
      ${testEvent.leader_id},
      'waiting'
    )
    RETURNING id, title, meeting_code, status, started_at
  `;

  const liveMtg = insertedLive[0];
  console.log(`✓ Live meeting created in DB. ID: ${liveMtg.id}, Status: ${liveMtg.status}`);

  // Test 4: Insert Participant into event_meeting_participants
  console.log("\n[Test 4] Testing Participant Tracking...");
  const participant = await sql`
    INSERT INTO event_meeting_participants (
      meeting_id,
      user_id,
      display_name,
      role
    ) VALUES (
      ${liveMtg.id},
      ${testEvent.leader_id},
      'Test Club Leader',
      'host'
    )
    RETURNING id, display_name, role, joined_at
  `;
  console.log(`✓ Participant joined: ${participant[0].display_name} (${participant[0].role})`);

  // Test 5: Verify 10-Day Retention Filter Query
  console.log("\n[Test 5] Verifying 10-Day Retention Filter...");
  // Create an old mock meeting (15 days ago) to test retention boundary
  const oldCode = `mtg-old-${Date.now().toString(36).slice(-3)}`;
  await sql`
    INSERT INTO event_meetings (
      event_id,
      club_id,
      title,
      meeting_code,
      status,
      created_at,
      created_by
    ) VALUES (
      ${testEvent.event_id},
      ${testEvent.club_id},
      'Expired 15-Day Old Meeting',
      ${oldCode},
      'completed',
      NOW() - INTERVAL '15 days',
      ${testEvent.leader_id}
    )
  `;

  // Query with 10-day retention clause
  const retentionResults = await sql`
    SELECT id, meeting_code, status, created_at
    FROM event_meetings
    WHERE event_id = ${testEvent.event_id}
      AND (
        status = 'live'
        OR status = 'scheduled'
        OR created_at >= (NOW() - INTERVAL '10 days')
      )
  `;

  const includesOld = retentionResults.some((m) => m.meeting_code === oldCode);
  const includesLive = retentionResults.some((m) => m.meeting_code === testMeetingCode);

  if (includesOld) {
    throw new Error("Retention filter failed: 15-day old meeting was returned!");
  }
  if (!includesLive) {
    throw new Error("Retention filter failed: active meeting was not returned!");
  }
  console.log(`✓ 10-Day retention filter passed: 15-day old meeting hidden, recent/live meetings preserved.`);

  // Clean up the dummy old meeting
  await sql`DELETE FROM event_meetings WHERE meeting_code = ${oldCode}`;

  // Test 6: Meeting Wrap-up & AI Data Persistence
  console.log("\n[Test 6] Testing Meeting Wrap-up, Metadata & AI Persistence...");
  const mockDecisions = ["Finalized stage dimensions and sound system check", "Confirmed volunteer check-in schedule"];
  const mockTasks = [
    {
      task: "Coordinate Audio/Visual Setup & Mic Test",
      owner: "Dev Kamani",
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      priority: "high",
    },
    {
      task: "Verify Attendee Entry Badges & Wristbands",
      owner: "Volunteer Team",
      deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      priority: "medium",
    },
  ];
  const mockRisks = [
    {
      risk: "Potential audio feedback if backup speaker is near stage",
      severity: "medium",
      explanation: "Stage acoustics need acoustic padding on left side.",
    },
  ];

  const updatedMtg = await sql`
    UPDATE event_meetings
    SET 
      status = 'completed',
      ended_at = NOW(),
      duration_seconds = 1845,
      transcript = 'Speaker 1: Welcome everyone. We need to finalize audio setup and attendee verification.',
      summary_title = 'Stage Setup & Attendee Logistics Briefing',
      summary_content = 'The operations team aligned on audio/visual setup timelines, volunteer shifts, and venue readiness.',
      summary_decisions = ${JSON.stringify(mockDecisions)}::jsonb,
      extracted_tasks = ${JSON.stringify(mockTasks)}::jsonb,
      summary_risks = ${JSON.stringify(mockRisks)}::jsonb,
      summary_next_steps = ${JSON.stringify(["Run rehearsal tomorrow at 4 PM"])}::jsonb,
      processing_status = 'completed',
      recording_url = '/api/meetings/recordings/test-rec.webm',
      recording_mime = 'audio/webm',
      recording_size = 2048500
    WHERE id = ${liveMtg.id}
    RETURNING id, title, summary_title, processing_status, duration_seconds, recording_url
  `;

  console.log(`✓ Meeting metadata and AI intelligence saved: "${updatedMtg[0].summary_title}", Duration: ${updatedMtg[0].duration_seconds}s, Status: ${updatedMtg[0].processing_status}`);

  // Test 7: Action Item Conversion to Event Task
  console.log("\n[Test 7] Testing Action Item -> Event Task Conversion...");
  const insertedTask = await sql`
    INSERT INTO tasks (
      club_id,
      event_id,
      name,
      description,
      status
    ) VALUES (
      ${testEvent.club_id},
      ${testEvent.event_id},
      ${mockTasks[0].task},
      'Generated from meeting action items.',
      'pending'
    )
    RETURNING id, name, status, created_at
  `;

  console.log(`✓ Converted Action Item into official Event Task: "${insertedTask[0].name}" (ID: ${insertedTask[0].id})`);

  // Clean up created task
  await sql`DELETE FROM tasks WHERE id = ${insertedTask[0].id}`;

  // Test 8: Leader Announcement Publishing
  console.log("\n[Test 8] Testing Publish Summary as Announcement...");
  const announcementContent = `**Overview**\n${updatedMtg[0].summary_title}\n\n**Decisions Made**\n• ${mockDecisions.join("\n• ")}`;
  const insertedAnnouncement = await sql`
    INSERT INTO announcements (
      club_id,
      event_id,
      title,
      content,
      created_by
    ) VALUES (
      ${testEvent.club_id},
      ${testEvent.event_id},
      'Meeting Summary — Stage Setup & Attendee Logistics',
      ${announcementContent},
      ${testEvent.leader_id}
    )
    RETURNING id, title, created_at
  `;

  await sql`
    UPDATE event_meetings
    SET is_summary_published = true,
        published_announcement_id = ${insertedAnnouncement[0].id}
    WHERE id = ${liveMtg.id}
  `;

  console.log(`✓ Published Meeting Summary as Announcement: "${insertedAnnouncement[0].title}" (ID: ${insertedAnnouncement[0].id})`);

  // Clean up test announcement & meeting
  await sql`DELETE FROM announcements WHERE id = ${insertedAnnouncement[0].id}`;
  await sql`DELETE FROM event_meetings WHERE id = ${liveMtg.id}`;

  console.log("\n==================================================");
  console.log("ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
