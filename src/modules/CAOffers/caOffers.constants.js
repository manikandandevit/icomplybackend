export const caOffersTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_offers (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_company_id INTEGER NOT NULL,
    candidate_id INTEGER,
    candidate_name VARCHAR(255),
    role VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending Acceptance',
    ctc VARCHAR(100) DEFAULT '₹96,000/mo',
    joining_bonus VARCHAR(100) DEFAULT '₹1,20,000',
    joining_date VARCHAR(100),
    sent_on VARCHAR(100),
    deadline VARCHAR(100),
    location VARCHAR(255),
    hiring_manager VARCHAR(255),
    approval_status VARCHAR(50) DEFAULT 'Draft',
    documents JSONB DEFAULT '[]'::jsonb
  );
`;

export const mapCAOffer = (row) => {
  if (!row) return null;

  let skills = [];
  if (Array.isArray(row.skills)) {
    skills = row.skills;
  } else if (typeof row.skills === "string") {
    try {
      skills = JSON.parse(row.skills);
    } catch {
      skills = [];
    }
  } else if (row.skills) {
    skills = row.skills;
  }

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

  const candidateName = row.candidate || row.candidate_name || null;

  return {
    id: row.id,
    candidateId: row.candidate_id,
    candidate: candidateName,
    candidateName: candidateName,
    role: row.role,
    status: row.status,
    approvalStatus: row.approval_status || row.approvalStatus || "Draft",
    ctc: row.ctc,
    joiningBonus: row.joining_bonus,
    joiningDate: row.joining_date,
    sentOn: row.sent_on,
    deadline: row.deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyId: row.created_by_company_id,
    email: row.email || null,
    phone: row.phone || null,
    location: row.location || null,
    hiringManager: row.hiring_manager || row.hiringManager || null,
    experience: row.experience || null,
    skills,
    documents,
    reqId: row.req_id || row.reqId || null,
    jobId: row.job_id || row.jobId || null,
    documentName: row.document_name || `Offer_Letter_${(candidateName || "Candidate").replace(/\s+/g, "_")}.pdf`,
    documentUrl: row.document_url || (row.id ? `/api/ca-offers/${row.id}/pdf` : null),
  };
};
