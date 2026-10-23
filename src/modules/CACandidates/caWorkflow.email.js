import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { db } from "../../core/db/pool.js";
import { sendMail } from "../../core/mail/mailer.js";
import { generateOfferPdfBuffer } from "../CAOffers/caOffers.pdf.js";

/**
 * Resolves all relevant participants (Candidate, Hiring Manager, Approver, Company)
 * for a candidate's workflow stage.
 */
export const resolveWorkflowParticipants = async ({ candidateId, companyId, stageKey }) => {
  let candidate = null;
  let candidateName = "Candidate";
  let candidateEmail = null;
  let role = "Software Engineer";
  let department = "Engineering";
  let ctc = "As discussed";
  let joiningDate = "";
  let establishmentName = "";

  // 1. Fetch Candidate
  if (candidateId && Number(candidateId) > 0) {
    try {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_candidates WHERE id = $1`,
        [Number(candidateId)]
      );
      if (rows[0]) {
        candidate = rows[0];
        candidateName = candidate.name || candidateName;
        candidateEmail = candidate.email || null;
        role = candidate.role || role;
        establishmentName = candidate.establishment_name || "";
      }
    } catch (e) {
      console.warn("[resolveWorkflowParticipants] Error fetching candidate:", e.message);
    }
  }

  // 2. Fetch Latest Offer (if any)
  let offer = null;
  if (candidateId && Number(candidateId) > 0) {
    try {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
        [Number(candidateId)]
      );
      if (rows[0]) {
        offer = rows[0];
        if (offer.role) role = offer.role;
        if (offer.ctc) ctc = offer.ctc;
        if (offer.joining_date) joiningDate = offer.joining_date;
        if (offer.candidate_email && !candidateEmail) candidateEmail = offer.candidate_email;
      }
    } catch (e) {
      console.warn("[resolveWorkflowParticipants] Error fetching offer:", e.message);
    }
  }

  // 3. Resolve Company Name & Email
  let companyName = "iComply Technologies";
  let companyEmail = "";
  if (companyId) {
    try {
      const { rows } = await db.query(
        `SELECT trade_name, legal_name, email FROM public.companies WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      if (rows[0]) {
        companyName = rows[0].trade_name || rows[0].legal_name || companyName;
        companyEmail = rows[0].email || "";
      }
    } catch (e) {
      console.warn("[resolveWorkflowParticipants] Error fetching company:", e.message);
    }
  }

  // 4. Resolve Hiring Manager & Approver from Requisition
  let hiringManagerName = "Hiring Manager";
  let hiringManagerEmail = "";
  let approverName = "Approver";
  let approverEmail = "";

  try {
    const { rows } = await db.query(
      `SELECT hiring_manager, hiring_manager_email, approver_name, approver_email, department, establishment_name 
       FROM public.ca_job_requisitions 
       WHERE (LOWER(TRIM(position)) = LOWER(TRIM($1)) OR ($2::text IS NOT NULL AND req_id = $2))
         AND (created_by_company_id = $3 OR $3 IS NULL)
       ORDER BY id DESC LIMIT 1`,
      [role, offer?.req_id || null, companyId]
    );
    if (rows[0]) {
      if (rows[0].hiring_manager) hiringManagerName = rows[0].hiring_manager;
      if (rows[0].hiring_manager_email) hiringManagerEmail = rows[0].hiring_manager_email;
      if (rows[0].approver_name) approverName = rows[0].approver_name;
      if (rows[0].approver_email) approverEmail = rows[0].approver_email;
      if (rows[0].department) department = rows[0].department;
      if (rows[0].establishment_name && !establishmentName) establishmentName = rows[0].establishment_name;
    }
  } catch (e) {
    console.warn("[resolveWorkflowParticipants] Error fetching requisition:", e.message);
  }

  // 5. Check stage's assignedTo in candidate workflow_stages
  if (candidate?.workflow_stages && Array.isArray(candidate.workflow_stages)) {
    const currentStage = candidate.workflow_stages.find(
      (s) => s.stageKey === stageKey || s.title?.toLowerCase() === stageKey?.toLowerCase()
    );
    if (currentStage?.assignedTo) {
      // E.g. "Priya Menon (HR Manager)" -> name: "Priya Menon"
      const cleanAssignedName = currentStage.assignedTo.replace(/\s*\(.*?\)\s*/g, "").trim();
      if (stageKey === "offer_approval") {
        approverName = cleanAssignedName || approverName;
      } else {
        hiringManagerName = cleanAssignedName || hiringManagerName;
      }
    }
  }

  // 6. Look up manager / approver emails in ca_users if not resolved yet
  if (!hiringManagerEmail && hiringManagerName && companyId) {
    try {
      const { rows } = await db.query(
        `SELECT email, name FROM public.ca_users 
         WHERE (created_by_company_id = $1 OR created_by_company_id IS NULL)
           AND LOWER(TRIM(name)) LIKE '%' || LOWER(TRIM($2)) || '%'
         LIMIT 1`,
        [companyId, hiringManagerName]
      );
      if (rows[0]?.email) {
        hiringManagerEmail = rows[0].email;
      }
    } catch (e) {}
  }

  if (!approverEmail && approverName && companyId) {
    try {
      const { rows } = await db.query(
        `SELECT email, name FROM public.ca_users 
         WHERE (created_by_company_id = $1 OR created_by_company_id IS NULL)
           AND LOWER(TRIM(name)) LIKE '%' || LOWER(TRIM($2)) || '%'
         LIMIT 1`,
        [companyId, approverName]
      );
      if (rows[0]?.email) {
        approverEmail = rows[0].email;
      }
    } catch (e) {}
  }

  // 7. Fallback to Company Admin email from ca_users
  if (!hiringManagerEmail && companyId) {
    try {
      const { rows } = await db.query(
        `SELECT email, name FROM public.ca_users 
         WHERE (created_by_company_id = $1 OR created_by_company_id IS NULL)
           AND email IS NOT NULL AND email != ''
         ORDER BY id ASC LIMIT 1`,
        [companyId]
      );
      if (rows[0]?.email) {
        hiringManagerEmail = rows[0].email;
        if (!hiringManagerName || hiringManagerName === "Hiring Manager") {
          hiringManagerName = rows[0].name || "Hiring Manager";
        }
      }
    } catch (e) {}
  }

  if (!approverEmail) {
    approverEmail = hiringManagerEmail;
  }

  // 8. Final fallback to company general email
  if (!hiringManagerEmail) hiringManagerEmail = companyEmail;
  if (!approverEmail) approverEmail = companyEmail;

  return {
    candidate,
    candidateName,
    candidateEmail,
    role,
    department,
    ctc,
    joiningDate,
    establishmentName,
    companyName,
    companyEmail,
    hiringManagerName,
    hiringManagerEmail,
    approverName,
    approverEmail,
    offer,
    offerId: offer?.id || null,
    companyId,
  };
};

