export const caNotificationSettingsTableSql = `
CREATE TABLE IF NOT EXISTS public.ca_notification_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE,
  channels JSONB NOT NULL DEFAULT '{"email": false, "whatsapp": true}',
  notifications JSONB NOT NULL DEFAULT '{}',
  templates JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const caNotificationSettingsIndexSql = `
CREATE INDEX IF NOT EXISTS idx_ca_notification_settings_company
  ON public.ca_notification_settings (company_id);
`;

export const DEFAULT_NOTIFICATION_MODULES = [
  {
    id: "recruitment-job-creation",
    title: "A. Recruitment and job creation",
    subtitle: "Requisitions, approvals, closing reminders and closures",
    icon: "briefcase",
    items: [
      {
        id: "REC-001",
        code: "REC-001",
        title: "New job created",
        description: "When a new job is created and pending approval",
        recipient: "HR / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Approval needed: {{job_title}} requisition",
          body: "Hi {{recipient_name}},\n\nA job requisition for {{job_title}} is waiting for your approval. Please review and respond in iComply.\n\nRegards,\n{{hr_contact}}\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Hi {{recipient_name}}, the requisition for *{{job_title}}* needs your approval. Open iComply to review.",
        },
      },
      {
        id: "REC-002",
        code: "REC-002",
        title: "Job approved",
        description: "When a job requisition is approved and ready to publish",
        recipient: "HR / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Job Requisition Approved: {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe job requisition '{{job_title}}' has been approved and is now ready for publication.\n\nYou can publish this role on job boards and candidate portals.",
        },
        whatsAppTemplate: {
          body: "Job Approved: *{{job_title}}* is approved and ready to publish. Publish here: {{action_url}}",
        },
      },
      {
        id: "REC-003",
        code: "REC-003",
        title: "Job rejected",
        description: "When a job requisition is rejected by approver",
        recipient: "HR / Requester",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Job Requisition Rejected: {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe job requisition '{{job_title}}' has been rejected.\n\nReview comments: {{rejection_reason}}\nPlease revise and resubmit if necessary.",
        },
        whatsAppTemplate: {
          body: "Job Rejected: Requisition for *{{job_title}}* was rejected. Reason: {{rejection_reason}}. Review: {{action_url}}",
        },
      },
      {
        id: "REC-004",
        code: "REC-004",
        title: "Job closing reminder",
        description: "Reminder before the job posting closing date",
        recipient: "HR / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Job Posting Closing Soon - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe job posting for '{{job_title}}' is approaching its scheduled closing date on {{closing_date}}.\n\nPlease review pending applications and shortlist candidates.",
        },
        whatsAppTemplate: {
          body: "Closing Reminder: Job posting *{{job_title}}* closes on {{closing_date}}. Review pipeline: {{action_url}}",
        },
      },
      {
        id: "REC-005",
        code: "REC-005",
        title: "Job expired / closed",
        description: "When a job posting expires or is closed",
        recipient: "HR / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Job Posting Closed: {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe job posting for '{{job_title}}' has closed.\n\nNo further applications will be accepted unless reopened.",
        },
        whatsAppTemplate: {
          body: "Job Closed: Posting for *{{job_title}}* has closed. No further applications will be accepted unless reopened. View summary: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "candidate-application-screening",
    title: "B. Candidate application and screening",
    subtitle: "Candidate applications, screening, shortlisting, rejections and duplicates",
    icon: "user-check",
    items: [
      {
        id: "CAN-001",
        code: "CAN-001",
        title: "New application received",
        description: "When a new candidate applies for the job",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "New Application: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nA new application has been submitted by {{candidate_name}} for the position of {{job_title}}.\n\nPlease review the candidate profile and resume in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "New Application: *{{candidate_name}}* applied for *{{job_title}}*. Review application: {{action_url}}",
        },
      },
      {
        id: "CAN-002",
        code: "CAN-002",
        title: "Screening pending",
        description: "When candidate screening is pending review",
        recipient: "Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Screening Pending: {{candidate_name}} ({{job_title}})",
          body: "Hello {{recipient_name}},\n\nThe application for {{candidate_name}} for {{job_title}} is waiting for initial screening.\n\nPlease complete the profile evaluation.\n\nRegards,\nTalent Acquisition",
        },
        whatsAppTemplate: {
          body: "Screening Pending: Application for *{{candidate_name}}* (*{{job_title}}*) is awaiting your review: {{action_url}}",
        },
      },
      {
        id: "CAN-003",
        code: "CAN-003",
        title: "Candidate shortlisted",
        description: "When a candidate is shortlisted for the next stage",
        recipient: "Recruiter / Hiring Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Candidate Shortlisted: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\n{{candidate_name}} has been shortlisted for {{job_title}} and moved to the next recruitment stage.\n\nPlease proceed to schedule the round of interview.\n\nRegards,\n{{hr_contact}}\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Candidate Shortlisted: *{{candidate_name}}* shortlisted for *{{job_title}}*. Schedule interview: {{action_url}}",
        },
      },
      {
        id: "CAN-004",
        code: "CAN-004",
        title: "Candidate rejected",
        description: "When a candidate is marked as not selected at current stage",
        recipient: "Recruiter; Candidate if configured",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Application Update: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\n{{candidate_name}} has been marked as not selected for {{job_title}}.\n\nCandidate record and remarks have been updated in iComply.",
        },
        whatsAppTemplate: {
          body: "Candidate Rejected: *{{candidate_name}}* marked as not selected for *{{job_title}}*. View record: {{action_url}}",
        },
      },
      {
        id: "CAN-005",
        code: "CAN-005",
        title: "Duplicate application detected",
        description: "When a possible duplicate profile or application is detected",
        recipient: "Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Duplicate Alert: Potential duplicate application for {{candidate_name}}",
          body: "Hello {{recipient_name}},\n\nA potential duplicate candidate profile or application has been detected for {{candidate_name}} (Role: {{job_title}}).\n\nPlease verify and merge duplicate records if needed.",
        },
        whatsAppTemplate: {
          body: "Duplicate Alert: Potential duplicate application detected for *{{candidate_name}}* (*{{job_title}}*). Review: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "interview-scheduling-feedback",
    title: "C. Interview scheduling and feedback",
    subtitle: "Interview invitations, confirmations, reminders, reschedules and feedback",
    icon: "calendar-clock",
    items: [
      {
        id: "INT-001",
        code: "INT-001",
        title: "Interview invitation",
        description: "Interview scheduled with date, time, and meeting details",
        recipient: "Candidate",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Interview Invitation: {{job_title}} at {{company_name}}",
          body: "Dear {{candidate_name}},\n\nYou are invited for an interview for {{job_title}} on {{date}} at {{time}}.\nMeeting link/location: {{action_url}}\n\nPlease confirm your availability.\n\nBest regards,\nTalent Acquisition Team\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Hi {{candidate_name}}, your interview for *{{job_title}}* is scheduled on {{date}} at {{time}}. Join here: {{action_url}}",
        },
      },
      {
        id: "INT-002",
        code: "INT-002",
        title: "Interview confirmation",
        description: "When candidate confirms the interview schedule",
        recipient: "Recruiter / Interviewer",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Interview Confirmed: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\n{{candidate_name}} has confirmed attendance for the interview on {{date}} at {{time}} for {{job_title}}.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Confirmed: *{{candidate_name}}* confirmed interview for *{{job_title}}* on {{date}} at {{time}}. Details: {{action_url}}",
        },
      },
      {
        id: "INT-003",
        code: "INT-003",
        title: "Interview reminder",
        description: "Reminder for upcoming scheduled interview",
        recipient: "Candidate / Interviewer",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Upcoming Interview for {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThis is a reminder for the interview with {{candidate_name}} for {{job_title}} on {{date}} at {{time}}.\nMeeting link: {{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Interview Reminder: *{{job_title}}* interview starts soon on {{date}} at {{time}}. Link: {{action_url}}",
        },
      },
      {
        id: "INT-004",
        code: "INT-004",
        title: "Interview rescheduled",
        description: "When interview date or time has changed",
        recipient: "Candidate / Interviewer / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Interview Rescheduled: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe interview for {{job_title}} has been rescheduled to {{date}} at {{time}}.\nUpdated meeting link: {{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Rescheduled: Interview for *{{job_title}}* with *{{candidate_name}}* is now on {{date}} at {{time}}. Details: {{action_url}}",
        },
      },
      {
        id: "INT-005",
        code: "INT-005",
        title: "Interview cancelled",
        description: "When a scheduled interview has been cancelled",
        recipient: "Candidate / Interviewer / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Interview Cancelled: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe interview scheduled for {{job_title}} on {{date}} has been cancelled.\nWe will notify you if it is rescheduled.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Cancelled: Interview for *{{job_title}}* on {{date}} has been cancelled. Details: {{action_url}}",
        },
      },
      {
        id: "INT-006",
        code: "INT-006",
        title: "Interview feedback pending",
        description: "Interview feedback and scorecard must be submitted",
        recipient: "Interviewer / Panel",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Submit Interview Feedback for {{candidate_name}}",
          body: "Hello {{recipient_name}},\n\nPlease submit your interview evaluation feedback and scorecard for {{candidate_name}} ({{job_title}}).\nSubmit feedback: {{action_url}}\n\nRegards,\nTalent Acquisition",
        },
        whatsAppTemplate: {
          body: "Feedback Pending: Please submit scorecard for *{{candidate_name}}* (*{{job_title}}*). Link: {{action_url}}",
        },
      },
      {
        id: "INT-007",
        code: "INT-007",
        title: "Interview completed",
        description: "When interview has been marked as completed",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Interview Completed: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe interview round for {{candidate_name}} for {{job_title}} has been completed.\nPlease review scorecards and advance candidate in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Interview Completed: *{{candidate_name}}* completed interview for *{{job_title}}*. View scorecard: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "candidate-documentation-verification",
    title: "D. Candidate documentation collection and verification",
    subtitle: "Document requests, submissions, pending alerts, reminders and verification",
    icon: "file-check",
    items: [
      {
        id: "DOC-001",
        code: "DOC-001",
        title: "Document request sent",
        description: "Request sent for required candidate documents",
        recipient: "Candidate",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Submit Your Documents for {{job_title}} - {{company_name}}",
          body: "Dear {{candidate_name}},\n\nCongratulations on progressing in the recruitment process for {{job_title}}.\n\nPlease upload your required verification documents using the portal link below:\n{{action_url}}\n\nBest regards,\nOnboarding & HR Team\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Hi {{candidate_name}}, please upload your verification documents for *{{job_title}}* at {{company_name}}. Upload link: {{action_url}}",
        },
      },
      {
        id: "DOC-002",
        code: "DOC-002",
        title: "Documents pending",
        description: "When candidate has not submitted required documents",
        recipient: "Candidate / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Pending Documents Alert: {{candidate_name}} ({{job_title}})",
          body: "Hello {{recipient_name}},\n\nThe document submission for {{candidate_name}} for {{job_title}} is currently pending.\n\nPlease complete the document upload to avoid delays in processing:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Documents Pending: Verification documents for *{{candidate_name}}* (*{{job_title}}*) are pending submission. Portal: {{action_url}}",
        },
      },
      {
        id: "DOC-003",
        code: "DOC-003",
        title: "Document submission received",
        description: "When candidate documents are submitted for review",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Documents Submitted: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\n{{candidate_name}} has submitted the requested verification documents for {{job_title}}.\n\nPlease review and verify the documents in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Documents Submitted: *{{candidate_name}}* uploaded verification documents for *{{job_title}}*. Review now: {{action_url}}",
        },
      },
      {
        id: "DOC-004",
        code: "DOC-004",
        title: "Missing document reminder",
        description: "Reminder for pending or missing required documents",
        recipient: "Candidate",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Missing Required Documents for {{job_title}}",
          body: "Dear {{candidate_name}},\n\nOne or more required documents are still missing from your submission for {{job_title}}.\n\nPlease upload the missing documents at your earliest convenience:\n{{action_url}}\n\nBest regards,\n{{hr_contact}}\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Missing Document Alert: One or more documents are missing for *{{job_title}}*. Please upload here: {{action_url}}",
        },
      },
      {
        id: "DOC-005",
        code: "DOC-005",
        title: "Verification completed",
        description: "When candidate documents are successfully verified",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Document Verification Completed: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nAll required documents for {{candidate_name}} ({{job_title}}) have been successfully verified.\n\nThe candidate is now cleared for offer release or onboarding.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Verification Completed: Documents for *{{candidate_name}}* (*{{job_title}}*) have been successfully verified.",
        },
      },
    ],
  },
  {
    id: "offer-preparation-approval-acceptance",
    title: "E. Offer preparation, approval, and acceptance",
    subtitle: "Offer issuance, approvals, reminders, acceptance, decline and joining date updates",
    icon: "award",
    items: [
      {
        id: "OFF-001",
        code: "OFF-001",
        title: "Offer preparation initiated",
        description: "An offer needs to be prepared for the selected candidate.",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Prepare Offer Letter for {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe interview stages for {{candidate_name}} ({{job_title}}) are complete and the candidate has been selected.\n\nPlease initiate and prepare the employment offer letter in iComply.\n\nRegards,\nTalent Acquisition\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Prep: *{{candidate_name}}* has been selected for *{{job_title}}*. Please prepare the offer letter: {{action_url}}",
        },
      },
      {
        id: "OFF-002",
        code: "OFF-002",
        title: "Offer approval requested",
        description: "An employment offer is pending your review and approval.",
        recipient: "Hiring Manager / HR Head / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Approval Needed: Employment Offer for {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nAn employment offer for {{candidate_name}} for the position of {{job_title}} has been prepared and requires your approval.\n\nPlease review the salary structure, terms, and respond in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Approval Needed: Employment offer for *{{candidate_name}}* (*{{job_title}}*) is awaiting your approval. Review: {{action_url}}",
        },
      },
      {
        id: "OFF-003",
        code: "OFF-003",
        title: "Offer approval reminder",
        description: "An employment offer is awaiting approval.",
        recipient: "Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Pending Offer Approval for {{candidate_name}} ({{job_title}})",
          body: "Hello {{recipient_name}},\n\nThis is a reminder that the employment offer for {{candidate_name}} ({{job_title}}) is still awaiting your review and approval.\n\nPlease review promptly to avoid delays:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Reminder: Offer for *{{candidate_name}}* (*{{job_title}}*) is awaiting your approval. Please review: {{action_url}}",
        },
      },
      {
        id: "OFF-004",
        code: "OFF-004",
        title: "Offer approved",
        description: "The offer has been approved and is ready to be issued.",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Offer Approved: Ready to Issue to {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe employment offer for {{candidate_name}} for the role of {{job_title}} has been approved.\n\nYou may now issue the offer letter to the candidate:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Approved: Offer for *{{candidate_name}}* (*{{job_title}}*) has been approved. You can now issue the offer: {{action_url}}",
        },
      },
      {
        id: "OFF-005",
        code: "OFF-005",
        title: "Offer rejected",
        description: "The offer was rejected. Review the comments and revise it.",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Offer Rejected: Revision Required for {{candidate_name}} ({{job_title}})",
          body: "Hello {{recipient_name}},\n\nThe employment offer for {{candidate_name}} ({{job_title}}) has been rejected by the approver.\n\nReason/Comments: {{rejection_reason}}\nPlease review the comments and revise the offer in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Rejected: Offer for *{{candidate_name}}* was rejected. Reason: {{rejection_reason}}. Revise offer: {{action_url}}",
        },
      },
      {
        id: "OFF-006",
        code: "OFF-006",
        title: "Offer issued",
        description: "An employment offer has been issued to you. Please review the terms and respond.",
        recipient: "Candidate",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Congratulations! Employment Offer from {{company_name}} - {{job_title}}",
          body: "Dear {{candidate_name}},\n\nWe are pleased to offer you the position of {{job_title}} at {{company_name}}.\n\nPlease review your formal offer letter and terms of employment using the link below:\n{{action_url}}\n\nPlease submit your acceptance before {{offer_expiry_date}}.\n\nWarm regards,\n{{hr_contact}}\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Congratulations {{candidate_name}}! We are thrilled to offer you the role of *{{job_title}}* at *{{company_name}}*. View and sign your offer here: {{action_url}}",
        },
      },
      {
        id: "OFF-007",
        code: "OFF-007",
        title: "Offer acceptance received",
        description: "The candidate has accepted the employment offer.",
        recipient: "Recruiter / HR / Hiring Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Offer Accepted: {{candidate_name}} has accepted the offer for {{job_title}}!",
          body: "Great news {{recipient_name}},\n\n{{candidate_name}} has formally accepted the employment offer for {{job_title}}.\n\nExpected Joining Date: {{joining_date}}\nYou can now proceed with the pre-onboarding formalities in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Accepted! 🎉 *{{candidate_name}}* accepted the offer for *{{job_title}}*. Expected DOJ: {{joining_date}}. View details: {{action_url}}",
        },
      },
      {
        id: "OFF-008",
        code: "OFF-008",
        title: "Offer declined",
        description: "The candidate has declined the employment offer.",
        recipient: "Recruiter / HR / Hiring Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Offer Declined: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\n{{candidate_name}} has declined the employment offer for {{job_title}}.\n\nDecline Reason / Remarks: {{decline_reason}}\nPlease review the candidate record and next steps in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Declined: *{{candidate_name}}* declined the offer for *{{job_title}}*. Reason: {{decline_reason}}. View details: {{action_url}}",
        },
      },
      {
        id: "OFF-009",
        code: "OFF-009",
        title: "Offer expiry reminder",
        description: "The employment offer is approaching its response deadline.",
        recipient: "Candidate / Recruiter",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Your Employment Offer for {{job_title}} Expires Soon",
          body: "Dear {{recipient_name}},\n\nThis is a reminder that the employment offer for {{candidate_name}} ({{job_title}}) is scheduled to expire on {{offer_expiry_date}}.\n\nPlease review and confirm acceptance prior to expiry:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Reminder: Offer for *{{candidate_name}}* (*{{job_title}}*) expires on {{offer_expiry_date}}. Review offer: {{action_url}}",
        },
      },
      {
        id: "OFF-010",
        code: "OFF-010",
        title: "Offer expired",
        description: "The offer response deadline has passed without acceptance.",
        recipient: "Recruiter / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Offer Expired: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe offer response deadline ({{offer_expiry_date}}) for {{candidate_name}} ({{job_title}}) has passed without acceptance.\n\nThe offer is now marked as expired. You may extend the deadline or reissue if necessary.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offer Expired: Response deadline passed for *{{candidate_name}}* (*{{job_title}}*). Update candidate status: {{action_url}}",
        },
      },
      {
        id: "OFF-011",
        code: "OFF-011",
        title: "Offer revision required",
        description: "The offer requires revision and resubmission for approval.",
        recipient: "Recruiter / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Offer Revision Requested: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nA revision has been requested for the employment offer of {{candidate_name}} ({{job_title}}).\n\nNotes: {{revision_notes}}\nPlease update the offer details and resubmit for approval in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Revision Required: Please revise offer details for *{{candidate_name}}* (*{{job_title}}*). Notes: {{revision_notes}}. Edit: {{action_url}}",
        },
      },
      {
        id: "OFF-012",
        code: "OFF-012",
        title: "Joining date changed",
        description: "The candidate's confirmed joining date has been updated.",
        recipient: "Candidate / HR / Hiring Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Joining Date Updated: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nThe confirmed date of joining for {{candidate_name}} ({{job_title}}) has been updated.\n\nNew Joining Date: {{new_joining_date}}\nPrevious Joining Date: {{previous_joining_date}}\nReason: {{reschedule_reason}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "DOJ Updated: New joining date for *{{candidate_name}}* (*{{job_title}}*) is *{{new_joining_date}}*. View details: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "onboarding-checklist-intimation",
    title: "F. Onboarding checklist and new joiner intimation",
    subtitle: "Onboarding tasks, reminders, new joiner intimation, IT access and asset allocation",
    icon: "clipboard-check",
    items: [
      {
        id: "ONB-001",
        code: "ONB-001",
        title: "Onboarding initiated",
        description: "Onboarding has been initiated for the selected candidate.",
        recipient: "HR / Onboarding Coordinator",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Onboarding Initiated: {{candidate_name}} - {{job_title}}",
          body: "Hello {{recipient_name}},\n\nOnboarding has been initiated for {{candidate_name}} for the position of {{job_title}}.\n\nPlease assign onboarding checklists and configure pre-boarding requirements in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Onboarding Initiated: Onboarding started for *{{candidate_name}}* (*{{job_title}}*). Assign checklist: {{action_url}}",
        },
      },
      {
        id: "ONB-002",
        code: "ONB-002",
        title: "Onboarding checklist assigned",
        description: "New onboarding tasks have been assigned to you.",
        recipient: "Employee / Task Owner",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Onboarding Tasks Assigned to You",
          body: "Hello {{recipient_name}},\n\nNew onboarding tasks have been assigned to you for {{candidate_name}} ({{job_title}}).\n\nPlease log in to iComply to view the checklist and complete your assigned items.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Onboarding Tasks: New checklist tasks have been assigned to you. Review and complete: {{action_url}}",
        },
      },
      {
        id: "ONB-003",
        code: "ONB-003",
        title: "Onboarding task reminder",
        description: "An assigned onboarding task is approaching its due date.",
        recipient: "Task Owner",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Onboarding Task Approaching Due Date - {{task_name}}",
          body: "Hello {{recipient_name}},\n\nThis is a reminder that the onboarding task '{{task_name}}' for {{candidate_name}} is approaching its due date ({{due_date}}).\n\nPlease complete the task on time in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Task Reminder: Onboarding task *{{task_name}}* is approaching due date on *{{due_date}}*. Complete here: {{action_url}}",
        },
      },
      {
        id: "ONB-004",
        code: "ONB-004",
        title: "Onboarding task overdue",
        description: "An assigned onboarding task has passed its due date.",
        recipient: "Task Owner / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Overdue Alert: Onboarding Task Past Due Date - {{task_name}}",
          body: "Hello {{recipient_name}},\n\nThe assigned onboarding task '{{task_name}}' for {{candidate_name}} has passed its due date ({{due_date}}).\n\nPlease complete this pending task immediately to avoid delays.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Task Overdue: Task *{{task_name}}* for *{{candidate_name}}* is overdue (Due: {{due_date}}). Action required: {{action_url}}",
        },
      },
      {
        id: "ONB-005",
        code: "ONB-005",
        title: "Onboarding task completed",
        description: "An onboarding checklist item has been completed.",
        recipient: "HR / Relevant Task Owner",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Task Completed: {{task_name}} for {{candidate_name}}",
          body: "Hello {{recipient_name}},\n\nThe onboarding checklist item '{{task_name}}' for {{candidate_name}} has been marked as completed by {{completed_by}}.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Task Completed: *{{task_name}}* completed for *{{candidate_name}}* by {{completed_by}}. View checklist: {{action_url}}",
        },
      },
      {
        id: "ONB-006",
        code: "ONB-006",
        title: "New joiner intimation",
        description: "A new employee is joining on the specified date.",
        recipient: "Reporting Manager / HR / IT / Admin / Payroll",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "New Joiner Intimation: {{employee_name}} joining on {{joining_date}}",
          body: "Hello Team,\n\nWe are pleased to announce that {{employee_name}} will be joining us as {{job_title}} in the {{department}} department on {{joining_date}}.\n\nReporting Manager: {{manager_name}}\nLocation: {{location}}\n\nPlease prepare the necessary arrangements and welcome our new colleague.\n\nRegards,\nHR Department\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "New Joiner Intimation: *{{employee_name}}* joins as *{{job_title}}* on *{{joining_date}}*. View details: {{action_url}}",
        },
      },
      {
        id: "ONB-009",
        code: "ONB-009",
        title: "IT and system access required",
        description: "IT setup and system access are required before the employee's joining date.",
        recipient: "IT / System Administrator",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: IT & System Access Setup for {{employee_name}}",
          body: "Hello IT Team,\n\nIT setup, official email creation, and system permissions are required for new joiner {{employee_name}} (Role: {{job_title}}), joining on {{joining_date}}.\n\nPlease complete provisioning before the joining date.\n\nRegards,\nHR Operations\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "IT Setup Required: Provision email and system access for *{{employee_name}}* (DOJ: {{joining_date}}). Details: {{action_url}}",
        },
      },
      {
        id: "ONB-010",
        code: "ONB-010",
        title: "Asset allocation required",
        description: "Required equipment or assets must be assigned to the new employee.",
        recipient: "IT / Admin / Asset Team",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Asset Allocation Request: Hardware & Equipment for {{employee_name}}",
          body: "Hello Admin / Asset Team,\n\nHardware equipment and assets (laptop, accessories, access card) must be allocated for new joiner {{employee_name}} ({{job_title}}), joining on {{joining_date}}.\n\nPlease assign and record assets in iComply.\n\nRegards,\nHR Operations\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Asset Allocation: Required assets must be assigned to *{{employee_name}}* before {{joining_date}}. Manage assets: {{action_url}}",
        },
      },
      {
        id: "ONB-011",
        code: "ONB-011",
        title: "Onboarding completed",
        description: "All mandatory onboarding tasks have been completed.",
        recipient: "Employee / HR / Reporting Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Onboarding Completed: Congratulations {{employee_name}}!",
          body: "Hello {{employee_name}},\n\nCongratulations! All mandatory onboarding formalities and checklist tasks have been completed successfully.\n\nWe wish you great success in your journey at {{company_name}}!\n\nWarm regards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Onboarding Completed! 🎉 All onboarding tasks for *{{employee_name}}* are complete. View summary: {{action_url}}",
        },
      },
      {
        id: "ONB-012",
        code: "ONB-012",
        title: "Onboarding incomplete",
        description: "Onboarding remains incomplete after the employee's joining date.",
        recipient: "HR / Reporting Manager / Pending Task Owners",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Alert: Onboarding Incomplete After Joining Date - {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nOnboarding remains incomplete for {{employee_name}} ({{job_title}}) past the joining date ({{joining_date}}).\n\nPlease review pending checklist items and complete them promptly in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Onboarding Incomplete: Pending tasks remain for *{{employee_name}}* past DOJ ({{joining_date}}). Action required: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "attendance-timesheet-management",
    title: "H. Attendance and timesheet management",
    subtitle: "Correction requests, regularizations, exceptions, approvals and finalization",
    icon: "calendar-check",
    items: [
      {
        id: "ATT-001",
        code: "ATT-001",
        title: "Attendance correction requested",
        description: "An attendance correction request has been submitted.",
        recipient: "Reporting Manager / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Attendance Correction Request: {{employee_name}} ({{attendance_date}})",
          body: "Hello {{recipient_name}},\n\n{{employee_name}} has submitted an attendance correction request for {{attendance_date}}.\nRequested Timings: {{check_in_time}} - {{check_out_time}}\nReason: {{reason}}\n\nPlease review and approve/reject in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Correction Request: *{{employee_name}}* requested attendance correction for *{{attendance_date}}*. Approve/Reject: {{action_url}}",
        },
      },
      {
        id: "ATT-002",
        code: "ATT-002",
        title: "Attendance correction approved / rejected",
        description: "Your attendance correction request has been approved or rejected.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Attendance Correction {{status}}: {{attendance_date}}",
          body: "Hello {{employee_name}},\n\nYour attendance correction request for {{attendance_date}} has been {{status}} by {{approver_name}}.\nRemarks: {{remarks}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Attendance Update: Your correction request for {{attendance_date}} was *{{status}}*. Remarks: {{remarks}}",
        },
      },
      {
        id: "ATT-003",
        code: "ATT-003",
        title: "Attendance regularization overdue",
        description: "An attendance regularization request remains pending.",
        recipient: "Employee / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Pending Alert: Attendance Regularization Overdue",
          body: "Hello {{recipient_name}},\n\nAn attendance regularization request for {{employee_name}} for date {{attendance_date}} remains pending.\n\nPlease review and resolve it promptly to ensure accurate attendance records.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Regularization Pending: Attendance request for *{{employee_name}}* ({{attendance_date}}) is awaiting decision: {{action_url}}",
        },
      },
      {
        id: "ATT-004",
        code: "ATT-004",
        title: "Daily attendance exception",
        description: "An attendance discrepancy has been identified.",
        recipient: "HR / Reporting Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Attendance Exception Alert: {{employee_name}} - {{attendance_date}}",
          body: "Hello {{recipient_name}},\n\nAn attendance discrepancy (missing punch / short hours / late arrival) has been identified for {{employee_name}} on {{attendance_date}}.\nException Type: {{exception_type}}\n\nPlease review in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Attendance Exception: Discrepancy identified for *{{employee_name}}* on {{attendance_date}} (*{{exception_type}}*). Review: {{action_url}}",
        },
      },
      {
        id: "ATT-005",
        code: "ATT-005",
        title: "Attendance approval pending",
        description: "Attendance records require approval before payroll processing.",
        recipient: "Reporting Manager / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Attendance Approval Pending for Payroll ({{pay_period}})",
          body: "Hello {{recipient_name}},\n\nAttendance and timesheet records for {{pay_period}} require managerial sign-off and approval before the payroll cutoff.\n\nPlease review and approve pending records in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Attendance Approval: Monthly attendance records for *{{pay_period}}* require approval before payroll processing: {{action_url}}",
        },
      },
      {
        id: "ATT-006",
        code: "ATT-006",
        title: "Attendance finalized",
        description: "Attendance for the period has been finalized for payroll processing.",
        recipient: "HR / Payroll",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Attendance Finalized: Ready for Payroll Processing - {{pay_period}}",
          body: "Hello Payroll Team,\n\nAttendance data for pay period {{pay_period}} has been finalized and locked for payroll calculation.\nTotal Present Days: {{total_present}}\nTotal Leaves/Absences: {{total_leaves}}\n\nYou may proceed with the payroll batch run in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Attendance Finalized: Records for *{{pay_period}}* are finalized and ready for payroll processing. Open payroll: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "leave-management",
    title: "I. Leave management",
    subtitle: "Leave applications, approvals, reminders, rejections, cancellations and encashment",
    icon: "calendar",
    items: [
      {
        id: "LEA-001",
        code: "LEA-001",
        title: "Leave application submitted",
        description: "A new leave request has been submitted for approval.",
        recipient: "Reporting Manager / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "New Leave Application: {{employee_name}} ({{leave_type}})",
          body: "Hello {{recipient_name}},\n\n{{employee_name}} has applied for {{leave_type}} from {{start_date}} to {{end_date}} ({{days_count}} days).\nReason: {{reason}}\n\nPlease review and approve or reject the request in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Request: *{{employee_name}}* applied for {{days_count}} days of {{leave_type}} ({{start_date}} to {{end_date}}). Action: {{action_url}}",
        },
      },
      {
        id: "LEA-002",
        code: "LEA-002",
        title: "Leave approval reminder",
        description: "A leave request is awaiting your decision.",
        recipient: "Reporting Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Pending Leave Approval for {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nThis is a reminder that the leave application for {{employee_name}} ({{leave_type}}, {{start_date}} to {{end_date}}) is awaiting your decision.\n\nPlease take action promptly in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Reminder: Pending leave request for *{{employee_name}}* ({{leave_type}}) requires your decision: {{action_url}}",
        },
      },
      {
        id: "LEA-003",
        code: "LEA-003",
        title: "Leave approved",
        description: "Your leave request has been approved.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Leave Request Approved: {{leave_type}} ({{start_date}} to {{end_date}})",
          body: "Hello {{employee_name}},\n\nYour leave application for {{leave_type}} from {{start_date}} to {{end_date}} has been approved by {{approver_name}}.\n\nEnjoy your time off!\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Approved! ✅ Your leave for *{{leave_type}}* ({{start_date}} to {{end_date}}) has been approved by {{approver_name}}.",
        },
      },
      {
        id: "LEA-004",
        code: "LEA-004",
        title: "Leave rejected",
        description: "Your leave request has been rejected. Review the decision or comments.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Leave Request Rejected: {{leave_type}} ({{start_date}} to {{end_date}})",
          body: "Hello {{employee_name}},\n\nYour leave application for {{leave_type}} from {{start_date}} to {{end_date}} has been rejected.\n\nDecision / Remarks: {{rejection_reason}}\nPlease contact your reporting manager if you have questions.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Rejected: Your *{{leave_type}}* request was rejected. Reason: {{rejection_reason}}. View details: {{action_url}}",
        },
      },
      {
        id: "LEA-005",
        code: "LEA-005",
        title: "Leave cancelled",
        description: "A leave request has been cancelled.",
        recipient: "Employee / Reporting Manager / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Leave Request Cancelled: {{employee_name}} ({{leave_type}})",
          body: "Hello {{recipient_name}},\n\nThe leave request for {{employee_name}} ({{leave_type}}, {{start_date}} to {{end_date}}) has been cancelled.\nCancelled by: {{cancelled_by}}\nReason: {{cancellation_reason}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Cancelled: Leave for *{{employee_name}}* ({{start_date}} to {{end_date}}) has been cancelled by {{cancelled_by}}.",
        },
      },
      {
        id: "LEA-006",
        code: "LEA-006",
        title: "Leave overlap detected",
        description: "A possible overlap with an existing leave request has been detected.",
        recipient: "Employee / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Leave Overlap Detected: {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nA potential overlap with an existing approved or pending leave was detected for {{employee_name}} between {{start_date}} and {{end_date}}.\n\nPlease verify dates in iComply before proceeding:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Overlap: Possible date overlap detected for *{{employee_name}}* ({{start_date}} to {{end_date}}). Check details: {{action_url}}",
        },
      },
      {
        id: "LEA-007",
        code: "LEA-007",
        title: "Leave encashment / carry-forward processed",
        description: "Leave encashment or carry-forward has been processed, if enabled by policy.",
        recipient: "Employee / Payroll / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Leave Encashment / Carry-Forward Processed: {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nAnnual leave encashment and carry-forward has been processed for {{employee_name}} for the period {{year_period}}.\nCarried Forward: {{carry_forward_days}} days\nEncashed: {{encashment_days}} days\n\nRegards,\nPayroll & HR Team\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Leave Processing: Encashment / carry-forward processed for *{{employee_name}}*. Carried forward: {{carry_forward_days}}d, Encashed: {{encashment_days}}d.",
        },
      },
    ],
  },
  {
    id: "overtime-management",
    title: "J. Overtime (OT) management",
    subtitle: "Overtime submissions, approvals, rejections, discrepancy alerts and limit thresholds",
    icon: "clock",
    items: [
      {
        id: "OT-001",
        code: "OT-001",
        title: "OT request submitted",
        description: "An overtime request has been submitted for approval.",
        recipient: "Reporting Manager / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "New Overtime Request: {{employee_name}} ({{work_date}})",
          body: "Hello {{recipient_name}},\n\n{{employee_name}} has submitted an overtime request of {{hours}} hours on {{work_date}}.\nReason: {{reason}}\n\nPlease review and approve in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "OT Request: *{{employee_name}}* requested {{hours}}h overtime on {{work_date}}. Approve/Reject: {{action_url}}",
        },
      },
      {
        id: "OT-002",
        code: "OT-002",
        title: "OT approval pending",
        description: "An overtime request is awaiting your approval.",
        recipient: "Reporting Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Pending Overtime Approval for {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nThis is a reminder that the overtime request for {{employee_name}} ({{hours}} hours on {{work_date}}) is awaiting your approval.\n\nPlease take action in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "OT Pending: Overtime approval pending for *{{employee_name}}* ({{hours}}h on {{work_date}}): {{action_url}}",
        },
      },
      {
        id: "OT-003",
        code: "OT-003",
        title: "OT approved",
        description: "The overtime request has been approved.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Overtime Request Approved: {{hours}} Hours on {{work_date}}",
          body: "Hello {{employee_name}},\n\nYour overtime request of {{hours}} hours on {{work_date}} has been approved by {{approver_name}}.\n\nApproved hours will be included in the payroll calculation.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "OT Approved! ✅ Your request for {{hours}}h overtime on *{{work_date}}* has been approved by {{approver_name}}.",
        },
      },
      {
        id: "OT-004",
        code: "OT-004",
        title: "OT rejected",
        description: "The overtime request has been rejected.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Overtime Request Rejected: {{work_date}}",
          body: "Hello {{employee_name}},\n\nYour overtime request for {{work_date}} has been rejected by {{approver_name}}.\n\nReason: {{rejection_reason}}\nPlease consult your manager if you have questions.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "OT Rejected: Your overtime request for {{work_date}} was rejected. Reason: {{rejection_reason}}.",
        },
      },
      {
        id: "OT-005",
        code: "OT-005",
        title: "OT hours discrepancy",
        description: "Recorded overtime hours differ from the approved hours.",
        recipient: "Employee / Manager / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Discrepancy Alert: Overtime Hours Mismatch - {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nA discrepancy has been detected between biometric recorded overtime ({{actual_hours}}h) and pre-approved overtime ({{approved_hours}}h) for {{employee_name}} on {{work_date}}.\n\nPlease reconcile in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "OT Discrepancy: Hours mismatch for *{{employee_name}}* on {{work_date}} (Logged: {{actual_hours}}h vs Approved: {{approved_hours}}h). Check: {{action_url}}",
        },
      },
      {
        id: "OT-006",
        code: "OT-006",
        title: "OT limit exceeded",
        description: "Recorded overtime exceeds the configured threshold or applicable policy limit.",
        recipient: "Employee / Reporting Manager / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Policy Alert: Overtime Threshold Exceeded - {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nCumulative overtime for {{employee_name}} has exceeded the statutory / company monthly limit (Current: {{current_hours}}h / Limit: {{max_hours}}h).\n\nPlease review to ensure compliance with labor policies.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "OT Limit Exceeded: *{{employee_name}}* exceeded monthly OT threshold ({{current_hours}}h / {{max_hours}}h). Review compliance: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "shift-roster-management",
    title: "K. Shift and roster management",
    subtitle: "Shift assignments, changes, approval workflows, swap requests and coverage alerts",
    icon: "calendar-clock",
    items: [
      {
        id: "SHF-001",
        code: "SHF-001",
        title: "New shift assigned",
        description: "A new shift has been assigned to you.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Shift Schedule Assigned: {{shift_name}} ({{start_date}} onwards)",
          body: "Hello {{employee_name}},\n\nA new shift schedule has been assigned to you: {{shift_name}} (Timing: {{shift_timing}}), effective from {{start_date}}.\n\nPlease review your roster in the employee self-service portal.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Shift Assigned: Your shift is *{{shift_name}}* ({{shift_timing}}) effective from *{{start_date}}*. View roster: {{action_url}}",
        },
      },
      {
        id: "SHF-002",
        code: "SHF-002",
        title: "Shift changed",
        description: "Your shift schedule has been changed.",
        recipient: "Employee / Reporting Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Shift Schedule Changed: {{shift_name}} ({{effective_date}})",
          body: "Hello {{recipient_name}},\n\nThe shift schedule for {{employee_name}} has been updated.\nNew Shift: {{shift_name}} ({{shift_timing}})\nPrevious Shift: {{previous_shift}}\nEffective Date: {{effective_date}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Shift Changed: *{{employee_name}}* shift changed to *{{shift_name}}* ({{shift_timing}}) effective *{{effective_date}}*. Check roster: {{action_url}}",
        },
      },
      {
        id: "SHF-003",
        code: "SHF-003",
        title: "Shift change approval required",
        description: "A shift change request is awaiting approval.",
        recipient: "Reporting Manager",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Shift Change Request for {{employee_name}}",
          body: "Hello {{recipient_name}},\n\n{{employee_name}} has requested a shift change / swap to {{requested_shift}} on {{request_date}}.\nReason: {{reason}}\n\nPlease review and approve or reject the request in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Shift Change Request: *{{employee_name}}* requested shift change to *{{requested_shift}}* on {{request_date}}. Approve: {{action_url}}",
        },
      },
      {
        id: "SHF-004",
        code: "SHF-004",
        title: "Shift change approved / rejected",
        description: "Your shift change request has been approved or rejected.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Shift Change Request {{status}}: {{request_date}}",
          body: "Hello {{employee_name}},\n\nYour shift change request for {{request_date}} has been {{status}} by {{manager_name}}.\nRemarks: {{remarks}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Shift Change Update: Your request for {{request_date}} was *{{status}}*. Remarks: {{remarks}}",
        },
      },
      {
        id: "SHF-005",
        code: "SHF-005",
        title: "Shift coverage required",
        description: "A shift requires additional staffing or coverage.",
        recipient: "Reporting Manager / Workforce Planner",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Alert: Shift Coverage Required - {{shift_name}} ({{shift_date}})",
          body: "Hello {{recipient_name}},\n\nShift '{{shift_name}}' on {{shift_date}} has a headcount shortfall (Required: {{required_count}}, Scheduled: {{current_count}}).\n\nPlease assign replacement staff to maintain scheduled operations.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Shift Coverage Alert: Shortfall detected for *{{shift_name}}* on {{shift_date}} (Req: {{required_count}} vs Sched: {{current_count}}). Allocate roster: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "payroll-processing-approval",
    title: "L. Payroll processing and approval",
    subtitle: "Calculations, registers, managerial approvals, recalculations and summaries",
    icon: "banknote",
    items: [
      {
        id: "PAY-001",
        code: "PAY-001",
        title: "Payroll calculation completed",
        description: "Payroll has been calculated and is ready for validation.",
        recipient: "Payroll",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Payroll Calculation Completed: {{month_year}} Batch",
          body: "Hello Payroll Team,\n\nThe salary calculation run for {{month_year}} has completed successfully.\nTotal Employees: {{employee_count}}\nGross Payout: {{total_gross}}\nNet Payout: {{total_net}}\n\nPlease validate the preliminary register in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Calculated: *{{month_year}}* payroll calculated for {{employee_count}} employees (Net: {{total_net}}). Validate: {{action_url}}",
        },
      },
      {
        id: "PAY-002",
        code: "PAY-002",
        title: "Payroll review required",
        description: "The payroll register is awaiting review and approval.",
        recipient: "Payroll Manager / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Review & Approve Payroll for {{month_year}}",
          body: "Hello {{recipient_name}},\n\nThe monthly payroll register for {{month_year}} is ready and awaiting your sign-off and approval.\nTotal Net Payout: {{total_net}}\nPlease review line items, statutory deductions, and approve in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Review: Payroll register for *{{month_year}}* is awaiting your review and approval. Review here: {{action_url}}",
        },
      },
      {
        id: "PAY-003",
        code: "PAY-003",
        title: "Payroll approved",
        description: "Payroll has been approved for payment processing.",
        recipient: "Payroll / Finance",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Payroll Approved: {{month_year}} Ready for Disbursement",
          body: "Hello Finance Team,\n\nThe payroll register for {{month_year}} has been formally approved by {{approver_name}}.\n\nBank transfer files and payment advice can now be generated and processed.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Approved! ✅ *{{month_year}}* payroll approved by {{approver_name}}. Ready for bank disbursement: {{action_url}}",
        },
      },
      {
        id: "PAY-004",
        code: "PAY-004",
        title: "Payroll rejected / returned",
        description: "Payroll has been returned for correction.",
        recipient: "Payroll Team",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Action Required: Payroll Returned for Correction - {{month_year}}",
          body: "Hello Payroll Team,\n\nThe payroll register for {{month_year}} has been returned by {{approver_name}} for revision.\n\nComments / Reason: {{rejection_reason}}\nPlease amend necessary records and recalculate.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Returned: *{{month_year}}* payroll returned for correction. Reason: {{rejection_reason}}. Fix records: {{action_url}}",
        },
      },
      {
        id: "PAY-005",
        code: "PAY-005",
        title: "Payroll recalculated",
        description: "Payroll has been recalculated following an approved correction.",
        recipient: "Payroll / Approver",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Payroll Recalculated: Updated Register for {{month_year}}",
          body: "Hello {{recipient_name}},\n\nPayroll calculations for {{month_year}} have been rerun following approved corrections.\nUpdated Net Payout: {{total_net}}\n\nPlease review updated figures in iComply:\n{{action_url}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Recalculated: Updated batch for *{{month_year}}* is ready for review. New Net: {{total_net}}. View: {{action_url}}",
        },
      },
      {
        id: "PAY-006",
        code: "PAY-006",
        title: "Final payroll summary ready",
        description: "The payroll summary is available for authorized review.",
        recipient: "Payroll Manager / Finance",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Final Payroll Summary Available: {{month_year}}",
          body: "Hello {{recipient_name}},\n\nThe final executive payroll summary and cost center allocation for {{month_year}} is now ready for authorized review.\n\nTotal Cost to Company: {{total_ctc}}\nStatutory Deductions: {{total_statutory}}\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Summary: Final summary report for *{{month_year}}* is available for download and review: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "payslip-compensation-notifications",
    title: "M. Payslip and employee compensation notifications",
    subtitle: "Payslip generation, ESS publication, salary advice and deduction queries",
    icon: "receipt",
    items: [
      {
        id: "PSL-001",
        code: "PSL-001",
        title: "Payslip generated",
        description: "Your payslip for the specified pay period has been generated.",
        recipient: "HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Payslips Generated: Batch Completed for {{month_year}}",
          body: "Hello HR Team,\n\nPayslip PDFs for {{month_year}} have been successfully generated for all active employees (Total: {{count}}).\n\nYou may verify before publishing to the employee portal.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payslips Generated: Batch generation completed for *{{month_year}}* ({{count}} payslips). Verify before publish: {{action_url}}",
        },
      },
      {
        id: "PSL-002",
        code: "PSL-002",
        title: "Payslip published",
        description: "Your payslip is available in the employee self-service portal.",
        recipient: "Employee",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Your Payslip for {{month_year}} is Ready for Download",
          body: "Hello {{employee_name}},\n\nYour payslip for {{month_year}} is now published and available for download in the employee self-service portal.\nNet Pay: {{net_pay}}\n\nDownload here: {{action_url}}\n\nWarm regards,\nPayroll Team\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Hello {{employee_name}}, your payslip for *{{month_year}}* is published. View and download here: {{action_url}}",
        },
      },
      {
        id: "PSL-003",
        code: "PSL-003",
        title: "Payroll deduction query received",
        description: "An employee has raised a query about a payroll deduction.",
        recipient: "Payroll / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Payroll Query Raised: {{employee_name}} - {{month_year}}",
          body: "Hello Payroll Team,\n\n{{employee_name}} (ID: {{employee_id}}) has raised a query regarding their salary deduction for {{month_year}}.\nQuery Details: {{query_text}}\n\nPlease review and respond to the employee in iComply.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Payroll Query: *{{employee_name}}* raised a query regarding deduction in *{{month_year}}*. Review & reply: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "compliance-regulatory",
    title: "N. Compliance Management",
    subtitle: "Filing deadlines, tax calendar reminders and statutory audits",
    icon: "shield-check",
    items: [
      {
        id: "filing-deadline-7day",
        code: "CMP-001",
        title: "Upcoming filing deadlines (7-day reminder)",
        description: "Advance alert 7 days before statutory filing due date",
        recipient: "Compliance Officer / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Reminder: Statutory Filing Due in 7 Days - {{compliance_name}}",
          body: "Hello {{recipient_name}},\n\nThis is an advance notice that statutory filing for '{{compliance_name}}' (Country: {{country}}) is due on {{due_date}}.\n\nPlease ensure challans and returns are generated.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Compliance Notice: *{{compliance_name}}* filing is due on *{{due_date}}* (7 days remaining). Check calendar: {{action_url}}",
        },
      },
      {
        id: "filing-deadline-1day",
        code: "CMP-002",
        title: "Critical filing reminder (24-hour notice)",
        description: "High priority alert 24 hours before statutory filing window closes",
        recipient: "Compliance Officer / HR",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "URGENT: Statutory Filing Due Tomorrow - {{compliance_name}}",
          body: "URGENT NOTICE:\n\nThe statutory compliance filing '{{compliance_name}}' is due tomorrow on {{due_date}}.\nFailure to submit on time may attract penalties.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "URGENT: *{{compliance_name}}* filing deadline is TOMORROW (*{{due_date}}*). Immediate action required: {{action_url}}",
        },
      },
      {
        id: "document-expiry",
        code: "CMP-003",
        title: "Document & contract renewals",
        description: "Alerts for expiring company licenses, visas or contracts",
        recipient: "Compliance Officer / Legal",
        defaultEmail: true,
        defaultWhatsApp: false,
        emailTemplate: {
          subject: "Document Expiry Notice: {{document_name}}",
          body: "Hello {{recipient_name}},\n\nThe document '{{document_name}}' for {{entity_name}} is expiring on {{expiry_date}}.\nPlease initiate renewal.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Doc Expiry: *{{document_name}}* expires on {{expiry_date}}. Renew here: {{action_url}}",
        },
      },
    ],
  },
  {
    id: "employee-organisation",
    title: "O. Organisation & Announcements",
    subtitle: "Offboarding clearance and company announcements",
    icon: "users",
    items: [
      {
        id: "employee-offboarding",
        code: "ORG-001",
        title: "Offboarding & exit clearance",
        description: "Exit handover tasks and departmental sign-offs",
        recipient: "Reporting Manager / HR / IT / Admin",
        defaultEmail: true,
        defaultWhatsApp: false,
        emailTemplate: {
          subject: "Offboarding Clearance Task: {{employee_name}}",
          body: "Hello {{recipient_name}},\n\nEmployee {{employee_name}} is scheduled to complete their tenure on {{relieving_date}}.\nPlease review asset clearance and department sign-off.\n\nRegards,\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Offboarding Task: Complete exit clearance for *{{employee_name}}* (Last working day: {{relieving_date}}). Link: {{action_url}}",
        },
      },
      {
        id: "company-announcements",
        code: "ORG-002",
        title: "Company-wide announcements",
        description: "Important notices broadcast to all company personnel",
        recipient: "All Employees",
        defaultEmail: true,
        defaultWhatsApp: true,
        emailTemplate: {
          subject: "Announcement from {{company_name}}: {{announcement_title}}",
          body: "Dear Team,\n\n{{announcement_body}}\n\nBest regards,\nManagement Team\n{{company_name}}",
        },
        whatsAppTemplate: {
          body: "Announcement: *{{announcement_title}}*\n{{announcement_summary}}\nRead more: {{action_url}}",
        },
      },
    ],
  },
];

export const getDefaultSettings = () => {
  // Matching screenshot: Email is OFF by default, WhatsApp is ON by default
  const channels = {
    email: false,
    whatsapp: true,
  };

  const notifications = {};
  const templates = {};

  for (const group of DEFAULT_NOTIFICATION_MODULES) {
    for (const item of group.items) {
      notifications[item.id] = {
        email: item.defaultEmail,
        whatsapp: item.defaultWhatsApp,
      };
      templates[item.id] = {
        emailSubject: item.emailTemplate.subject,
        emailBody: item.emailTemplate.body,
        whatsAppBody: item.whatsAppTemplate.body,
      };
    }
  }

  return {
    channels,
    notifications,
    templates,
  };
};
