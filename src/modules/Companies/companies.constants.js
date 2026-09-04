export const FREE_TRIAL_DAYS = 15;
export const STANDARD_PRICE_PER_USER = 99;

export const companiesAlterSql = `
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS billing_country_id INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS billing_currency_code TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS billing_currency_symbol TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country_users JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS onboard_amount NUMERIC(14, 2);
ALTER TABLE public.companies ALTER COLUMN monthly_value TYPE NUMERIC(14, 2);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_country_id INTEGER;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
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
  trial_started_at TIMESTAMPTZ,
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

export const trialDaysRemaining = (row) => {
  if (row.plan === "Standard") return null;
  const start = row.trial_started_at || row.created_at;
  if (!start) return row.trial_days_left ?? FREE_TRIAL_DAYS;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return row.trial_days_left ?? FREE_TRIAL_DAYS;
  const elapsedDays = Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, FREE_TRIAL_DAYS - elapsedDays);
};

export const isFreeTrialExpired = (row) => {
  if (row.plan === "Standard") return false;
  const left = trialDaysRemaining(row);
  return left != null && left <= 0;
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
  monthlyValue: row.monthly_value == null ? null : Number(row.monthly_value),
  status: row.status,
  trialDaysLeft: trialDaysRemaining(row),
  trialStartedAt: row.trial_started_at ? new Date(row.trial_started_at).toISOString() : null,
  pan: row.pan,
  gstin: row.gstin || "",
  email: row.email,
  mobile: row.mobile || "",
  contactName: row.contact_name || "",
  street: row.street || "",
  pin: row.pin || "",
  addressCountryId: row.address_country_id ? String(row.address_country_id) : "",
  countries: Array.isArray(row.countries) ? row.countries.map((item) => String(item)) : [],
  countryUsers:
    row.country_users && typeof row.country_users === "object" && !Array.isArray(row.country_users)
      ? Object.fromEntries(
          Object.entries(row.country_users).map(([id, count]) => [String(id), Number(count) || 0]),
        )
      : {},
  billingCountryId: row.billing_country_id ? String(row.billing_country_id) : "",
  billingCurrencyCode: row.billing_currency_code || "",
  billingCurrencySymbol: row.billing_currency_symbol || "",
  onboardAmount: row.onboard_amount == null ? null : Number(row.onboard_amount),
  uen: row.uen || "",
  ssm: row.ssm || "",
  dbd: row.dbd || "",
  logoUrl: row.logo_url ? `/companies/${row.id}/logo` : null,
});