// -------------------------------------------------------------
// STEP 1: Candidate is "Selected" in Interview
// -------------------------------------------------------------

/**
 * 1A. Send Selection Confirmation to Candidate
 * Re-exports the professional, MNC-grade Selection email from caCandidates.email.js
 */
export { sendCandidateSelectionEmail } from "./caCandidates.email.js";


/**
 * 1B. Send Document Collection Request to Hiring Manager
 */
export const sendHiringManagerDocumentCollectionRequest = async ({ candidateId, companyId }) => {
  try {
    const p = await resolveWorkflowParticipants({ candidateId, companyId, stageKey: "document_collection" });
    if (!p.hiringManagerEmail) {
      console.log("[HM Doc Collection Email] No hiring manager email found.");
      return false;
    }

    const brandColor = "#0c2340";
    const subject = `Action Required: Candidate Selected - Please Collect Documents for ${p.candidateName} (${p.role})`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #f97316;">Recruitment Workflow</span>
          <h2 style="color: ${brandColor}; margin: 6px 0 0 0; font-size: 20px; font-weight: 700;">Collect Candidate Documents</h2>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${p.hiringManagerName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          Candidate <strong>${p.candidateName}</strong> has been successfully <strong>Selected</strong> for the position of <strong>${p.role}</strong>.
        </p>

        <div style="margin-top: 18px; padding: 16px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #f97316; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Candidate:</strong> ${p.candidateName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Candidate Email:</strong> ${p.candidateEmail || "On file"}</p>
          <p style="margin: 0 0 6px 0;"><strong>Role:</strong> ${p.role}</p>
          <p style="margin: 0;"><strong>Current Stage:</strong> Document Collection (Pending)</p>
        </div>

        <p style="font-size: 14px; color: #334155; margin-top: 20px;">
          <strong>Action Required:</strong> Please initiate the collection of required onboarding documents (ID proof, education certificates, prior experience letters, and recent payslips). Once documents are verified, open Candidate 360 View and click <strong>"Mark done"</strong> on the Document Collection stage.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0;">
          iComply Recruitment Automation · ${p.companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: p.hiringManagerEmail,
      subject,
      html,
      fromName: "iComply Workflow",
    });
    console.log(`[HM Doc Collection Email] Sent to ${p.hiringManagerEmail}: ${sent}`);
    return sent;
  } catch (err) {
    console.error("[HM Doc Collection Email] Error:", err.message);
    return false;
  }
};

