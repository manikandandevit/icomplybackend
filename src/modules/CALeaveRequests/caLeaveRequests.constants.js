export const caLeaveRequestsTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_leave_requests (
  id SERIAL PRIMARY KEY,
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
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caLeaveRequestsIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_leave_requests_creator
  ON public.ca_leave_requests (created_by_company_id);
CREATE INDEX IF NOT EXISTS idx_ca_leave_requests_employee
  ON public.ca_leave_requests (created_by_company_id, employee_id);

ALTER TABLE public.ca_leave_requests
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;

ALTER TABLE public.ca_leave_requests
  ADD COLUMN IF NOT EXISTS approver_name TEXT;

ALTER TABLE public.ca_leave_requests
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT;
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

export const mapCALeaveRequest = (row) => ({
  id: String(row.id),
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
  status: row.status || "Pending",
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
});
