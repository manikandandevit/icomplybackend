export const caAttendanceTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_attendance (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL,
  establishment_name TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  employee_name TEXT NOT NULL,
  employee_code TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Present',
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,
  regularization_status TEXT,
  regularization_reason TEXT,
  regularization_reviewed_by TEXT,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caAttendanceIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_attendance_creator
  ON public.ca_attendance (created_by_company_id);
CREATE INDEX IF NOT EXISTS idx_ca_attendance_employee
  ON public.ca_attendance (created_by_company_id, employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ca_attendance_unique_date
  ON public.ca_attendance (employee_id, date);

ALTER TABLE public.ca_attendance
  ADD COLUMN IF NOT EXISTS requested_check_in TIMESTAMPTZ;

ALTER TABLE public.ca_attendance
  ADD COLUMN IF NOT EXISTS requested_check_out TIMESTAMPTZ;

ALTER TABLE public.ca_attendance
  ADD COLUMN IF NOT EXISTS regularization_reviewed_by TEXT;
`;

const clockMinutes = (value) => {
  const raw = String(value || "").trim();
  const hm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getHours() * 60 + parsed.getMinutes();
};

const stampMinutesFromDate = (dateStr, stamp) => {
  if (!stamp) return null;
  const [year, month, day] = String(dateStr || "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return clockMinutes(stamp);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  const time = new Date(stamp).getTime();
  if (Number.isNaN(time)) return null;
  return Math.round((time - start) / 60000);
};

export const mapCAAttendance = (row) => {
  if (!row) return null;
  const date = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date || "").slice(0, 10);
  const shiftStartTime = String(row.shift_start_time || "").trim();
  const shiftEndTime = String(row.shift_end_time || "").trim();
  const startMin = clockMinutes(shiftStartTime);
  const rawEndMin = clockMinutes(shiftEndTime);
  const inMin = stampMinutesFromDate(date, row.check_in);
  const outMin = stampMinutesFromDate(date, row.check_out);
  const endMin = startMin != null && rawEndMin != null && rawEndMin <= startMin ? rawEndMin + 24 * 60 : rawEndMin;
  const lateCheckIn = startMin != null && inMin != null && inMin > startMin;
  const earlyCheckOut = endMin != null && outMin != null && outMin < endMin;

  return {
    id: row.id,
    establishmentId: row.establishment_id,
    establishmentName: row.establishment_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    requestedCheckIn: row.requested_check_in,
    requestedCheckOut: row.requested_check_out,
    regularizationStatus: row.regularization_status,
    regularizationReason: row.regularization_reason,
    regularizationReviewedBy: row.regularization_reviewed_by,
    shiftStartTime: shiftStartTime || null,
    shiftEndTime: shiftEndTime || null,
    lateCheckIn,
    earlyCheckOut,
    createdByCompanyId: row.created_by_company_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