// -------------------------------------------------------------
// STEP 2: Documents Verified ("Mark done") -> Prompt HM to Generate Offer
// -------------------------------------------------------------

export const sendHiringManagerGenerateOfferRequest = async ({ candidateId, companyId }) => {
  try {
    const p = await resolveWorkflowParticipants({ candidateId, companyId, stageKey: "offer_generated" });
    if (!p.hiringManagerEmail) {
      console.log("[HM Generate Offer Email] No hiring manager email found.");
      return false;
    }

    const brandColor = "#0c2340";
    const subject = `Documents Verified: Please Generate Offer for ${p.candidateName} (${p.role})`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #0284c7;">Offer Management</span>
          <h2 style="color: ${brandColor}; margin: 6px 0 0 0; font-size: 20px; font-weight: 700;">Generate Offer Letter</h2>
        </div>

        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">
            ✓ Documents Verified & Complete
          </span>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${p.hiringManagerName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          All required documents for <strong>${p.candidateName}</strong> (${p.role}) have been verified and marked as done.
        </p>

        <div style="margin-top: 18px; padding: 16px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #0284c7; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Candidate:</strong> ${p.candidateName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Target Role:</strong> ${p.role}</p>
          <p style="margin: 0 0 6px 0;"><strong>Department:</strong> ${p.department}</p>
          <p style="margin: 0;"><strong>Next Step:</strong> Generate Offer Letter</p>
        </div>

        <p style="font-size: 14px; color: #334155; margin-top: 20px;">
          <strong>Action Required:</strong> Please navigate to the <strong>Candidate 360 View</strong> and click <strong>"Generate Offer"</strong> to draft the formal compensation and appointment details for this candidate.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0;">
          iComply Recruitment Automation · ${p.companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: p.hiringManagerEmail,
      subject,
      html,
      fromName: "iComply Workflow",
    });
    console.log(`[HM Generate Offer Email] Sent to ${p.hiringManagerEmail}: ${sent}`);
    return sent;
  } catch (err) {
    console.error("[HM Generate Offer Email] Error:", err.message);
    return false;
  }
};

// -------------------------------------------------------------
// STEP 3: Offer Generated ("Mark done") -> Prompt Approver to Verify & Approve
// -------------------------------------------------------------

