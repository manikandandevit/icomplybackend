export const FREE_TRIAL_DAYS = 15;
export const STANDARD_PRICE_PER_USER = 99;

export const companiesAlterSql = `
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS password_hash TEXT;
`;

export const companiesTableSql = `
CREATE TABLE IF NOT EXISTS public.companies (
  id SERIAL PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  pan TEXT NOT NULL,
  gstin TEXT,
  countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  uen TEXT,
  ssm TEXT,
  dbd TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  pin TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  mobile TEXT,
  password_hash TEXT,
  logo_url TEXT,
  initials TEXT,
  accent TEXT NOT NULL DEFAULT '#0c2340',
  status TEXT NOT NULL DEFAULT 'Inactive',
  plan TEXT NOT NULL DEFAULT 'Free Trial',
  users INTEGER NOT NULL DEFAULT 0,
  establishments INTEGER NOT NULL DEFAULT 1,
  monthly_value INTEGER,
  trial_days_left INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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

export const mapCompany = (row) => ({
  id: String(row.id),
  name: row.trade_name || row.legal_name,
  legalName: row.legal_name,
  tradeName: row.trade_name,
  users: row.users,
  plan: row.plan === "Standard" ? "Standard" : "Free Trial",
  initials: row.initials || "CO",
  accent: row.accent || "#0c2340",
  city: row.city || "",
  state: row.state || "",
  establishments: row.establishments,
  monthlyValue: row.monthly_value,
  status: row.status,
  trialDaysLeft: row.trial_days_left,
  pan: row.pan,
  gstin: row.gstin || "",
  email: row.email,
  mobile: row.mobile || "",
  contactName: row.contact_name || "",
  street: row.street || "",
  pin: row.pin || "",
  countries: Array.isArray(row.countries) ? row.countries : [],
  uen: row.uen || "",
  ssm: row.ssm || "",
  dbd: row.dbd || "",
  logoUrl: row.logo_url ? `/companies/${row.id}/logo` : null,
});
