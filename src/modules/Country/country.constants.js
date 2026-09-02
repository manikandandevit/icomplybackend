export const countryTableSql = `
CREATE TABLE IF NOT EXISTS public.country (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const countryIndexSql = `
CREATE UNIQUE INDEX IF NOT EXISTS country_name_lower_idx ON public.country (lower(name));
`;

export const mapCountry = (row) => ({
  id: String(row.id),
  name: row.name,
  createdAt: row.created_at,
});