export const sendApproverOfferReviewRequest = async ({ candidateId, companyId, offerId }) => {
  try {
    const p = await resolveWorkflowParticipants({ candidateId, companyId, stageKey: "offer_approval" });
    if (!p.approverEmail) {
      console.log("[Approver Review Email] No approver email found.");
      return false;
    }

    const targetOfferId = offerId || p.offerId || p.offer?.id;
    const targetCompanyId = companyId || p.companyId || (p.candidate?.created_by_company_id ? Number(p.candidate.created_by_company_id) : 2);

    const approveToken = jwt.sign(
      {
        candidateId: Number(candidateId),
        offerId: targetOfferId ? Number(targetOfferId) : null,
        companyId: targetCompanyId ? Number(targetCompanyId) : null,
        action: "approve",
        type: "offer_approval",
      },
      config.jwt.secret,
      { expiresIn: "7d" }
    );

    const rejectToken = jwt.sign(
      {
        candidateId: Number(candidateId),
        offerId: targetOfferId ? Number(targetOfferId) : null,
        companyId: targetCompanyId ? Number(targetCompanyId) : null,
        action: "reject",
        type: "offer_approval",
      },
      config.jwt.secret,
      { expiresIn: "7d" }
    );

    const backendBaseUrl = process.env.BACKEND_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/:\d+$/, "")}:${config.port}` : `http://localhost:${config.port}`);
    const approveUrl = `${backendBaseUrl}/api/ca-offers/public-approve?token=${encodeURIComponent(approveToken)}`;
    const rejectUrl = `${backendBaseUrl}/api/ca-offers/public-reject?token=${encodeURIComponent(rejectToken)}`;
    const pdfUrl = `${backendBaseUrl}/api/ca-offers/public-pdf?token=${encodeURIComponent(approveToken)}`;

    const brandColor = "#0c2340";
    const subject = `Action Required: Verify and Approve Offer for ${p.candidateName} (${p.role})`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #eab308;">Approval Required</span>
                <h2 style="color: ${brandColor}; margin: 6px 0 0 0; font-size: 20px; font-weight: 700;">Offer Approval Request</h2>
              </td>
              <td align="right" valign="top">
                <span style="display:inline-block;background:#fef9c3;border:1px solid #fde047;color:#854d0e;font-size:10px;font-weight:700;padding:4px 10px;border-radius:9999px;letter-spacing:0.5px;text-transform:uppercase;">
                  Pending Approval
                </span>
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${p.approverName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          An employment offer has been prepared for <strong>${p.candidateName}</strong> and requires your verification and executive approval.
        </p>

        <!-- Candidate & Offer Summary Card -->
        <div style="margin-top: 18px; padding: 18px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #eab308; font-size: 13px;">
          <p style="margin: 0 0 7px 0;"><strong>Candidate:</strong> ${p.candidateName}</p>
          <p style="margin: 0 0 7px 0;"><strong>Position / Role:</strong> ${p.role}</p>
          <p style="margin: 0 0 7px 0;"><strong>Compensation (CTC):</strong> <span style="color:#0c2340;font-weight:700;">${p.ctc}</span></p>
          <p style="margin: 0 0 7px 0;"><strong>Department:</strong> ${p.department}</p>
          ${p.joiningDate ? `<p style="margin: 0 0 7px 0;"><strong>Target Joining Date:</strong> ${p.joiningDate}</p>` : ""}
          <p style="margin: 0 0 7px 0;"><strong>Hiring Manager:</strong> ${p.hiringManagerName}</p>
          <p style="margin: 0;"><strong>Current Status:</strong> <span style="color:#ca8a04;font-weight:700;">Pending Your Approval</span></p>
        </div>

        <!-- View PDF Link -->
        <div style="margin: 22px 0 20px 0; text-align: center;">
          <a href="${pdfUrl}" target="_blank" style="display: inline-block; background-color: #f1f5f9; color: #0c2340; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            📄 View Formal Offer Letter (PDF)
          </a>
        </div>

        <p style="font-size: 14px; color: #334155; margin-bottom: 20px; text-align: center;">
          Please review the offer and choose your decision below:
        </p>

        <!-- Call to Action Buttons (Approve / Reject) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background: #16a34a;">
                    <a href="${approveUrl}" target="_blank" style="display: inline-block; background: #16a34a; color: #ffffff; font-size: 15px; font-weight: 700; padding: 13px 32px; text-decoration: none; border-radius: 8px; border: 1px solid #15803d; letter-spacing: 0.2px;">
                      ✓ Approve Offer
                    </a>
                  </td>
                  <td width="16"></td>
                  <td align="center" style="border-radius: 8px; background: #fef2f2;">
                    <a href="${rejectUrl}" target="_blank" style="display: inline-block; background: #fef2f2; color: #dc2626; font-size: 14px; font-weight: 600; padding: 13px 24px; text-decoration: none; border-radius: 8px; border: 1px solid #fecaca;">
                      ✕ Reject Offer
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center; margin: 16px 0 0 0;">
          Clicking <strong>Approve Offer</strong> will immediately mark the offer as approved in iComply and notify the Hiring Manager to release the offer letter to the candidate.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0; text-align: center;">
          iComply Recruitment Automation · ${p.companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: p.approverEmail,
      subject,
      html,
      fromName: "iComply Approvals",
    });
    console.log(`[Approver Review Email] Sent to ${p.approverEmail}: ${sent}`);
    return sent;
  } catch (err) {
    console.error("[Approver Review Email] Error:", err.message);
    return false;
  }
};

