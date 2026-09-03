export const caEstablishmentsTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_establishments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Inactive',
  company_id INTEGER NOT NULL,
  company_source TEXT NOT NULL,
  company_name TEXT NOT NULL,
  country_id INTEGER,
  country_name TEXT,
  effective_date DATE,
  employee_count INTEGER NOT NULL DEFAULT 0,
  nature_of_work TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pin TEXT,
  pf_code TEXT,
  pf_status TEXT,
  esi_applicable BOOLEAN NOT NULL DEFAULT TRUE,
  esi_code TEXT,
  lwf_code TEXT,
  pt_reg_no TEXT,
  pt_state TEXT,
  contact_name TEXT,
  email TEXT,
  mobile TEXT,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caEstablishmentsIndexSql = `
CREATE INDEX IF NOT EXISTS ca_establishments_created_by_idx
  ON public.ca_establishments (created_by_company_id);
CREATE INDEX IF NOT EXISTS ca_establishments_company_idx
  ON public.ca_establishments (company_source, company_id);
`;

const dateFrom = (value) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
};

export const mapEstablishment = (row) => ({
  id: String(row.id),
  name: row.name,
  date: dateFrom(row.effective_date),
  type: row.type || "",
  companyId: String(row.company_id),
  companySource: row.company_source === "ca" ? "ca" : "parent",
  companyName: row.company_name || "",
  countryId: row.country_id ? String(row.country_id) : "",
  countryName: row.country_name || "",
  city: row.city || "",
  state: row.state || "",
  address: row.address || "",
  pin: row.pin || "",
  pfCode: row.pf_code || "",
  pfStatus: row.pf_status || "",
  esiApplicable: Boolean(row.esi_applicable),
  esiCode: row.esi_code || "",
  lwfCode: row.lwf_code || "",
  ptRegNo: row.pt_reg_no || "",
  ptState: row.pt_state || "",
  contactName: row.contact_name || "",
  email: row.email || "",
  mobile: row.mobile || "",
  natureOfWork: row.nature_of_work || "",
  employees: Number(row.employee_count) || 0,
  status: row.status === "Active" ? "Active" : "Inactive",
  createdByCompanyId: String(row.created_by_company_id),
});
