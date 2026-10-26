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
    establishment_id VARCHAR(100),
    establishment_name VARCHAR(255),
    expected_ctc VARCHAR(100),
    highest_qualification VARCHAR(255),
    notice_period VARCHAR(100),
    resume_url TEXT,
    resume_name VARCHAR(255),
    documents JSONB DEFAULT '[]'::jsonb,
    workflow_stages JSONB DEFAULT '[]'::jsonb,
    created_by_company_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS workflow_stages JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE IF EXISTS public.ca_candidates ALTER COLUMN stage TYPE VARCHAR(255);
  ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS current_round VARCHAR(255);
  ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS rejection_email_sent_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS selection_email_sent_at TIMESTAMP WITH TIME ZONE;
  ALTER TABLE IF EXISTS public.ca_candidates ADD COLUMN IF NOT EXISTS pre_joining_checklist JSONB DEFAULT '{}'::jsonb;
`;

export const mapCACandidate = (row) => {
  if (!row) return null;
  let documents = [];
  if (Array.isArray(row.documents)) {
    documents = row.documents;
  } else if (typeof row.documents === "string") {
    try {
      documents = JSON.parse(row.documents);
    } catch {
      documents = [];
    }
  } else if (row.documents) {
    documents = row.documents;
  }

  // Determine current round for candidate stage
  let effectiveStage = row.stage;
  const isExcludedStage = ["Offer", "Offer Acceptance", "Onboarding", "Hired", "Rejected", "Applied", "Screening", "Shortlisted"].includes(row.stage);

  if (row.latest_round_name && !["Offer", "Offer Acceptance", "Onboarding", "Hired", "Rejected"].includes(row.stage)) {
    effectiveStage = row.latest_round_name;
  } else if (!isExcludedStage && (row.stage === "Interview" || !row.stage || row.stage?.toLowerCase() === "interview")) {
    effectiveStage = row.latest_round_name || "Round 1: Technical interview";
  }

  const currentRound = row.latest_round_name || (effectiveStage?.toLowerCase().includes("round") ? effectiveStage : "Round 1: Technical interview");

  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    details: row.details,
    role: row.role,
    match: row.match,
    stage: effectiveStage,
    currentRound: currentRound,
    source: row.source,
    applied: row.applied,
    notes: row.notes || [],
    assessmentCount: row.assessment_count,
    email: row.email,
    phone: row.phone,
    experience: row.experience,
    location: row.location,
    skills: row.skills || [],
    establishmentId: row.establishment_id ? String(row.establishment_id) : "",
    establishmentName: row.establishment_name || "",
    expectedCtc: row.expected_ctc || "",
    highestQualification: row.highest_qualification || "",
    noticePeriod: row.notice_period || "",
    resumeUrl: row.resume_url || "",
    resumeName: row.resume_name || "",
    workflowStages: row.workflow_stages || [],
    documents: documents,
    preJoiningChecklist: row.pre_joining_checklist && typeof row.pre_joining_checklist === "object"
      ? row.pre_joining_checklist
      : (typeof row.pre_joining_checklist === "string" ? JSON.parse(row.pre_joining_checklist || "{}") : {}),
    companyId: row.created_by_company_id,
    rejectionEmailSentAt: row.rejection_email_sent_at || null,
    selectionEmailSentAt: row.selection_email_sent_at || null,
  };
};