// -------------------------------------------------------------
// STEP 4: Offer Approved ("Mark done") -> Prompt HM to Release Offer
// -------------------------------------------------------------

export const sendHiringManagerReleaseOfferRequest = async ({ candidateId, companyId }) => {
  try {
    const p = await resolveWorkflowParticipants({ candidateId, companyId, stageKey: "offer_release" });
    if (!p.hiringManagerEmail) {
      console.log("[HM Release Offer Email] No hiring manager email found.");
      return false;
    }

    const brandColor = "#0c2340";
    const subject = `Offer Approved: Please Release Offer to ${p.candidateName} (${p.role})`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #16a34a;">Approval Completed</span>
          <h2 style="color: ${brandColor}; margin: 6px 0 0 0; font-size: 20px; font-weight: 700;">Release Approved Offer</h2>
        </div>

        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">
            ✓ Offer Approved by ${p.approverName}
          </span>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${p.hiringManagerName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          The formal employment offer for <strong>${p.candidateName}</strong> (${p.role}) has been reviewed and <strong>Approved</strong>.
        </p>

        <div style="margin-top: 18px; padding: 16px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #16a34a; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Candidate:</strong> ${p.candidateName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Role:</strong> ${p.role}</p>
          <p style="margin: 0 0 6px 0;"><strong>Annual CTC:</strong> ${p.ctc}</p>
          <p style="margin: 0;"><strong>Next Step:</strong> Release Offer to Candidate</p>
        </div>

        <p style="font-size: 14px; color: #334155; margin-top: 20px;">
          <strong>Action Required:</strong> Please proceed to release and dispatch the official offer letter to the candidate so they can review and accept.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0;">
          iComply Recruitment Automation · ${p.companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: p.hiringManagerEmail,
      subject,
      html,
      fromName: "iComply Workflow",
    });
    console.log(`[HM Release Offer Email] Sent to ${p.hiringManagerEmail}: ${sent}`);
    return sent;
  } catch (err) {
    console.error("[HM Release Offer Email] Error:", err.message);
    return false;
  }
};

// -------------------------------------------------------------
// STEP 5: Offer Released -> Send Formal Offer Letter to Candidate
// -------------------------------------------------------------

