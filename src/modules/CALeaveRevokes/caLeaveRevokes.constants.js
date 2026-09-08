export const caLeaveRevokesTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_leave_revokes (
  id SERIAL PRIMARY KEY,
  leave_request_id INTEGER NOT NULL,
  establishment_id INTEGER NOT NULL,
  establishment_name TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL DEFAULT '',
  leave_type_id INTEGER NOT NULL,
  leave_type_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  reject_reason TEXT,
  approver_name TEXT,
  reviewed_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caLeaveRevokesIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_leave_revokes_creator
  ON public.ca_leave_revokes (created_by_company_id);
CREATE INDEX IF NOT EXISTS idx_ca_leave_revokes_leave
  ON public.ca_leave_revokes (leave_request_id);

DROP INDEX IF EXISTS idx_ca_leave_revokes_pending_leave;

ALTER TABLE public.ca_leave_revokes
  ADD COLUMN IF NOT EXISTS reporting_to_id INTEGER;

ALTER TABLE public.ca_leave_revokes
  ADD COLUMN IF NOT EXISTS session TEXT NOT NULL DEFAULT 'full';

ALTER TABLE public.ca_leave_revokes
  ADD COLUMN IF NOT EXISTS attachment_key TEXT;

ALTER TABLE public.ca_leave_revokes
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE public.ca_leave_revokes
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

ALTER TABLE public.ca_leave_revokes
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT;

CREATE INDEX IF NOT EXISTS idx_ca_leave_revokes_reporting
  ON public.ca_leave_revokes (created_by_company_id, reporting_to_id);

UPDATE public.ca_leave_revokes r
SET reporting_to_id = CAST(e.details->>'reportingToId' AS INTEGER)
FROM public.ca_employees e
WHERE r.reporting_to_id IS NULL
  AND r.employee_id = e.id
  AND r.created_by_company_id = e.created_by_company_id
  AND e.details->>'reportingToId' ~ '^[0-9]+$';
`;

const dateFrom = (value) => {
  if (!value) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
};

export const mapCALeaveRevoke = (row) => ({
  id: String(row.id),
  leaveRequestId: String(row.leave_request_id),
  establishmentId: String(row.establishment_id),
  establishmentName: row.establishment_name || "",
  employeeId: String(row.employee_id),
  employeeName: row.employee_name || "",
  employeeCode: row.employee_code || "",
  leaveTypeId: String(row.leave_type_id),
  leaveTypeName: row.leave_type_name || "",
  startDate: dateFrom(row.start_date),
  endDate: dateFrom(row.end_date),
  days: Number(row.days) || 0,
  reason: row.reason || "",
  rejectReason: row.reject_reason || "",
  approverName: row.approver_name || "",
  reviewedByName: row.reviewed_by_name || "",
  reportingToId: row.reporting_to_id != null ? String(row.reporting_to_id) : "",
  session: row.session === "first-half" || row.session === "second-half" ? row.session : "full",
  attachmentKey: row.attachment_key || "",
  attachmentUrl: row.attachment_url || "",
  attachmentName: row.attachment_name || "",
  attachmentMime: row.attachment_mime || "",
  status: row.status || "Pending",
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
});
