export const caOtRequestsTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_ot_requests (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL,
  establishment_name TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  work_date DATE,
  total_working_hours TEXT,
  ot_hours TEXT,
  ot_minutes INTEGER,
  hours NUMERIC,
  work_hours NUMERIC,
  reason TEXT,
  reject_reason TEXT,
  type TEXT NOT NULL DEFAULT 'Weekday Ot',
  status TEXT NOT NULL DEFAULT 'Pending',
  reporting_to_id INTEGER,
  approver_name TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  attendance_id INTEGER,
  source TEXT DEFAULT 'manual',
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caOtRequestsIndexSql = [
  `CREATE INDEX IF NOT EXISTS idx_ca_ot_requests_company ON public.ca_ot_requests (created_by_company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ca_ot_requests_employee ON public.ca_ot_requests (created_by_company_id, employee_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ca_ot_requests_date ON public.ca_ot_requests (created_by_company_id, date);`,
];

export const mapCAOtRequest = (row) => {
  if (!row) return null;
  const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || "").slice(0, 10);
  const workDateStr = row.work_date instanceof Date ? row.work_date.toISOString().slice(0, 10) : String(row.work_date || dateStr).slice(0, 10);

  return {
    id: String(row.id),
    establishmentId: String(row.establishment_id || ""),
    establishmentName: row.establishment_name || "",
    employeeId: String(row.employee_id || ""),
    employeeName: row.employee_name || "",
    employeeCode: row.employee_code || "",
    date: dateStr,
    workDate: workDateStr,
    totalWorkingHours: row.total_working_hours || "",
    otHours: row.ot_hours || (row.hours != null ? String(row.hours) : "0"),
    otMinutes: Number(row.ot_minutes) || 0,
    hours: Number(row.hours) || (Number(row.ot_hours) || 0),
    workHours: Number(row.work_hours) || 0,
    reason: row.reason || "",
    rejectReason: row.reject_reason || "",
    type: row.type || "Weekday Ot",
    status: row.status || "Pending",
    reportingToId: row.reporting_to_id != null ? String(row.reporting_to_id) : null,
    approverName: row.approver_name || "",
    reviewedByName: row.reviewed_by_name || "",
    reviewedAt: row.reviewed_at || null,
    attendanceId: row.attendance_id != null ? String(row.attendance_id) : null,
    source: row.source || "manual",
    createdByCompanyId: Number(row.created_by_company_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};