export const sendCandidateOfferReleaseNotification = async ({ candidateId, companyId, offerId, pdfBuffer, filename }) => {
  try {
    const p = await resolveWorkflowParticipants({ candidateId, companyId, stageKey: "offer_release" });
    if (!p.candidateEmail) {
      console.log("[Candidate Offer Release Email] No candidate email found.");
      return false;
    }

    let targetOfferId = offerId;
    if (!targetOfferId && candidateId) {
      const { rows: oRows } = await db.query(
        `SELECT id FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
        [Number(candidateId)]
      );
      if (oRows[0]?.id) targetOfferId = oRows[0].id;
    }

    const candidateToken = jwt.sign(
      {
        offerId: targetOfferId ? Number(targetOfferId) : null,
        candidateId: Number(candidateId),
        companyId: companyId ? Number(companyId) : null,
        type: "candidate_offer_response",
        candidateEmail: p.candidateEmail,
      },
      config.jwt.secret,
      { expiresIn: "30d" }
    );

    const backendBaseUrl = process.env.BACKEND_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/:\d+$/, "")}:${config.port}` : `http://localhost:${config.port}`);
    const acceptUrl = `${backendBaseUrl}/api/ca-offers/candidate-accept?token=${encodeURIComponent(candidateToken)}`;
    const rejectUrl = `${backendBaseUrl}/api/ca-offers/candidate-reject?token=${encodeURIComponent(candidateToken)}`;
    const pdfUrl = `${backendBaseUrl}/api/ca-offers/candidate-pdf?token=${encodeURIComponent(candidateToken)}`;

    const brandColor = "#0c2340";
    const subject = `Official Job Offer: ${p.role} at ${p.companyName}`;
    const attachments = [];
    if (pdfBuffer && filename) {
      attachments.push({
        filename,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    } else {
      try {
        const { rows: companyRows } = await db.query(
          `SELECT trade_name, legal_name, CONCAT_WS(', ', NULLIF(street, ''), NULLIF(city, ''), NULLIF(state, ''), NULLIF(pin, '')) AS address 
           FROM public.companies WHERE id = $1 LIMIT 1`,
          [companyId]
        );
        const company = companyRows[0] || {};
        const safeName = (p.candidateName || "Candidate").toLowerCase().replace(/[^a-z0-9]/g, "-");
        const generatedBuffer = await generateOfferPdfBuffer({
          offer: {
            candidate: p.candidateName,
            candidateName: p.candidateName,
            role: p.role,
            ctc: p.ctc,
            joiningDate: p.joiningDate || "28 Oct 2026",
            department: p.department || "HR",
            reportingManager: p.hiringManager || "Gowri",
            hiringManager: p.hiringManager || "Gowri",
            location: p.location || "Chennai",
            establishmentName: p.establishmentName || "Standard Global - India Operations",
            signatoryName: "Director of HR",
            signatoryTitle: "Head of People Operations",
          },
          company: {
            trade_name: company.trade_name || p.companyName || "Standard Global",
            legal_name: company.legal_name || p.companyName || "Standard Global Pte Ltd",
            address: company.address || "Chennai, Tamil Nadu, India",
            city: company.city || p.location || "Chennai",
          },
        });
        if (generatedBuffer) {
          attachments.push({
            filename: `Offer_Letter_${safeName}.pdf`,
            content: generatedBuffer,
            contentType: "application/pdf",
          });
        }
      } catch (pdfErr) {
        console.warn("[Candidate Offer Release Email] Could not auto-generate PDF buffer:", pdfErr.message);
      }
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #0c2340; padding-bottom: 12px; margin-bottom: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #059669;">Employment Offer</span>
                <h2 style="color: ${brandColor}; margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">Offer of Employment</h2>
              </td>
              <td align="right" valign="top">
                <span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;font-size:10px;font-weight:700;padding:4px 10px;border-radius:9999px;letter-spacing:0.5px;text-transform:uppercase;">
                  Official Offer
                </span>
              </td>
            </tr>
          </table>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${p.candidateName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          We are thrilled to officially extend an offer of employment to you for the position of <strong>${p.role}</strong> with <strong>${p.companyName}</strong>!
        </p>

        <p style="font-size: 14px; color: #334155;">
          Please find attached your formal <strong>Offer Cum Appointment Letter</strong> containing the complete terms of employment, compensation breakdown, and joining instructions.
        </p>

        <div style="margin-top: 18px; padding: 14px 18px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #0c2340; font-size: 13px;">
          <p style="margin: 0 0 7px 0;"><strong>Position:</strong> ${p.role}</p>
          <p style="margin: 0 0 7px 0;"><strong>Annual CTC:</strong> <span style="color:#0c2340;font-weight:700;">${p.ctc}</span></p>
          <p style="margin: 0 0 7px 0;"><strong>Location:</strong> ${p.establishmentName || "Corporate Office"}</p>
          <p style="margin: 0;"><strong>Proposed Joining Date:</strong> <span style="font-weight:700; color:#15803d;">${p.joiningDate || "As discussed"}</span></p>
        </div>

        <div style="margin: 20px 0; text-align: center;">
          <a href="${pdfUrl}" target="_blank" style="display: inline-block; background-color: #f1f5f9; color: #0c2340; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none;">
            📄 Download / View Offer Letter (PDF)
          </a>
        </div>

        <p style="font-size: 14px; color: #334155; margin-bottom: 18px; text-align: center;">
          Please review the offer details and confirm your response and Date of Joining (DOJ) below:
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background: #16a34a;">
                    <a href="${acceptUrl}" target="_blank" style="display: inline-block; background: #16a34a; color: #ffffff; font-size: 15px; font-weight: 700; padding: 13px 26px; text-decoration: none; border-radius: 8px; border: 1px solid #15803d; letter-spacing: 0.2px;">
                      ✓ Accept Offer & Confirm Joining Date
                    </a>
                  </td>
                  <td width="14"></td>
                  <td align="center" style="border-radius: 8px; background: #fef2f2;">
                    <a href="${rejectUrl}" target="_blank" style="display: inline-block; background: #fef2f2; color: #dc2626; font-size: 14px; font-weight: 600; padding: 13px 20px; text-decoration: none; border-radius: 8px; border: 1px solid #fecaca;">
                      ✕ Decline Offer
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center; margin: 16px 0 0 0;">
          Clicking <strong>Accept Offer & Confirm Joining Date</strong> will open a verification page where you can confirm or select your final Date of Joining (DOJ) and complete your acceptance.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0; text-align: center;">
          Warm regards,<br />
          <strong style="color: #334155;">Talent Acquisition & Hiring Team</strong><br />
          ${p.companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: p.candidateEmail,
      subject,
      html,
      attachments,
      fromName: `${p.companyName} Careers`,
    });
    console.log(`[Candidate Offer Release Email] Sent to ${p.candidateEmail}: ${sent}`);
    return sent;
  } catch (err) {
    console.error("[Candidate Offer Release Email] Error:", err.message);
    return false;
  }
};

// -------------------------------------------------------------
// STEP 6: Candidate Accepts Offer & Confirms DOJ -> Revert Email to HM
// -------------------------------------------------------------

export const sendHiringManagerOfferAcceptedRevert = async ({ candidateId, companyId, joiningDate: directDoj }) => {
  try {
    const p = await resolveWorkflowParticipants({ candidateId, companyId, stageKey: "offer_acceptance" });
    if (!p.hiringManagerEmail) {
      console.log("[HM Revert Email] No hiring manager email found.");
      return false;
    }

    const finalDoj = directDoj || p.joiningDate || "To be confirmed";
    const brandColor = "#0c2340";
    const subject = `Offer Accepted & DOJ Confirmed: ${p.candidateName} (${p.role})`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #16a34a;">Offer Accepted</span>
          <h2 style="color: ${brandColor}; margin: 6px 0 0 0; font-size: 20px; font-weight: 700;">Candidate Accepted Offer!</h2>
        </div>

        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">
            ✓ Offer Accepted & Confirmed
          </span>
        </div>

        <p style="font-size: 15px; margin-top: 0;">Hello <strong>${p.hiringManagerName}</strong>,</p>

        <p style="font-size: 14px; color: #334155;">
          Great news! Candidate <strong>${p.candidateName}</strong> has officially <strong>Accepted</strong> the offer for the position of <strong>${p.role}</strong>.
        </p>

        <div style="margin-top: 18px; padding: 16px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #16a34a; font-size: 13px;">
          <p style="margin: 0 0 6px 0;"><strong>Candidate:</strong> ${p.candidateName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Position:</strong> ${p.role}</p>
          <p style="margin: 0 0 6px 0;"><strong>Confirmed Date of Joining (DOJ):</strong> <span style="font-weight: 700; color: #15803d;">${finalDoj}</span></p>
          <p style="margin: 0;"><strong>Status:</strong> Ready for Onboarding</p>
        </div>

        <p style="font-size: 14px; color: #334155; margin-top: 20px;">
          The candidate has been moved to the <strong>Onboarding Pipeline</strong>. You can now prepare the employee setup, welcome kit, and Day-1 orientation schedule.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

        <p style="font-size: 12px; color: #64748b; margin: 0;">
          iComply Recruitment Automation · ${p.companyName}
        </p>
      </div>
    `;

    const sent = await sendMail({
      to: p.hiringManagerEmail,
      subject,
      html,
      fromName: "iComply Workflow",
    });
    console.log(`[HM Revert Email] Sent to ${p.hiringManagerEmail}: ${sent}`);
    return sent;
  } catch (err) {
    console.error("[HM Revert Email] Error:", err.message);
    return false;
  }
};
