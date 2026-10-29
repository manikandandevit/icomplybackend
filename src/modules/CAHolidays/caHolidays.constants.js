import { formatDateToIST } from "../../core/utils/date.js";

export const caHolidaysTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_holidays (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  end_date DATE,
  holiday_type_id INTEGER NOT NULL,
  holiday_type_name TEXT NOT NULL,
  establishment_id INTEGER,
  establishment_name TEXT NOT NULL DEFAULT 'All',
  country_id TEXT NOT NULL DEFAULT 'all',
  country_name TEXT NOT NULL DEFAULT 'All',
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caHolidaysIndexSql = `
ALTER TABLE public.ca_holidays
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE public.ca_holidays
  ADD COLUMN IF NOT EXISTS establishment_id INTEGER;

ALTER TABLE public.ca_holidays
  ADD COLUMN IF NOT EXISTS establishment_name TEXT DEFAULT 'All';

UPDATE public.ca_holidays
SET end_date = holiday_date
WHERE end_date IS NULL;

UPDATE public.ca_holidays
SET establishment_name = 'All'
WHERE establishment_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca_holidays_company_date
  ON public.ca_holidays (created_by_company_id, holiday_date);

CREATE INDEX IF NOT EXISTS idx_ca_holidays_company_est
  ON public.ca_holidays (created_by_company_id, establishment_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_holidays_company_date_est_name
  ON public.ca_holidays (
    created_by_company_id,
    holiday_date,
    COALESCE(establishment_id, 0),
    lower(name)
  );
`;

const dateFrom = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : formatDateToIST(value);
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return formatDateToIST(value);
};

const countDays = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
};

export const mapCAHoliday = (row) => {
  const startDate = dateFrom(row.holiday_date);
  const endDate = dateFrom(row.end_date) || startDate;
  const establishmentId = row.establishment_id != null ? String(row.establishment_id) : "all";
  const establishmentName = row.establishment_name || (row.establishment_id ? "" : "All");
  return {
    id: String(row.id),
    name: row.name || "",
    date: startDate,
    startDate,
    endDate,
    days: countDays(startDate, endDate),
    holidayTypeId: String(row.holiday_type_id),
    holidayTypeName: row.holiday_type_name || "",
    establishmentId,
    establishmentName,
    countryId: row.country_id || "all",
    countryName: row.country_name || (row.country_id && row.country_id !== "all" ? "" : "All"),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
};
