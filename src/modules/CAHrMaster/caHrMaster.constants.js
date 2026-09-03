export const MASTER_TYPES = [
  "department",
  "designation",
  "employment-type",
  "marital-status",
  "shift-type",
  "gender",
  "leave-types",
  "attendance-type",
  "ot-type",
];

export const MASTER_LABELS = {
  department: "Department",
  designation: "Designation",
  "employment-type": "Employment Type",
  "marital-status": "Marital Status",
  "shift-type": "Shift Type",
  gender: "Gender",
  "leave-types": "Leave Type",
  "attendance-type": "Attendance Type",
  "ot-type": "OT Type",
};

export const caHrMastersTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_hr_masters (
  id SERIAL PRIMARY KEY,
  master_type TEXT NOT NULL,
  name TEXT NOT NULL,
  related_id INTEGER,
  start_time TEXT,
  end_time TEXT,
  total_hours TEXT,
  multiplier TEXT,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caHrMastersAlterSql = `
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS related_id INTEGER;
`;

export const caHrMastersIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_hr_masters_company_type
  ON public.ca_hr_masters (created_by_company_id, master_type);

DROP INDEX IF EXISTS uq_ca_hr_masters_company_type_name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_hr_masters_company_type_related_name
  ON public.ca_hr_masters (created_by_company_id, master_type, COALESCE(related_id, 0), lower(name));
`;

export const mapCAHrMaster = (row) => {
  const values = { name: row.name || "" };

  if (row.master_type === "designation") {
    values.departmentId = row.related_id != null ? String(row.related_id) : "";
    values.departmentName = row.department_name || "";
  }

  if (row.master_type === "shift-type") {
    values.startTime = row.start_time || "";
    values.endTime = row.end_time || "";
    values.totalHours = row.total_hours || "";
  }

  if (row.master_type === "ot-type") {
    values.multiplier = row.multiplier || "";
  }

  return {
    id: String(row.id),
    masterType: row.master_type,
    values,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
};
