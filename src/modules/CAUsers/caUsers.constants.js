export const caUsersTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer',
  company_access TEXT NOT NULL DEFAULT 'All Companies',
  status TEXT NOT NULL DEFAULT 'Active',
  password_hash TEXT,
  created_by_company_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caUsersAlterSql = `
ALTER TABLE public.ca_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
`;

export const caUsersIndexSql = `
CREATE INDEX IF NOT EXISTS ca_users_created_by_idx
  ON public.ca_users (created_by_company_id);
CREATE INDEX IF NOT EXISTS ca_users_email_idx
  ON public.ca_users (email);
`;

export const mapCAUser = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  initials:
    (row.name || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U",
  role: row.role || "Viewer",
  companyAccess: row.company_access || "All Companies",
  status: row.status === "Inactive" ? "Inactive" : "Active",
  hasPassword: Boolean(row.password_hash),
  createdAt: row.created_at,
});
