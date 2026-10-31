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
  "holiday-type": "holiday-type",
  "attendance-type": "attendance-type",
  "ot-type": "ot-type",
  "bank-account-type": "bank-account-type",
  "payment-method": "payment-method",
  additional: "additional",
};

export const MODULE_NAV_MAP = {
  organisation: ["companies", "establishments", "users-roles"],
  "ai-hiring": ["hirepilot", "pilot-setting"],
  hr: [
    "department-master",
    "designation",
    "employment-type",
    "marital-status",
    "shift-type",
    "gender",
    "leave-category",
    "leave-types",
    "holiday-type",
    "attendance-type",
    "ot-type",
    "bank-account-type",
    "payment-method",
    "additional",
    "permission",
    "employee-master",
    "leave",
    "holiday",
    "attendance",
    "ot",
    "shift",
    "leave-overview",
    "leave-tab-types",
    "leave-requests",
    "leave-apply",
    "leave-balance",
    "revoke",
    "revoke-overview",
    "revoke-apply",
    "revoke-requests",
    "daily",
    "requests",
  ],
  "talent-acquisition": [
    "recruitment-dashboard",
    "job-requisitions",
    "job-openings",
    "candidates",
    "interviews-offers",
  ],
  "life-cycle-onboarding": [
    "hr-onboarding",
    "plans-30-60-90",
    "offboarding",
    "exit-process",
    "alumni",
  ],
  payroll: [
    "statutory-config",
    "payroll-master",
    "payroll-processing",
    "payslip",
    "bulk-import",
  ],
  india: ["india-overview", "addition-field"],
  global: ["sg-overview", "my-overview", "th-overview", "tax-calendar"],
  management: [
    "unified-register",
    "compliance-calendar",
    "documents",
    "reports",
    "audit-log",
    "settings",
  ],
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
  scope VARCHAR(32) NOT NULL DEFAULT 'self',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_by_company_id, designation_id, nav_id)
);
`;

export const caDesignationPermissionsAlterSql = `
ALTER TABLE public.ca_designation_permissions ADD COLUMN IF NOT EXISTS scope VARCHAR(32) NOT NULL DEFAULT 'self';
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
  scope: row.scope || "self",
});
