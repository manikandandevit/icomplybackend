export const caOffersTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_offers (
  id SERIAL PRIMARY KEY,
  created_by_company_id INTEGER NOT NULL,
  candidate_id INTEGER,
  candidate_name TEXT NOT NULL,
  role TEXT NOT NULL,
  ctc TEXT,
  joining_bonus TEXT,
  joining_date DATE,
  sent_on DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Sent',
  deadline DATE,
  req_id TEXT,
  document_name TEXT,
  document_url TEXT,
  documents JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const ALLOWED_OFFER_FIELDS = [
  "candidate_id",
  "candidate_name",
  "role",
  "ctc",
  "joining_bonus",
  "joining_date",
  "sent_on",
  "status",
  "deadline",
  "req_id",
  "document_name",
  "document_url",
  "documents",
];
