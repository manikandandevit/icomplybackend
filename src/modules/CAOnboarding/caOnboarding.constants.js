export const caOnboardingTemplateTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_onboarding_templates (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_template_key UNIQUE (company_id, template_key)
);
`;

export const caOnboardingJoinerProgressTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_onboarding_joiner_progress (
  id SERIAL PRIMARY KEY,
  company_id VARCHAR(100) NOT NULL,
  candidate_id VARCHAR(100) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_data JSONB DEFAULT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_company_candidate_progress UNIQUE (company_id, candidate_id)
);
ALTER TABLE public.ca_onboarding_joiner_progress 
ADD COLUMN IF NOT EXISTS candidate_data JSONB DEFAULT NULL;
`;

export const ESSENTIAL_INDIA_ONBOARDING_SECTIONS = [
  {
    id: "tmpl-doc-col",
    title: "Document Collection",
    items: [
      {
        id: "doc-1",
        title: "Aadhar Card",
        assignee: "Unassigned",
        daysOffset: -7,
        required: true,
      },
      {
        id: "doc-2",
        title: "PAN Card",
        assignee: "Unassigned",
        daysOffset: -7,
        required: true,
      },
      {
        id: "doc-3",
        title: "Passport Photo",
        assignee: "Unassigned",
        daysOffset: -7,
        required: true,
      },
      {
        id: "doc-4",
        title: "Educational Certificates",
        assignee: "Unassigned",
        daysOffset: -5,
        required: true,
      },
      {
        id: "doc-5",
        title: "Previous Company Documents",
        assignee: "Unassigned",
        daysOffset: -5,
        required: true,
      },
    ],
  },
  {
    id: "tmpl-pre-join",
    title: "Pre - Joining",
    items: [
      {
        id: "pj-1",
        title: "Document Verification",
        assignee: "Unassigned",
        daysOffset: -4,
        required: true,
      },
      {
        id: "pj-2",
        title: "Background Verification",
        assignee: "Unassigned",
        daysOffset: -3,
        required: true,
      },
      {
        id: "pj-3",
        title: "Joining Date Confirmation",
        assignee: "Unassigned",
        daysOffset: -2,
        required: true,
      },
      {
        id: "pj-4",
        title: "Offer Letter Release",
        assignee: "Unassigned",
        daysOffset: -1,
        required: true,
      },
    ],
  },
];

export const ESSENTIAL_SINGAPORE_ONBOARDING_SECTIONS = [
  {
    id: "sec-sg-doc",
    title: "STATUTORY & IMMIGRATION DOCUMENTS",
    items: [
      {
        id: "sg-task-doc-1",
        title: "NRIC (Citizen/PR) or FIN / IPA Pass Letter (Foreigner)",
        assignee: "Unassigned",
        daysOffset: -7,
        required: true,
      },
      {
        id: "sg-task-doc-2",
        title: "Signed Employment Contract (MOM Compliant)",
        assignee: "Unassigned",
        daysOffset: -3,
        required: true,
      },
      {
        id: "sg-task-doc-3",
        title: "Bank Account Details (GIRO Form for Payroll)",
        assignee: "Unassigned",
        daysOffset: 0,
        required: true,
      },
    ],
  },
  {
    id: "sec-sg-pre",
    title: "PRE - JOINING CHECKS",
    items: [
      {
        id: "sg-task-pre-1",
        title: "MOM Work Pass Verification & Medical Exam (if applicable)",
        assignee: "Unassigned",
        daysOffset: -2,
        required: true,
      },
      {
        id: "sg-task-pre-2",
        title: "Joining Date & Reporting Office Confirmation",
        assignee: "Unassigned",
        daysOffset: -1,
        required: true,
      },
    ],
  },
  {
    id: "sec-sg-day1",
    title: "DAY 1 ONBOARDING",
    items: [
      {
        id: "sg-task-day-1",
        title: "Company Laptop & Workplace Access Pass",
        assignee: "Unassigned",
        daysOffset: 0,
        required: true,
      },
      {
        id: "sg-task-day-2",
        title: "Company Email & HRMS Account Activation",
        assignee: "Unassigned",
        daysOffset: 0,
        required: true,
      },
      {
        id: "sg-task-day-3",
        title: "CPF Submission & Statutory Benefits Setup",
        assignee: "Unassigned",
        daysOffset: 1,
        required: true,
      },
    ],
  },
];
