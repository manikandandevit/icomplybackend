export const NAV_ACTIONS = ["view", "add", "edit"];

export const HR_MASTER_NAV = {
  department: "department-master",
  designation: "designation",
  "employment-type": "employment-type",
  "marital-status": "marital-status",
  "shift-type": "shift-type",
  gender: "gender",
  religion: "religion",
  "leave-category": "leave-category",
  "leave-types": "leave-types",
  "holiday-type": "holiday-type",
  "attendance-type": "attendance-type",
  "ot-type": "ot-type",
  "bank-account-type": "bank-account-type",
  "payment-method": "payment-method",
  "notice-period": "notice-period",
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
    "religion",
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
    "onboarding",
    "onboarding-dashboard",
    "onboarding-checklist",
    "onboarding-pending-tasks",
    "offboarding",
    "offboarding-dashboard",
    "offboarding-checklist",
    "offboarding-pending-tasks",
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
    "apply",
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
    "onboarding",
    "onboarding-dashboard",
    "onboarding-checklist",
    "onboarding-pending-tasks",
    "hr-onboarding",
    "plans-30-60-90",
    "offboarding",
    "offboarding-dashboard",
    "offboarding-checklist",
    "offboarding-pending-tasks",
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
  establishment_id INTEGER NOT NULL DEFAULT 0
);
`;

export const caDesignationPermissionsAlterSql = `
ALTER TABLE public.ca_designation_permissions ADD COLUMN IF NOT EXISTS scope VARCHAR(32) NOT NULL DEFAULT 'self';
ALTER TABLE public.ca_designation_permissions ADD COLUMN IF NOT EXISTS establishment_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ca_designation_permissions
  DROP CONSTRAINT IF EXISTS ca_designation_permissions_created_by_company_id_designation_id_nav_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ca_desig_perm_est_unique
  ON public.ca_designation_permissions (created_by_company_id, establishment_id, designation_id, nav_id);
`;

/** establishment_id 0 = default for every establishment ("all"). */
export const ALL_ESTABLISHMENTS = 0;

export const caDesignationPermissionsIndexSql = `
CREATE INDEX IF NOT EXISTS ca_desig_perm_company_idx
  ON public.ca_designation_permissions (created_by_company_id);
CREATE INDEX IF NOT EXISTS ca_desig_perm_designation_idx
  ON public.ca_designation_permissions (created_by_company_id, designation_id);
`;

export const mapPermission = (row) => ({
  establishmentId: Number(row.establishment_id) > 0 ? String(row.establishment_id) : "all",
  designationId: String(row.designation_id),
  navId: row.nav_id,
  view: Boolean(row.can_view),
  add: Boolean(row.can_add),
  edit: Boolean(row.can_edit),
  scope: row.scope || "self",
});
