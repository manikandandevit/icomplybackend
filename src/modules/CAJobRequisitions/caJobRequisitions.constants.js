export const caJobRequisitionsTableSql = `
  CREATE TABLE IF NOT EXISTS public.ca_job_requisitions (
    id SERIAL PRIMARY KEY,
    req_id VARCHAR(50) NOT NULL,
    position VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    hiring_manager VARCHAR(255),
    positions_count INTEGER NOT NULL DEFAULT 1,
    priority VARCHAR(50) NOT NULL,
    budget VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    approval_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    target_date VARCHAR(255),
    experience VARCHAR(255),
    skills JSONB DEFAULT '[]'::jsonb,
    created_by_company_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;

export const caJobRequisitionsIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_ca_job_req_company_id ON public.ca_job_requisitions(created_by_company_id);
`;

export const mapCAJobRequisition = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    reqId: row.req_id,
    position: row.position,
    department: row.department,
    location: row.location,
    type: row.type,
    hiringManager: row.hiring_manager,
    positionsCount: row.positions_count,
    priority: row.priority,
    budget: row.budget,
    status: row.status,
    approvalStatus: row.approval_status,
    targetDate: row.target_date,
    experience: row.experience,
    skills: row.skills || [],
    companyId: row.created_by_company_id,
    createdAt: row.created_at,
  };
};
