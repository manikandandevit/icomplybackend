export const MASTER_TYPES = [
  "department",
  "designation",
  "employment-type",
  "marital-status",
  "shift-type",
  "gender",
  "leave-category",
  "leave-types",
  "attendance-type",
  "ot-type",
  "bank-account-type",
  "payment-method",
];

export const MASTER_LABELS = {
  department: "Department",
  designation: "Designation",
  "employment-type": "Employment Type",
  "marital-status": "Marital Status",
  "shift-type": "Shift Type",
  gender: "Gender",
  "leave-category": "Leave Category",
  "leave-types": "Leave Type",
  "attendance-type": "Attendance Type",
  "ot-type": "OT Type",
  "bank-account-type": "Bank Account Type",
  "payment-method": "Payment Method",
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
  break_time TEXT,
  multiplier TEXT,
  days TEXT,
  code TEXT,
  country_id TEXT,
  country_name TEXT,
  eligible_gender_id INTEGER,
  min_hours TEXT,
  max_hours TEXT,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caHrMastersAlterSql = `
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS related_id INTEGER;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS days TEXT;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS break_time TEXT;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS country_id TEXT;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS country_name TEXT;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS eligible_gender_id INTEGER;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS min_hours TEXT;
ALTER TABLE public.ca_hr_masters ADD COLUMN IF NOT EXISTS max_hours TEXT;
`;

export const caHrMastersBackfillSql = `
UPDATE public.ca_hr_masters
SET days = CASE
  WHEN lower(name) LIKE '%casual%' OR lower(name) LIKE '%cl%' THEN '12'
  WHEN lower(name) LIKE '%sick%' OR lower(name) LIKE '%sl%' THEN '12'
  WHEN lower(name) LIKE '%earned%' OR lower(name) LIKE '%el%' OR lower(name) LIKE '%privilege%' THEN '15'
  WHEN lower(name) LIKE '%maternity%' THEN '180'
  WHEN lower(name) LIKE '%paternity%' THEN '15'
  WHEN lower(name) LIKE '%comp%' THEN '5'
  ELSE '12'
END,
updated_at = NOW()
WHERE master_type = 'leave-types'
  AND (days IS NULL OR btrim(days) = '');

UPDATE public.ca_hr_masters
SET code = CASE
  WHEN lower(name) LIKE '%marriage%' THEN 'ML'
  WHEN lower(name) LIKE '%casual%' THEN 'CL'
  WHEN lower(name) LIKE '%sick%' THEN 'SL'
  WHEN lower(name) LIKE '%earned%' OR lower(name) LIKE '%privilege%' THEN 'EL'
  WHEN lower(name) LIKE '%maternity%' THEN 'MTL'
  WHEN lower(name) LIKE '%paternity%' THEN 'PTL'
  WHEN lower(name) LIKE '%comp%' THEN 'CO'
  WHEN master_type = 'shift-type' AND lower(name) LIKE '%general%' THEN 'GS'
  WHEN master_type = 'shift-type' AND lower(name) LIKE '%night%' THEN 'NS'
  WHEN master_type = 'ot-type' AND lower(name) LIKE '%normal%' THEN 'NOT'
  WHEN master_type = 'ot-type' AND lower(name) LIKE '%double%' THEN 'DOT'
  ELSE upper(left(regexp_replace(coalesce(name, ''), '[^A-Za-z]', '', 'g'), 2)) || id::text
END,
updated_at = NOW()
WHERE master_type IN ('leave-types', 'shift-type', 'ot-type')
  AND (code IS NULL OR btrim(code) = '');
`;

export const caHrMastersIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_hr_masters_company_type
  ON public.ca_hr_masters (created_by_company_id, master_type);

DROP INDEX IF EXISTS uq_ca_hr_masters_company_type_name;
DROP INDEX IF EXISTS uq_ca_hr_masters_company_type_related_name;
DROP INDEX IF EXISTS uq_ca_hr_masters_company_type_code;
DROP INDEX IF EXISTS uq_ca_hr_masters_company_type_country_related_name;
DROP INDEX IF EXISTS uq_ca_hr_masters_company_type_country_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_hr_masters_company_type_country_related_name
  ON public.ca_hr_masters (
    created_by_company_id,
    master_type,
    COALESCE(country_id, 'all'),
    COALESCE(related_id, 0),
    lower(name)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_hr_masters_company_type_country_code
  ON public.ca_hr_masters (
    created_by_company_id,
    master_type,
    COALESCE(country_id, 'all'),
    lower(code)
  )
  WHERE code IS NOT NULL AND btrim(code) <> '';
`;

export const mapCAHrMaster = (row) => {
  const values = {
    name: row.name || "",
    countryId: row.country_id || "all",
    countryName: row.country_name || (row.country_id && row.country_id !== "all" ? "" : "All"),
  };

  if (row.master_type === "designation") {
    values.departmentId = row.related_id != null ? String(row.related_id) : "";
    values.departmentName = row.related_name || "";
  }

  if (row.master_type === "shift-type") {
    values.code = row.code || "";
    values.startTime = row.start_time || "";
    values.endTime = row.end_time || "";
    values.breakTime = row.break_time || row.total_hours || "";
  }

  if (row.master_type === "ot-type") {
    values.code = row.code || "";
    values.multiplier = row.multiplier || "";
    values.minHours = row.min_hours || "";
    values.maxHours = row.max_hours || "";
  }

  if (row.master_type === "leave-types") {
    values.code = row.code || "";
    values.days = row.days || "";
    values.eligibleGenderId = row.eligible_gender_id != null ? String(row.eligible_gender_id) : "all";
    values.eligibleGenderName = row.eligible_gender_name || (row.eligible_gender_id == null ? "All" : "");
    values.leaveCategoryId = row.related_id != null ? String(row.related_id) : "";
    values.leaveCategoryName = row.related_name || "";
  }

  return {
    id: String(row.id),
    masterType: row.master_type,
    values,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
};
