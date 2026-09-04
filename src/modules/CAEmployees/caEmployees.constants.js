export const caEmployeesTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_employees (
  id SERIAL PRIMARY KEY,
  employee_code TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  join_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  company_id INTEGER NOT NULL,
  company_source TEXT NOT NULL,
  company_name TEXT NOT NULL,
  establishment_id INTEGER NOT NULL,
  establishment_name TEXT NOT NULL,
  department_id INTEGER NOT NULL,
  department_name TEXT NOT NULL,
  designation_id INTEGER NOT NULL,
  designation_name TEXT NOT NULL,
  employment_type_id INTEGER NOT NULL,
  employment_type_name TEXT NOT NULL,
  shift_type_id INTEGER,
  shift_type_name TEXT,
  ot_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  ot_type_id INTEGER,
  ot_type_name TEXT,
  gender_id INTEGER,
  gender_name TEXT,
  marital_status_id INTEGER,
  marital_status_name TEXT,
  bank_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  password_hash TEXT,
  must_reset_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caEmployeesIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_employees_creator
  ON public.ca_employees (created_by_company_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_employees_code_creator
  ON public.ca_employees (created_by_company_id, lower(employee_code));

ALTER TABLE public.ca_employees
  ADD COLUMN IF NOT EXISTS bank_details JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ca_employees
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ca_employees
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.ca_employees
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.ca_employees
  ALTER COLUMN shift_type_id DROP NOT NULL;

ALTER TABLE public.ca_employees
  ALTER COLUMN shift_type_name DROP NOT NULL;
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

const mapBanks = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => ({
      id: String(item?.id || `bank-${index + 1}`),
      bankAccountTypeId: String(item?.bankAccountTypeId || "").trim(),
      bankAccountTypeName: String(item?.bankAccountTypeName || "").trim(),
      accountNumber: String(item?.accountNumber || "").trim(),
      ifscCode: String(item?.ifscCode || "").trim(),
      bankNameBranch: String(item?.bankNameBranch || "").trim(),
    }))
    .filter((item) => item.accountNumber || item.ifscCode || item.bankNameBranch);
};

const mapDetails = (raw) => {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    countryId: String(d.countryId || "").trim(),
    dateOfBirth: dateFrom(d.dateOfBirth),
    fatherHusbandName: String(d.fatherHusbandName || "").trim(),
    address: String(d.address || "").trim(),
    state: String(d.state || "").trim(),
    city: String(d.city || "").trim(),
    pinCode: String(d.pinCode || "").trim(),
    childrenCount: String(d.childrenCount ?? "").trim(),
    reportingToId: String(d.reportingToId || "").trim(),
    reportingToName: String(d.reportingToName || "").trim(),
    emergencyName: String(d.emergencyName || "").trim(),
    emergencyRelationship: String(d.emergencyRelationship || "").trim(),
    emergencyPhone: String(d.emergencyPhone || "").trim(),
    emergencyAltPhone: String(d.emergencyAltPhone || "").trim(),
    emergencyAddress: String(d.emergencyAddress || "").trim(),
    emergencyState: String(d.emergencyState || "").trim(),
    emergencyCity: String(d.emergencyCity || "").trim(),
    emergencyPinCode: String(d.emergencyPinCode || "").trim(),
    shiftNameCode: String(d.shiftNameCode || "").trim(),
    weekOffDay: String(d.weekOffDay || "").trim(),
    shiftStartTime: String(d.shiftStartTime || "").trim(),
    shiftEndTime: String(d.shiftEndTime || "").trim(),
    breakTime: String(d.breakTime || "").trim(),
  };
};

export const mapCAEmployee = (row) => ({
  id: String(row.id),
  employeeCode: row.employee_code || "",
  name: row.name || "",
  email: row.email || "",
  mobile: row.mobile || "",
  joinDate: dateFrom(row.join_date),
  status: row.status === "Inactive" ? "Inactive" : "Active",
  companyId: String(row.company_id),
  companySource: row.company_source === "ca" ? "ca" : "parent",
  companyName: row.company_name || "",
  establishmentId: String(row.establishment_id),
  establishmentName: row.establishment_name || "",
  departmentId: String(row.department_id),
  departmentName: row.department_name || "",
  designationId: String(row.designation_id),
  designationName: row.designation_name || "",
  employmentTypeId: String(row.employment_type_id),
  employmentTypeName: row.employment_type_name || "",
  shiftTypeId: row.shift_type_id != null ? String(row.shift_type_id) : "",
  shiftTypeName: row.shift_type_name || "",
  otApplicable: Boolean(row.ot_applicable),
  otTypeId: row.ot_type_id != null ? String(row.ot_type_id) : "",
  otTypeName: row.ot_type_name || "",
  genderId: row.gender_id != null ? String(row.gender_id) : "",
  genderName: row.gender_name || "",
  maritalStatusId: row.marital_status_id != null ? String(row.marital_status_id) : "",
  maritalStatusName: row.marital_status_name || "",
  bankDetails: mapBanks(row.bank_details),
  details: mapDetails(row.details),
  initials: String(row.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join(""),
});
