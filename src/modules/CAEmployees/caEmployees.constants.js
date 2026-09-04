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
  shift_type_id INTEGER NOT NULL,
  shift_type_name TEXT NOT NULL,
  ot_applicable BOOLEAN NOT NULL DEFAULT FALSE,
  ot_type_id INTEGER,
  ot_type_name TEXT,
  gender_id INTEGER,
  gender_name TEXT,
  marital_status_id INTEGER,
  marital_status_name TEXT,
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
  shiftTypeId: String(row.shift_type_id),
  shiftTypeName: row.shift_type_name || "",
  otApplicable: Boolean(row.ot_applicable),
  otTypeId: row.ot_type_id != null ? String(row.ot_type_id) : "",
  otTypeName: row.ot_type_name || "",
  genderId: row.gender_id != null ? String(row.gender_id) : "",
  genderName: row.gender_name || "",
  maritalStatusId: row.marital_status_id != null ? String(row.marital_status_id) : "",
  maritalStatusName: row.marital_status_name || "",
  initials: String(row.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join(""),
});
