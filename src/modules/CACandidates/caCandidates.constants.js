export const caCandidatesTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_candidates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    initials VARCHAR(10) NOT NULL,
    details VARCHAR(255),
    role VARCHAR(255) NOT NULL,
    match INTEGER NOT NULL,
    stage VARCHAR(50) NOT NULL,
    source VARCHAR(100),
    applied VARCHAR(50),
    notes JSONB DEFAULT '[]'::jsonb,
    assessment_count INTEGER DEFAULT 0,
    email VARCHAR(255),
    phone VARCHAR(50),
    experience VARCHAR(50),
    location VARCHAR(255),
    skills JSONB DEFAULT '[]'::jsonb,
    created_by_company_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;

export const mapCACandidate = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    details: row.details,
    role: row.role,
    match: row.match,
    stage: row.stage,
    source: row.source,
    applied: row.applied,
    notes: row.notes || [],
    assessmentCount: row.assessment_count,
    email: row.email,
    phone: row.phone,
    experience: row.experience,
    location: row.location,
    skills: row.skills || [],
    companyId: row.created_by_company_id,
  };
};
