export const caInterviewsTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_interviews (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_company_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    role VARCHAR(255),
    interviewer VARCHAR(255),
    type VARCHAR(255),
    datetime VARCHAR(100),
    mode VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Scheduled',
    rating INTEGER,
    feedback TEXT,
    is_frozen BOOLEAN DEFAULT FALSE,
    round_name VARCHAR(100)
  );
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS rating INTEGER;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS feedback TEXT;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS round_name VARCHAR(100);
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS feedback_history JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS status_reason TEXT;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS rounds_completed INTEGER DEFAULT 1;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS completed_round VARCHAR(100);
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS invite_sent BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS meeting_link TEXT;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS venue TEXT;
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS last_status_email_sent VARCHAR(255);
  ALTER TABLE public.ca_interviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  ALTER TABLE public.ca_interviews ALTER COLUMN type TYPE VARCHAR(255);
  ALTER TABLE IF EXISTS public.ca_candidates ALTER COLUMN initials DROP NOT NULL;
  ALTER TABLE IF EXISTS public.ca_candidates ALTER COLUMN match DROP NOT NULL;
`;

export const mapCAInterview = (row) => ({
  id: row.id,
  candidateId: row.candidate_id,
  role: row.role,
  interviewer: row.interviewer,
  type: row.type,
  datetime: row.datetime,
  mode: row.mode,
  status: row.status,
  rating: row.rating ? Number(row.rating) : 0,
  feedback: row.feedback || "",
  statusReason: row.status_reason || "",
  roundsCompleted: row.rounds_completed ? Number(row.rounds_completed) : 1,
  completedRound: row.completed_round || "",
  feedbackHistory: Array.isArray(row.feedback_history) ? row.feedback_history : [],
  inviteSent: !!row.invite_sent,
  inviteSentAt: row.invite_sent_at || row.created_at || null,
  isFrozen: !!row.is_frozen,
  roundName: row.round_name || row.type || "Interview Round",
  meetingLink: row.meeting_link || "",
  venue: row.venue || "",
  lastStatusEmailSent: row.last_status_email_sent || "",
  createdAt: row.created_at,
  companyId: row.created_by_company_id,
});
