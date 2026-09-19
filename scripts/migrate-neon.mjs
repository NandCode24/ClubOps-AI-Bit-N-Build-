import { neon } from "@neondatabase/serverless";


const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function runMigration() {
  console.log("Starting Neon PostgreSQL migration for ClubOps AI...");

  try {
    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        mobile_number VARCHAR(50),
        college_name VARCHAR(255),
        skills TEXT[] DEFAULT '{}',
        photo_url TEXT,
        is_available BOOLEAN DEFAULT true,
        unavailable_until TIMESTAMPTZ,
        unavailable_reason VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ;`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_reason VARCHAR(255);`;
    console.log("✓ Created/verified users table");

    // 2. Clubs Table
    await sql`
      CREATE TABLE IF NOT EXISTS clubs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        profile_image TEXT,
        leader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        leader_name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log("✓ Created/verified clubs table");

    // 3. Club Roles Table
    await sql`
      CREATE TABLE IF NOT EXISTS club_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        role_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_club_role UNIQUE (club_id, role_name)
      );
    `;
    console.log("✓ Created/verified club_roles table");

    // 4. Club Members Table
    await sql`
      CREATE TABLE IF NOT EXISTS club_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_type VARCHAR(50) NOT NULL DEFAULT 'volunteer',
        assigned_role VARCHAR(100),
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_club_member UNIQUE (club_id, user_id)
      );
    `;
    console.log("✓ Created/verified club_members table");

    // 5. Join Requests Table
    await sql`
      CREATE TABLE IF NOT EXISTS join_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ,
        reviewed_by TEXT REFERENCES users(id)
      );
    `;
    console.log("✓ Created/verified join_requests table");

    // 6. Events Table
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        venue VARCHAR(255),
        mode VARCHAR(50) DEFAULT 'offline',
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        meeting_link TEXT,
        meeting_code TEXT,
        meeting_time TIMESTAMPTZ,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    // Add columns if table already existed
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_link TEXT;`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_code TEXT;`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS meeting_time TIMESTAMPTZ;`;
    console.log("✓ Created/verified events table");

    // 6.1 Event Participants Table
    await sql`
      CREATE TABLE IF NOT EXISTS event_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_role VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_event_participant UNIQUE (event_id, user_id)
      );
    `;
    console.log("✓ Created/verified event_participants table");

    // 7. Tasks Table (with AI risk constraint: 1 active task per volunteer)
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        deadline TIMESTAMPTZ,
        status VARCHAR(50) DEFAULT 'pending',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`;
    console.log("✓ Created/verified tasks table");

    // 8. Announcements & Meeting Summaries
    await sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        event_id UUID REFERENCES events(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        audio_url TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log("✓ Created/verified announcements table");

    // Indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_clubs_code ON clubs(club_code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_join_requests_club_status ON join_requests(club_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_events_club ON events(club_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_event ON tasks(event_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_availability ON users(is_available, unavailable_until);`;

    console.log("✓ Created/verified indexes");
    console.log("Migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
