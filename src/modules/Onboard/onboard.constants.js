export const onboardTableSql = `
CREATE TABLE IF NOT EXISTS public.onboard (
  id SERIAL PRIMARY KEY,
  country_id INTEGER NOT NULL REFERENCES public.country(id),
  amount NUMERIC(14, 2) NOT NULL,
  currency_code TEXT,
  currency_symbol TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const onboardIndexSql = `
CREATE UNIQUE INDEX IF NOT EXISTS onboard_country_unique ON public.onboard (country_id);
`;

export const onboardAlterSql = `
ALTER TABLE public.onboard ADD COLUMN IF NOT EXISTS currency_code TEXT;
ALTER TABLE public.onboard ADD COLUMN IF NOT EXISTS currency_symbol TEXT;
`;

export const mapOnboard = (row) => ({
  id: String(row.id),
  countryId: String(row.country_id),
  countryName: row.country_name,
  amount: Number(row.amount),
  currencyCode: row.currency_code || "",
  currencySymbol: row.currency_symbol || "",
  createdAt: row.created_at,
});
