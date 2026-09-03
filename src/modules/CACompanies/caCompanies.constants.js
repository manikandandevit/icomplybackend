export const caCompaniesTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_companies (
  id SERIAL PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  pan TEXT NOT NULL,
  gstin TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  pin TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  mobile TEXT,
  logo_url TEXT,
  initials TEXT,
  accent TEXT NOT NULL DEFAULT '#0c2340',
  status TEXT NOT NULL DEFAULT 'Inactive',
  created_by_company_id INTEGER NOT NULL,
  created_by_company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caCompaniesAlterSql = `
ALTER TABLE public.ca_companies ADD COLUMN IF NOT EXISTS address_country_id INTEGER;
ALTER TABLE public.ca_companies ALTER COLUMN status SET DEFAULT 'Inactive';
`;

export const caCompaniesIndexSql = `
CREATE INDEX IF NOT EXISTS ca_companies_created_by_idx
  ON public.ca_companies (created_by_company_id);
CREATE UNIQUE INDEX IF NOT EXISTS ca_companies_pan_lower_idx
  ON public.ca_companies (lower(pan));
`;

export const initialsFrom = (legalName, tradeName) => {
  const source = String(tradeName || legalName || "").trim();

  if (!source) {
    return "CO";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const mapCACompany = (row) => ({
  id: String(row.id),
  name: row.trade_name || row.legal_name,
  legalName: row.legal_name,
  tradeName: row.trade_name,
  pan: row.pan,
  gstin: row.gstin || "",
  street: row.street || "",
  city: row.city || "",
  state: row.state || "",
  pin: row.pin || "",
  addressCountryId: row.address_country_id ? String(row.address_country_id) : "",
  contactName: row.contact_name || "",
  email: row.email,
  mobile: row.mobile || "",
  initials: row.initials || "CO",
  accent: row.accent || "#0c2340",
  status: row.status === "Inactive" ? "Inactive" : "Active",
  logoUrl: /^https?:\/\//i.test(String(row.logo_url || ""))
    ? row.logo_url
    : row.logo_url
      ? `/ca-companies/${row.id}/logo`
      : null,
  createdByCompanyId: String(row.created_by_company_id),
  createdByCompanyName: row.created_by_company_name || "",
  establishments: 0,
  users: 0,
});
