import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { caOffersRepository } from "./caOffers.repository.js";
import { mapCAOffer } from "./caOffers.constants.js";
import { caCandidatesService } from "../CACandidates/caCandidates.service.js";
import { caCandidatesRepository } from "../CACandidates/caCandidates.repository.js";
import { generateOfferPdfBuffer } from "./caOffers.pdf.js";
import { sendMail } from "../../core/mail/mailer.js";
import { AppError } from "../../core/errors/AppError.js";
import { db } from "../../core/db/pool.js";
import {
  sendApproverOfferReviewRequest,
  sendHiringManagerReleaseOfferRequest,
  sendHiringManagerOfferAcceptedRevert,
} from "../CACandidates/caWorkflow.email.js";

const resolveOnboardingDetails = async (offer, companyId, payload = {}) => {
  let managerName = payload.manager || payload.managerName || payload.hiringManager || offer.hiringManager || offer.hiring_manager || "";
  let managerEmail = payload.managerEmail || payload.hiringManagerEmail || "";
  let department = payload.department || "";
  let establishmentId = payload.establishmentId || offer.establishmentId || offer.establishment_id || "";
  let establishmentName = payload.establishmentName || offer.establishmentName || offer.establishment_name || "";
  let companyName = payload.companyName || "";

  // 1. Check candidate record for establishment
  if (offer.candidateId && (!establishmentName || !establishmentId)) {
    try {
      const candRes = await db.query(
        `SELECT role, establishment_id, establishment_name FROM public.ca_candidates WHERE id = $1`,
        [offer.candidateId]
      );
      if (candRes.rows[0]) {
        if (!establishmentId) establishmentId = candRes.rows[0].establishment_id || "";
        if (!establishmentName) establishmentName = candRes.rows[0].establishment_name || "";
      }
    } catch (e) {}
  }

  // 2. Check requisition for manager, department, establishment, company
  const role = offer.role || "";
  const reqId = offer.reqId || offer.req_id || "";
  try {
    let reqRes = null;
    if (reqId) {
      reqRes = await db.query(
        `SELECT hiring_manager, hiring_manager_email, department, establishment_id, establishment_name, company_name 
         FROM public.ca_job_requisitions 
         WHERE req_id = $1 AND (created_by_company_id = $2 OR $2 IS NULL) LIMIT 1`,
        [reqId, companyId]
      );
    }
    if (!reqRes?.rows?.[0] && role) {
      reqRes = await db.query(
        `SELECT hiring_manager, hiring_manager_email, department, establishment_id, establishment_name, company_name 
         FROM public.ca_job_requisitions 
         WHERE LOWER(TRIM(position)) = LOWER(TRIM($1)) AND (created_by_company_id = $2 OR $2 IS NULL) 
         ORDER BY id DESC LIMIT 1`,
        [role, companyId]
      );
    }
    if (reqRes?.rows?.[0]) {
      const r = reqRes.rows[0];
      if (!managerName) managerName = r.hiring_manager || "";
      if (!managerEmail) managerEmail = r.hiring_manager_email || "";
      if (!department) department = r.department || "";
      if (!establishmentId) establishmentId = r.establishment_id || "";
      if (!establishmentName) establishmentName = r.establishment_name || "";
      if (!companyName && r.company_name) companyName = r.company_name;
    }
  } catch (e) {}

  // 3. Resolve Company Name
  if (!companyName && companyId) {
    try {
      const compRes = await db.query(
        `SELECT trade_name, legal_name FROM public.companies WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      if (compRes.rows[0]) {
        companyName = compRes.rows[0].trade_name || compRes.rows[0].legal_name || "";
      }
      if (!companyName) {
        const caCompRes = await db.query(
          `SELECT name FROM public.ca_companies WHERE id = $1 LIMIT 1`,
          [companyId]
        );
        if (caCompRes.rows[0]) {
          companyName = caCompRes.rows[0].name || "";
        }
      }
    } catch (e) {}
  }

  // 4. Resolve Establishment Name if only establishmentId is present
  if (establishmentId && !establishmentName) {
    try {
      const estRes = await db.query(
        `SELECT name FROM public.ca_establishments WHERE id = $1 LIMIT 1`,
        [establishmentId]
      );
      if (estRes.rows[0]) {
        establishmentName = estRes.rows[0].name || "";
      }
    } catch (e) {}
  }

  return {
    managerName,
    managerEmail,
    department,
    establishmentId,
    establishmentName,
    companyName,
  };
};

const syncToOnboardingTable = async (offer, companyId, payload = {}) => {
  if (!offer) return;
  try {
    const joiningDate = (typeof payload === "string" ? payload : payload.joiningDate) || offer.joiningDate || "";
    const payloadObj = typeof payload === "object" ? payload : {};
    const resolved = await resolveOnboardingDetails(offer, companyId, payloadObj);

    const existing = await db.query(
      `SELECT id FROM public.ca_onboarding 
       WHERE (offer_id = $1 OR (candidate_id = $2 AND candidate_id IS NOT NULL)) 
         AND created_by_company_id = $3 LIMIT 1`,
      [offer.id, offer.candidateId, companyId]
    );

    if (existing.rows[0]) {
      await db.query(
        `UPDATE public.ca_onboarding
         SET status = 'Pending Onboarding',
             joining_date = COALESCE(NULLIF($1, ''), joining_date),
             company_name = COALESCE(NULLIF($2, ''), company_name),
             manager_name = COALESCE(NULLIF($3, ''), manager_name),
             manager_email = COALESCE(NULLIF($4, ''), manager_email),
             department = COALESCE(NULLIF($5, ''), department),
             establishment_id = COALESCE(NULLIF($6, ''), establishment_id),
             establishment_name = COALESCE(NULLIF($7, ''), establishment_name),
             updated_at = NOW()
         WHERE id = $8`,
        [
          joiningDate,
          resolved.companyName,
          resolved.managerName,
          resolved.managerEmail,
          resolved.department,
          resolved.establishmentId,
          resolved.establishmentName,
          existing.rows[0].id,
        ]
      );
    } else {
      await db.query(
        `INSERT INTO public.ca_onboarding (
          candidate_id, offer_id, candidate_name, email, phone, role, ctc,
          joining_bonus, joining_date, location, establishment_id, establishment_name,
          company_name, manager_name, manager_email, department,
          status, documents, onboarding_data, created_by_company_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          'Pending Onboarding', $17, $18, $19, NOW(), NOW()
        )`,
        [
          offer.candidateId || null,
          offer.id,
          offer.candidateName || "",
          offer.email || "",
          offer.phone || "",
          offer.role || "",
          offer.ctc || "",
          offer.joiningBonus || "",
          joiningDate,
          offer.location || "",
          resolved.establishmentId,
          resolved.establishmentName,
          resolved.companyName,
          resolved.managerName,
          resolved.managerEmail,
          resolved.department,
          JSON.stringify(offer.documents || []),
          JSON.stringify({
            manager: resolved.managerName,
            managerEmail: resolved.managerEmail,
            company: resolved.companyName,
            establishment: resolved.establishmentName,
            department: resolved.department,
          }),
          companyId,
        ]
      );
    }

    // Also update candidate record with establishment if available
    if (offer.candidateId && resolved.establishmentId) {
      try {
        await db.query(
          `UPDATE public.ca_candidates 
           SET establishment_id = COALESCE(NULLIF($1, ''), establishment_id),
               establishment_name = COALESCE(NULLIF($2, ''), establishment_name)
           WHERE id = $3`,
          [resolved.establishmentId, resolved.establishmentName, offer.candidateId]
        );
      } catch (e) {}
    }
  } catch (err) {
    console.warn("Could not sync to ca_onboarding table:", err?.message);
  }
};

export const caOffersService = {
  async list(companyId, filter = {}) {
    return caOffersRepository.list(companyId, filter);
  },

  async getById(id, companyId) {
    return caOffersRepository.findById(id, companyId);
  },

  async create(companyId, payload) {
    const created = await caOffersRepository.create(companyId, payload);
    const candidateId = created?.candidateId || payload?.candidateId;
    if (candidateId && Number(candidateId) > 0) {
      // Step 3: Offer generated -> Mark workflow step completed in candidate record
      try {
        await caCandidatesService.updateWorkflowStep(candidateId, companyId, {
          stageKey: "offer_generated",
          status: "Completed",
          assignedTo: payload.hiringManager || payload.hiring_manager || undefined,
        });
      } catch (err) {
        console.warn("Could not mark workflow step offer_generated:", err.message);
      }

      // Trigger Step 3 Notification: Send email to Approver to verify and approve offer
      void sendApproverOfferReviewRequest({
        candidateId,
        companyId,
        offerId: created?.id,
      }).catch((e) => console.error("Failed to send Approver offer review request email:", e));
    }
    return created;
  },

  async generatePdf(id, companyId, queryOffer = null) {
    let offer = null;
    let candidateId = queryOffer?.candidateId || null;
    const numId = Number(id);

    // 1. Handle cand_offer_X format or numerical ID
    if (typeof id === "string" && id.startsWith("cand_offer_")) {
      candidateId = Number(id.replace("cand_offer_", ""));
    } else if (!isNaN(numId) && numId > 0) {
      offer = await caOffersRepository.findById(numId, companyId);
      // If findById didn't find an offer, maybe the ID was actually candidateId!
      if (!offer) {
        candidateId = numId;
      }
    }

    // 2. If no offer found yet, try lookup by candidateId in ca_offers
    if (!offer && candidateId) {
      try {
        const { rows } = await db.query(
          `SELECT id FROM public.ca_offers 
           WHERE candidate_id = $1 AND created_by_company_id = $2 
           ORDER BY id DESC LIMIT 1`,
          [Number(candidateId), companyId]
        );
        if (rows[0]) {
          offer = await caOffersRepository.findById(rows[0].id, companyId);
        }
      } catch (e) {}
    }

    // 3. If no offer found yet, try lookup by candidate name in ca_offers
    const candidateNameQuery = queryOffer?.candidate || queryOffer?.candidateName;
    if (!offer && candidateNameQuery) {
      try {
        const { rows } = await db.query(
          `SELECT id FROM public.ca_offers 
           WHERE LOWER(TRIM(candidate_name)) = LOWER(TRIM($1)) AND created_by_company_id = $2 
           ORDER BY id DESC LIMIT 1`,
          [candidateNameQuery, companyId]
        );
        if (rows[0]) {
          offer = await caOffersRepository.findById(rows[0].id, companyId);
        }
      } catch (e) {}
    }

    // 4. Lookup candidate details from ca_candidates
    let candidateRow = null;
    if (candidateId || offer?.candidateId) {
      try {
        const { rows } = await db.query(
          `SELECT * FROM public.ca_candidates WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
          [Number(candidateId || offer.candidateId), companyId]
        );
        candidateRow = rows[0] || null;
      } catch (e) {}
    }
    if (!candidateRow && candidateNameQuery) {
      try {
        const { rows } = await db.query(
          `SELECT * FROM public.ca_candidates 
           WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND created_by_company_id = $2 
           ORDER BY id DESC LIMIT 1`,
          [candidateNameQuery, companyId]
        );
        candidateRow = rows[0] || null;
      } catch (e) {}
    }

    // 5. Lookup Requisition to resolve Department and Hiring Manager
    let reqRow = null;
    const targetRole = queryOffer?.role || offer?.role || candidateRow?.role;
    const targetReqId = queryOffer?.reqId || offer?.reqId || candidateRow?.req_id;
    try {
      if (targetReqId) {
        const { rows } = await db.query(
          `SELECT * FROM public.ca_job_requisitions 
           WHERE req_id = $1 AND created_by_company_id = $2 
           ORDER BY id DESC LIMIT 1`,
          [targetReqId, companyId]
        );
        reqRow = rows[0] || null;
      }
      if (!reqRow && targetRole) {
        const { rows } = await db.query(
          `SELECT * FROM public.ca_job_requisitions 
           WHERE LOWER(TRIM(position)) = LOWER(TRIM($1)) AND created_by_company_id = $2 
           ORDER BY id DESC LIMIT 1`,
          [targetRole, companyId]
        );
        reqRow = rows[0] || null;
      }
    } catch (e) {}

    // 6. Lookup Company details
    let company = {};
    try {
      const { rows: companyRows } = await db.query(
        `SELECT trade_name, legal_name, email, street, city, state, pin, contact_name, mobile 
         FROM public.companies WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      company = companyRows[0] || {};
      if (!company.trade_name) {
        const { rows: caCompRows } = await db.query(
          `SELECT name, legal_name, city, address FROM public.ca_companies WHERE id = $1 LIMIT 1`,
          [companyId]
        );
        if (caCompRows[0]) {
          company.trade_name = company.trade_name || caCompRows[0].name;
          company.legal_name = company.legal_name || caCompRows[0].legal_name || caCompRows[0].name;
          company.city = company.city || caCompRows[0].city;
        }
      }
    } catch (e) {}

    // 7. Assemble resolved offer with comprehensive data
    const resolvedCandidate =
      queryOffer?.candidate ||
      queryOffer?.candidateName ||
      offer?.candidate ||
      offer?.candidateName ||
      candidateRow?.name ||
      "Candidate";

    const resolvedRole =
      queryOffer?.role ||
      offer?.role ||
      candidateRow?.role ||
      reqRow?.position ||
      "HR Business Partner";

    const resolvedDepartment =
      queryOffer?.department ||
      offer?.department ||
      reqRow?.department ||
      "HR";

    const resolvedManager =
      queryOffer?.hiringManager ||
      queryOffer?.reportingManager ||
      offer?.hiringManager ||
      offer?.reportingManager ||
      reqRow?.hiring_manager ||
      "Gowri";

    const resolvedLocation =
      queryOffer?.location ||
      offer?.location ||
      candidateRow?.location ||
      reqRow?.location ||
      company.city ||
      "Chennai";

    const resolvedJoiningDate =
      queryOffer?.joiningDate ||
      offer?.joiningDate ||
      "28 Oct 2026";

    const resolvedCtc =
      queryOffer?.ctc ||
      offer?.ctc ||
      "₹96,000/mo";

    const resolvedBonus =
      queryOffer?.joiningBonus ||
      offer?.joiningBonus ||
      "₹1,20,000";

    const resolvedSentOn =
      offer?.sentOn ||
      queryOffer?.sentOn ||
      new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const enrichedOffer = {
      ...(offer || {}),
      candidate: resolvedCandidate,
      candidateName: resolvedCandidate,
      role: resolvedRole,
      ctc: resolvedCtc,
      joiningBonus: resolvedBonus,
      joiningDate: resolvedJoiningDate,
      location: resolvedLocation,
      department: resolvedDepartment,
      reportingManager: resolvedManager,
      hiringManager: resolvedManager,
      sentOn: resolvedSentOn,
      establishmentName: offer?.establishmentName || reqRow?.establishment_name || candidateRow?.establishment_name || "Standard Global - India Operations",
      signatoryName: offer?.signatoryName || "Director of HR",
      signatoryTitle: offer?.signatoryTitle || "Head of People Operations",
      hrName: company.contact_name || resolvedManager || "HR Department",
    };

    const resolvedCompany = {
      trade_name: company.trade_name || company.legal_name || "Standard Global",
      legal_name: company.legal_name || company.trade_name || "Standard Global Pte Ltd",
      street: company.street || "",
      city: company.city || resolvedLocation || "Chennai",
      state: company.state || "Tamil Nadu",
      pin: company.pin || "",
      contact_name: company.contact_name || resolvedManager || "HR Department",
    };

    const pdfBuffer = await generateOfferPdfBuffer(enrichedOffer, resolvedCompany);

    const safeName = resolvedCandidate
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    const filename = `Offer_Letter_${safeName}_${id || "draft"}.pdf`;

    return { pdfBuffer, filename };
  },

  async sendOffer(id, companyId, payload = {}) {
    let offer = null;
    if (id && Number(id) > 0) {
      offer = await caOffersRepository.findById(id, companyId);
    }

    if (!offer) {
      if (payload.candidate || payload.role) {
        offer = {
          id: id || 0,
          candidate: payload.candidate || payload.candidateName,
          candidateName: payload.candidateName || payload.candidate,
          candidateEmail: payload.email || payload.candidateEmail,
          role: payload.role,
          ctc: payload.ctc,
          joiningDate: payload.joiningDate,
          establishmentName: payload.establishmentName,
          signatoryName: payload.signatoryName,
          signatoryTitle: payload.signatoryTitle,
        };
      } else {
        throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
      }
    }

    const { pdfBuffer, filename } = await this.generatePdf(id, companyId, offer);

    const candidateEmail = payload.email || payload.candidateEmail || offer.email || offer.candidateEmail;
    const candidateName = offer.candidateName || offer.candidate || "Candidate";

    let emailSent = false;
    if (candidateEmail) {
      const { rows: companyRows } = await db.query(
        `SELECT trade_name, legal_name, contact_name FROM public.companies WHERE id = $1 LIMIT 1`,
        [companyId]
      );
      const company = companyRows[0] || {};
      const companyName = company.trade_name || company.legal_name || "iComply";

      // Generate candidate response token (valid for 30 days)
      const candidateToken = jwt.sign(
        {
          offerId: offer?.id ? Number(offer.id) : (id ? Number(id) : null),
          candidateId: offer?.candidateId ? Number(offer.candidateId) : null,
          companyId: companyId ? Number(companyId) : null,
          type: "candidate_offer_response",
          candidateEmail,
        },
        config.jwt.secret,
        { expiresIn: "30d" }
      );

      const backendBaseUrl = process.env.BACKEND_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/:\d+$/, "")}:${config.port}` : `http://localhost:${config.port}`);
      const acceptUrl = `${backendBaseUrl}/api/ca-offers/candidate-accept?token=${encodeURIComponent(candidateToken)}`;
      const rejectUrl = `${backendBaseUrl}/api/ca-offers/candidate-reject?token=${encodeURIComponent(candidateToken)}`;
      const pdfUrl = `${backendBaseUrl}/api/ca-offers/candidate-pdf?token=${encodeURIComponent(candidateToken)}`;

      const subject = `Official Job Offer: ${offer.role} at ${companyName}`;
      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="border-bottom: 2px solid #0c2340; padding-bottom: 12px; margin-bottom: 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: #059669;">Employment Offer</span>
                  <h2 style="color: #0c2340; margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">Offer of Employment</h2>
                </td>
                <td align="right" valign="top">
                  <span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;font-size:10px;font-weight:700;padding:4px 10px;border-radius:9999px;letter-spacing:0.5px;text-transform:uppercase;">
                    Official Offer
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${candidateName}</strong>,</p>
          <p style="font-size: 14px; color: #334155;">
            We are thrilled to officially extend an offer of employment to you for the position of <strong>${offer.role}</strong> at <strong>${companyName}</strong>!
          </p>
          <p style="font-size: 14px; color: #334155;">
            Please find attached your formal <strong>Offer Cum Appointment Letter</strong> containing the complete terms of employment, compensation breakdown, and joining instructions.
          </p>

          <div style="background-color: #f8fafc; border-left: 4px solid #0c2340; padding: 14px 18px; margin: 20px 0; border-radius: 6px; font-size: 13px;">
            <p style="margin: 0 0 7px 0;"><strong>Position:</strong> ${offer.role}</p>
            <p style="margin: 0 0 7px 0;"><strong>Annual CTC:</strong> <span style="color:#0c2340;font-weight:700;">${offer.ctc}</span></p>
            <p style="margin: 0 0 7px 0;"><strong>Location:</strong> ${offer.establishmentName || offer.location || "Corporate Office"}</p>
            <p style="margin: 0;"><strong>Proposed Joining Date:</strong> <span style="font-weight:700; color:#15803d;">${offer.joiningDate || "As discussed"}</span></p>
          </div>

          <div style="margin: 20px 0; text-align: center;">
            <a href="${pdfUrl}" target="_blank" style="display: inline-block; background-color: #f1f5f9; color: #0c2340; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none;">
              📄 Download / View Offer Letter (PDF)
            </a>
          </div>

          <p style="font-size: 14px; color: #334155; margin-bottom: 18px; text-align: center;">
            Please review the terms and confirm your response and Date of Joining (DOJ) below:
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
            <strong style="color: #334155;">${company?.contact_name || "Talent Acquisition Team"}</strong><br />
            ${companyName}
          </p>
        </div>
      `;

      try {
        emailSent = await sendMail({
          to: candidateEmail,
          subject,
          html,
          attachments: [
            {
              filename,
              content: pdfBuffer,
              contentType: "application/pdf"
            }
          ],
          fromName: companyName
        });
      } catch (err) {
        console.error("Failed to send offer email via SMTP:", err);
      }
    } else {
      console.warn(`No email found for candidate ${candidateName}, offer PDF generated.`);
    }

    if (id && Number(id) > 0) {
      const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      await caOffersRepository.update(id, companyId, {
        status: 'Sent',
        sentOn: offer.sentOn || todayStr,
        documentName: filename,
        documentUrl: `/api/ca-offers/${id}/pdf`
      });
    }

    // Step 5: Mark offer_release completed on candidate workflow
    const candId = offer.candidateId || id;
    if (candId && Number(candId) > 0) {
      try {
        await caCandidatesService.updateWorkflowStep(candId, companyId, {
          stageKey: "offer_release",
          status: "Completed",
        });
      } catch (e) {
        console.warn("Could not sync candidate offer_release stage:", e.message);
      }
    }

    return {
      success: true,
      emailSent,
      candidateEmail,
      filename,
      message: emailSent
        ? `Offer letter (${filename}) sent successfully to ${candidateEmail}`
        : `Offer letter (${filename}) ready and generated successfully.`
    };
  },

  async updateStatus(id, companyId, status, targetStage, payload = {}) {
    const updated = await caOffersRepository.updateStatus(id, companyId, status);
    if (!updated) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }

    // Step 4: When offer is approved, mark offer_approval completed and email HM to release offer
    if (status === 'Approved') {
      if (updated.candidateId) {
        try {
          await caCandidatesService.updateWorkflowStep(updated.candidateId, companyId, {
            stageKey: "offer_approval",
            status: "Completed",
          });
        } catch (e) {
          console.warn("Could not mark workflow step offer_approval:", e.message);
        }
      }
      void sendHiringManagerReleaseOfferRequest({
        candidateId: updated.candidateId,
        companyId,
      }).catch((e) => console.error("Failed to send HM release offer request:", e));
    }

    // Step 6: If accepted, sync candidate stage to 'Onboarding' (or specified stage) & create onboarding record with manager, company, establishment
    if (status === 'Accepted') {
      const nextStage = targetStage || 'Onboarding';
      const joiningDate = payload.joiningDate || updated.joiningDate;

      if (payload.joiningDate) {
        try {
          await db.query(
            `UPDATE public.ca_offers SET joining_date = $1, updated_at = NOW() WHERE id = $2 OR candidate_id = $3`,
            [payload.joiningDate, updated.id, updated.candidateId]
          );
          updated.joiningDate = payload.joiningDate;
        } catch (e) {
          console.warn("Could not update ca_offers joining_date:", e.message);
        }
      }

      if (updated.candidateId) {
        try {
          await caCandidatesService.updateStage(updated.candidateId, companyId, nextStage);
          await caCandidatesService.updateWorkflowStep(updated.candidateId, companyId, {
            stageKey: "offer_acceptance",
            status: "Completed",
            joiningDate,
          });
        } catch (e) {
          console.warn(`Could not sync candidate to ${nextStage}:`, e.message);
        }
      }
      await syncToOnboardingTable(updated, companyId, payload);

      // Trigger Step 6: HM revert email
      void sendHiringManagerOfferAcceptedRevert({
        candidateId: updated.candidateId,
        companyId,
        joiningDate,
      }).catch((e) => console.error("Failed to send HM revert email on offer acceptance:", e));
    }
    return updated;
  },

  async onboardCandidate(id, companyId, payload = {}) {
    const offer = await caOffersRepository.findById(id, companyId);
    if (!offer) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }

    const joiningDate = payload.joiningDate || offer.joiningDate;
    const updatedOffer = await caOffersRepository.update(id, companyId, {
      status: "Accepted",
      ...(joiningDate ? { joiningDate } : {}),
    });

    let updatedCandidate = null;
    if (offer.candidateId) {
      try {
        updatedCandidate = await caCandidatesService.updateStage(offer.candidateId, companyId, "Onboarding");
        await caCandidatesService.updateWorkflowStep(offer.candidateId, companyId, {
          stageKey: "offer_acceptance",
          status: "Completed",
          joiningDate,
        });
      } catch (e) {
        console.warn("Could not sync candidate to Onboarding:", e.message);
      }
    }

    // Upsert into public.ca_onboarding with manager, company, and establishment
    await syncToOnboardingTable(updatedOffer || offer, companyId, { joiningDate, ...payload });

    // Step 6: Send revert email to Hiring Manager
    void sendHiringManagerOfferAcceptedRevert({
      candidateId: offer.candidateId,
      companyId,
      joiningDate,
    }).catch((e) => console.error("Failed to send HM revert email on onboarding:", e));

    return {
      success: true,
      message: `Candidate ${offer.candidateName || ''} offer accepted and moved to Onboarding successfully with manager, company, and establishment.`,
      offer: updatedOffer,
      candidate: updatedCandidate,
    };
  },

  async update(id, companyId, payload) {
    const updated = await caOffersRepository.update(id, companyId, payload);
    if (!updated) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    if (payload.status === 'Accepted') {
      if (updated.candidateId) {
        try {
          await caCandidatesService.updateStage(updated.candidateId, companyId, 'Onboarding');
        } catch (e) {
          console.warn("Could not sync candidate to Onboarding:", e.message);
        }
      }
      await syncToOnboardingTable(updated, companyId, payload);
    }
    return updated;
  },

  async delete(id, companyId) {
    const deleted = await caOffersRepository.delete(id, companyId);
    if (!deleted) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    return true;
  },

  async getDocuments(id, companyId) {
    return caOffersRepository.getDocuments(id, companyId);
  },

  async updateDocuments(id, companyId, documents) {
    return caOffersRepository.updateDocuments(id, companyId, documents);
  },

  async publicApprove(token) {
    if (!token) {
      throw new AppError("Approval token is missing", 400);
    }
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Approval link is invalid or has expired", 400);
    }

    if (decoded?.type !== "offer_approval" || decoded?.action !== "approve") {
      throw new AppError("Invalid approval token", 400);
    }

    const { candidateId, offerId, companyId } = decoded;

    let offer = null;
    if (offerId) {
      offer = await caOffersRepository.findById(offerId, companyId);
    }
    if (!offer && candidateId) {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
        [Number(candidateId)]
      );
      if (rows[0]) offer = mapCAOffer(rows[0]);
    }

    const candidate = await caCandidatesRepository.findById(candidateId, companyId);

    if (offer && offer.approvalStatus === "Approved") {
      return { status: "already_approved", candidate, offer };
    }

    // 1. Update ca_offers
    if (offer?.id || candidateId) {
      try {
        await db.query(
          `UPDATE public.ca_offers 
           SET approval_status = 'Approved', status = 'Approved', updated_at = NOW() 
           WHERE (id = $1 OR candidate_id = $2) AND (created_by_company_id = $3 OR created_by_company_id IS NULL OR $3 IS NULL)`,
          [offer?.id || null, Number(candidateId), companyId ? Number(companyId) : null]
        );
      } catch (e) {
        console.warn("Could not update ca_offers on public approve:", e.message);
      }
    }

    // 2. Update candidate workflow step offer_approval to Completed
    if (candidateId) {
      try {
        await caCandidatesRepository.updateWorkflowStep(candidateId, companyId, {
          stageKey: "offer_approval",
          status: "Completed",
          date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        });
      } catch (e) {
        console.warn("Could not update workflow step on public approve:", e.message);
      }

      // Step 4 Notification: Send email to Hiring Manager to release offer
      void sendHiringManagerReleaseOfferRequest({
        candidateId,
        companyId,
      }).catch((e) => console.error("Failed to send HM release offer email:", e));
    }

    const refreshedOffer = offer?.id ? await caOffersRepository.findById(offer.id, companyId) : offer;
    const refreshedCandidate = candidateId ? await caCandidatesRepository.findById(candidateId, companyId) : candidate;

    return { status: "approved", candidate: refreshedCandidate, offer: refreshedOffer };
  },

  async publicReject(token) {
    if (!token) {
      throw new AppError("Token is missing", 400);
    }
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Link is invalid or has expired", 400);
    }

    if (decoded?.type !== "offer_approval" || decoded?.action !== "reject") {
      throw new AppError("Invalid token", 400);
    }

    const { candidateId, offerId, companyId } = decoded;

    let offer = null;
    if (offerId) {
      offer = await caOffersRepository.findById(offerId, companyId);
    }
    if (!offer && candidateId) {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
        [Number(candidateId)]
      );
      if (rows[0]) offer = mapCAOffer(rows[0]);
    }

    const candidate = await caCandidatesRepository.findById(candidateId, companyId);

    if (offer && offer.approvalStatus === "Rejected") {
      return { status: "already_rejected", candidate, offer };
    }

    if (offer?.id || candidateId) {
      try {
        await db.query(
          `UPDATE public.ca_offers 
           SET approval_status = 'Rejected', status = 'Rejected', updated_at = NOW() 
           WHERE (id = $1 OR candidate_id = $2) AND (created_by_company_id = $3 OR created_by_company_id IS NULL OR $3 IS NULL)`,
          [offer?.id || null, Number(candidateId), companyId ? Number(companyId) : null]
        );
      } catch (e) {
        console.warn("Could not update ca_offers on public reject:", e.message);
      }
    }

    if (candidateId) {
      try {
        await db.query(
          `UPDATE public.ca_candidates 
           SET notes = COALESCE(notes, '[]'::jsonb) || $1::jsonb, updated_at = NOW() 
           WHERE id = $2`,
          [
            JSON.stringify([{
              date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
              text: "Offer was rejected by the Approver via email",
              author: "Approver",
            }]),
            Number(candidateId)
          ]
        );
      } catch (e) {}
    }

    const refreshedOffer = offer?.id ? await caOffersRepository.findById(offer.id, companyId) : offer;
    const refreshedCandidate = candidateId ? await caCandidatesRepository.findById(candidateId, companyId) : candidate;

    return { status: "rejected", candidate: refreshedCandidate, offer: refreshedOffer };
  },

  async publicPdf(token) {
    if (!token) throw new AppError("Token is missing", 400);
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Link is invalid or has expired", 400);
    }
    const { candidateId, offerId, companyId } = decoded;
    return await this.generatePdf(offerId || 0, companyId, { candidateId });
  },

  async candidateGetOfferDetails(token) {
    if (!token) {
      throw new AppError("Offer response link is missing token", 400);
    }
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Offer link is invalid or has expired", 400);
    }

    if (decoded?.type !== "candidate_offer_response") {
      throw new AppError("Invalid offer response token", 400);
    }

    const { candidateId, offerId, companyId } = decoded;

    let offer = null;
    if (offerId && Number(offerId) > 0) {
      offer = await caOffersRepository.findById(offerId, companyId);
    }
    if (!offer && candidateId) {
      const { rows } = await db.query(
        `SELECT * FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
        [Number(candidateId)]
      );
      if (rows[0]) offer = mapCAOffer(rows[0]);
    }

    if (!offer) {
      throw new AppError("Offer details could not be found", 404);
    }

    const candidate = candidateId
      ? await caCandidatesRepository.findById(candidateId, companyId)
      : null;

    const { rows: compRows } = await db.query(
      `SELECT id, trade_name, legal_name, contact_name, email FROM public.companies WHERE id = $1 LIMIT 1`,
      [companyId || offer.createdByCompanyId]
    );
    const company = compRows[0] || {};

    return { offer, candidate, company, decoded };
  },

  async candidateAcceptOffer(token, rawJoiningDate, remarks = "") {
    const { offer, candidate, company, decoded } = await this.candidateGetOfferDetails(token);
    const companyId = decoded.companyId || offer.createdByCompanyId;
    const candId = decoded.candidateId || offer.candidateId;
    const offerId = offer.id || decoded.offerId;

    if (offer.status === "Accepted") {
      return { status: "already_accepted", candidate, offer, joiningDate: offer.joiningDate };
    }

    // Format DOJ into 'DD Mon YYYY'
    let formattedDoj = offer.joiningDate || "As discussed";
    if (rawJoiningDate) {
      const parts = String(rawJoiningDate).split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        formattedDoj = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      } else {
        const d = new Date(rawJoiningDate);
        if (!isNaN(d.getTime())) {
          formattedDoj = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        } else {
          formattedDoj = rawJoiningDate;
        }
      }
    }

    // 1. Update ca_offers: status = 'Accepted', joining_date = formattedDoj
    if (offerId || candId) {
      try {
        await db.query(
          `UPDATE public.ca_offers 
           SET status = 'Accepted', joining_date = $1, updated_at = NOW() 
           WHERE (id = $2 OR candidate_id = $3) AND (created_by_company_id = $4 OR created_by_company_id IS NULL OR $4 IS NULL)`,
          [formattedDoj, offerId || null, candId ? Number(candId) : null, companyId ? Number(companyId) : null]
        );
      } catch (e) {
        console.warn("Could not update ca_offers on candidate accept:", e.message);
      }
    }

    // 2. Append note to candidate history
    const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (candId) {
      try {
        const noteText = `Offer accepted by candidate via email portal. Confirmed Date of Joining (DOJ): ${formattedDoj}.${remarks ? ` Candidate remarks: "${remarks}"` : ""}`;
        await db.query(
          `UPDATE public.ca_candidates 
           SET notes = COALESCE(notes, '[]'::jsonb) || $1::jsonb, updated_at = NOW() 
           WHERE id = $2`,
          [
            JSON.stringify([{
              date: todayStr,
              text: noteText,
              author: "Candidate",
            }]),
            Number(candId)
          ]
        );
      } catch (e) {
        console.warn("Could not append candidate acceptance note:", e.message);
      }
    }

    // 3. Move candidate to Onboarding stage and trigger onboarding sync & HM revert email
    try {
      await this.updateStatus(offerId || candId, companyId, "Accepted", "Onboarding", {
        joiningDate: formattedDoj,
        remarks,
      });
    } catch (e) {
      console.warn("Could not execute updateStatus on candidate accept:", e.message);
    }

    const refreshedOffer = offerId ? await caOffersRepository.findById(offerId, companyId) : offer;
    const refreshedCandidate = candId ? await caCandidatesRepository.findById(candId, companyId) : candidate;

    return {
      status: "accepted",
      candidate: refreshedCandidate,
      offer: refreshedOffer,
      joiningDate: formattedDoj,
    };
  },

  async candidateRejectOffer(token, reason = "", remarks = "") {
    const { offer, candidate, company, decoded } = await this.candidateGetOfferDetails(token);
    const companyId = decoded.companyId || offer.createdByCompanyId;
    const candId = decoded.candidateId || offer.candidateId;
    const offerId = offer.id || decoded.offerId;

    if (offer.status === "Rejected" || offer.status === "Declined") {
      return { status: "already_rejected", candidate, offer };
    }

    // 1. Update ca_offers status = 'Declined'
    if (offerId || candId) {
      try {
        await db.query(
          `UPDATE public.ca_offers 
           SET status = 'Declined', updated_at = NOW() 
           WHERE (id = $1 OR candidate_id = $2) AND (created_by_company_id = $3 OR created_by_company_id IS NULL OR $3 IS NULL)`,
          [offerId || null, candId ? Number(candId) : null, companyId ? Number(companyId) : null]
        );
      } catch (e) {
        console.warn("Could not update ca_offers on candidate decline:", e.message);
      }
    }

    // 2. Append decline note to candidate
    const todayStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    if (candId) {
      try {
        const declineDetails = `Candidate declined offer.${reason ? ` Reason: ${reason}.` : ""}${remarks ? ` Remarks: "${remarks}".` : ""}`;
        await db.query(
          `UPDATE public.ca_candidates 
           SET notes = COALESCE(notes, '[]'::jsonb) || $1::jsonb, updated_at = NOW() 
           WHERE id = $2`,
          [
            JSON.stringify([{
              date: todayStr,
              text: declineDetails,
              author: "Candidate",
            }]),
            Number(candId)
          ]
        );
      } catch (e) {
        console.warn("Could not append decline note to candidate:", e.message);
      }
    }

    const refreshedOffer = offerId ? await caOffersRepository.findById(offerId, companyId) : offer;
    const refreshedCandidate = candId ? await caCandidatesRepository.findById(candId, companyId) : candidate;

    return { status: "rejected", candidate: refreshedCandidate, offer: refreshedOffer };
  },

  async candidatePdf(token) {
    if (!token) throw new AppError("Token is missing", 400);
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Link is invalid or has expired", 400);
    }
    const { candidateId, offerId, companyId } = decoded;
    return await this.generatePdf(offerId || 0, companyId, { candidateId });
  }
};
