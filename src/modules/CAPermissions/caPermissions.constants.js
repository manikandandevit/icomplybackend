export const NAV_ACTIONS = ["view", "add", "edit"];

export const HR_MASTER_NAV = {
  department: "department-master",
  designation: "designation",
  "employment-type": "employment-type",
  "marital-status": "marital-status",
  "shift-type": "shift-type",
  gender: "gender",
  "leave-category": "leave-category",
  "leave-types": "leave-types",
  "attendance-type": "attendance-type",
  "ot-type": "ot-type",
  "bank-account-type": "bank-account-type",
  "payment-method": "payment-method",
};

export const caDesignationPermissionsTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_designation_permissions (
  id SERIAL PRIMARY KEY,
  created_by_company_id INTEGER NOT NULL,
  designation_id INTEGER NOT NULL,
  nav_id TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_add BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_by_company_id, designation_id, nav_id)
);
`;

export const caDesignationPermissionsIndexSql = `
CREATE INDEX IF NOT EXISTS ca_desig_perm_company_idx
  ON public.ca_designation_permissions (created_by_company_id);
CREATE INDEX IF NOT EXISTS ca_desig_perm_designation_idx
  ON public.ca_designation_permissions (created_by_company_id, designation_id);
`;

export const mapPermission = (row) => ({
  designationId: String(row.designation_id),
  navId: row.nav_id,
  view: Boolean(row.can_view),
  add: Boolean(row.can_add),
  edit: Boolean(row.can_edit),
});
