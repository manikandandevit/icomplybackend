import { caCandidatesRepository } from "./caCandidates.repository.js";
import { caCandidatesStorage } from "./caCandidates.storage.js";
import { generateCandidatePdfBuffer } from "./caCandidates.pdf.js";
import { AppError } from "../../core/errors/AppError.js";
import { sendInterviewFeedbackEmail, sendInterviewShortlistedEmail } from "../CAInterviews/caInterviews.email.js";
import {
  sendCandidateWelcomeEmail,
  sendCandidateShortlistedEmail,
  sendCandidateRejectionEmail,
} from "./caCandidates.email.js";
import { db } from "../../core/db/pool.js";
import {
  sendCandidateSelectionEmail,
  sendHiringManagerDocumentCollectionRequest,
  sendHiringManagerGenerateOfferRequest,
  sendApproverOfferReviewRequest,
  sendHiringManagerReleaseOfferRequest,
  sendCandidateOfferReleaseNotification,
  sendHiringManagerOfferAcceptedRevert,
} from "./caWorkflow.email.js";

export const caCandidatesService = {
  async list(companyId, filter = {}) {
    return caCandidatesRepository.list(companyId, filter);
  },

  async getById(id, companyId) {
    const candidate = await caCandidatesRepository.findById(id, companyId);
    if (!candidate) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }
    return candidate;
  },

  async getTimeline(id, companyId) {
    const result = await caCandidatesRepository.getTimeline(id, companyId);
    if (!result) {
      throw new AppError("Candidate timeline not found or unauthorized", 404, "NOT_FOUND");
    }
    return result;
  },

  async create(companyId, payload) {
    if (payload?.role) {
      const { rows: approvedReqs } = await db.query(
        `SELECT id, position FROM public.ca_job_requisitions 
         WHERE created_by_company_id = $1 
           AND LOWER(TRIM(approval_status)) = 'approved'`,
        [companyId]
      );

      const hasMatchingApproval = approvedReqs.some(
        (r) => String(r.position || "").trim().toLowerCase() === String(payload.role || "").trim().toLowerCase()
      );

      if (!hasMatchingApproval) {
        throw new AppError(
          `Cannot add candidate: Position "${payload.role}" does not have an approved job requisition. Candidate details can only be uploaded for approved positions.`,
          400,
          "REQUISITION_NOT_APPROVED"
        );
      }
    }

    const candidate = await caCandidatesRepository.create(companyId, payload);
    if (candidate?.email) {
      void sendCandidateWelcomeEmail({ candidate, companyId }).catch((err) => {
        console.error("Failed to send candidate welcome email on create:", err.message);
      });
    }
    return candidate;
  },

  async update(id, companyId, payload) {
    let wasAlreadyRejected = false;
    let wasAlreadySelected = false;
    let prev = null;
    try {
      prev = await caCandidatesRepository.findById(id, companyId);
      wasAlreadyRejected = (prev?.stage === "Rejected") || Boolean(prev?.rejectionEmailSentAt);
      wasAlreadySelected = (prev?.stage === "Selected") || Boolean(prev?.selectionEmailSentAt);
    } catch {}

    const updated = await caCandidatesRepository.update(id, companyId, payload);
    if (!updated) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }

    // Reset rejection/selection timestamps if candidate moves out of those states
    if (prev?.stage === "Rejected" && payload?.stage && payload.stage !== "Rejected") {
      await db.query(`UPDATE public.ca_candidates SET rejection_email_sent_at = NULL WHERE id = $1`, [id]).catch(() => {});
    }
    if (prev?.stage === "Selected" && payload?.stage && payload.stage !== "Selected") {
      await db.query(`UPDATE public.ca_candidates SET selection_email_sent_at = NULL WHERE id = $1`, [id]).catch(() => {});
    }

    if (payload?.stage === "Shortlisted") {
      void sendCandidateShortlistedEmail({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send candidate shortlisted email on update:", e)
      );
    } else if (payload?.stage === "Selected" && !wasAlreadySelected) {
      void sendCandidateSelectionEmail({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send candidate selection email on update:", e)
      );
      void sendHiringManagerDocumentCollectionRequest({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send HM doc collection email on update:", e)
      );
    } else if (payload?.stage === "Rejected" && !wasAlreadyRejected) {
      void sendCandidateRejectionEmail({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send candidate rejection email on update:", e)
      );
    } else if (payload?.stage && (payload.stage.toLowerCase().includes("round") || payload.stage === "Interview") && payload.stage !== prev?.stage) {
      try {
        const { rows: intRows } = await db.query(
          `SELECT id FROM public.ca_interviews 
           WHERE candidate_id = $1 AND (created_by_company_id = $2 OR $2 IS NULL) 
           ORDER BY id DESC LIMIT 1`,
          [id, companyId]
        );
        if (intRows[0]?.id) {
          void sendInterviewShortlistedEmail({
            candidateId: id,
            interviewId: intRows[0].id,
            companyId,
            roundName: payload.stage,
          }).catch((e) => console.error("Failed to trigger interview email on update:", e));
        }
      } catch (e) {}
    }

    return updated;
  },

  async updateStage(id, companyId, stage, assessmentCount) {
    let wasAlreadyRejected = false;
    let wasAlreadySelected = false;
    let prevStage = null;
    try {
      const prev = await caCandidatesRepository.findById(id, companyId);
      prevStage = prev?.stage;
      wasAlreadyRejected = (prevStage === "Rejected") || Boolean(prev?.rejectionEmailSentAt);
      wasAlreadySelected = (prevStage === "Selected") || Boolean(prev?.selectionEmailSentAt);
    } catch {}

    const updated = await caCandidatesRepository.updateStage(id, companyId, stage, assessmentCount);
    if (!updated) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }

    // If candidate was previously rejected and is now re-opened into an active stage, reset rejection timestamp
    if (prevStage === "Rejected" && stage !== "Rejected") {
      await db.query(`UPDATE public.ca_candidates SET rejection_email_sent_at = NULL WHERE id = $1`, [id]).catch(() => {});
    }

    // If candidate was previously selected and is now moved to another stage, reset selection timestamp
    if (prevStage === "Selected" && stage !== "Selected") {
      await db.query(`UPDATE public.ca_candidates SET selection_email_sent_at = NULL WHERE id = $1`, [id]).catch(() => {});
    }

    // When candidate is shortlisted for the interview process
    if (stage === "Shortlisted") {
      void sendCandidateShortlistedEmail({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send candidate shortlisted email on updateStage:", e)
      );
    } else if (stage === "Rejected" && !wasAlreadyRejected) {
      void sendCandidateRejectionEmail({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send candidate rejection email on updateStage:", e)
      );
    }

    // When candidate stage is moved to an interview round (e.g. "Round 2: Technical interview")
    if (stage && (stage.toLowerCase().includes("round") || stage === "Interview") && stage !== prevStage) {
      try {
        const { rows: intRows } = await db.query(
          `SELECT id FROM public.ca_interviews 
           WHERE candidate_id = $1 AND (created_by_company_id = $2 OR $2 IS NULL) 
           ORDER BY id DESC LIMIT 1`,
          [id, companyId]
        );
        if (intRows[0]?.id) {
          void sendInterviewShortlistedEmail({
            candidateId: id,
            interviewId: intRows[0].id,
            companyId,
            roundName: stage,
          }).catch((e) => console.error("Failed to trigger interview email on stage update:", e));
        }
      } catch (e) {
        console.warn("Could not check interview for stage update:", e.message);
      }
    }

    // Step 1: When candidate stage moves to "Selected", trigger candidate selection mail + hiring manager doc collection mail
    if (stage === "Selected" && !wasAlreadySelected) {
      void sendCandidateSelectionEmail({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send candidate selection email on updateStage:", e)
      );
      void sendHiringManagerDocumentCollectionRequest({ candidateId: id, companyId }).catch((e) =>
        console.error("Failed to send HM doc collection email on updateStage:", e)
      );
    }

    return updated;
  },

  async addNote(id, companyId, text) {
    const updated = await caCandidatesRepository.addNote(id, companyId, text);
    if (!updated) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }
    return updated;
  },

  async updateWorkflowStep(id, companyId, payload = {}) {
    const result = await caCandidatesRepository.updateWorkflowStep(id, companyId, payload);
    const { stageKey, status, joiningDate } = payload;

    if (status === "Completed") {
      // Step 2: Document collection marked done -> Mail to Hiring Manager to generate offer
      if (stageKey === "document_collection") {
        void sendHiringManagerGenerateOfferRequest({ candidateId: id, companyId }).catch((e) =>
          console.error("Failed to send HM generate offer email:", e)
        );
      }

      // Step 3: Offer generated marked done -> Mail to Approver to verify and approve
      else if (stageKey === "offer_generated") {
        void sendApproverOfferReviewRequest({ candidateId: id, companyId }).catch((e) =>
          console.error("Failed to send approver review request email:", e)
        );
      }

      // Step 4: Offer approval marked done -> Mail to Hiring Manager to release offer
      else if (stageKey === "offer_approval") {
        try {
          await db.query(
            `UPDATE public.ca_offers SET approval_status = 'Approved', status = 'Approved', updated_at = NOW() 
             WHERE candidate_id = $1 AND (created_by_company_id = $2 OR created_by_company_id IS NULL)`,
            [Number(id), companyId]
          );
        } catch (e) {
          console.warn("Could not sync ca_offers approval_status in DB:", e.message);
        }

        void sendHiringManagerReleaseOfferRequest({ candidateId: id, companyId }).catch((e) =>
          console.error("Failed to send HM release offer email:", e)
        );
      }

      // Step 5: Offer release marked done -> Mail to Candidate with formal offer
      else if (stageKey === "offer_release") {
        try {
          await db.query(
            `UPDATE public.ca_offers SET status = 'Sent', sent_on = COALESCE(sent_on, TO_CHAR(NOW(), 'DD Mon YYYY')), updated_at = NOW() 
             WHERE candidate_id = $1 AND (created_by_company_id = $2 OR created_by_company_id IS NULL)`,
            [Number(id), companyId]
          );
        } catch (e) {
          console.warn("Could not sync ca_offers status to Sent in DB:", e.message);
        }

        void sendCandidateOfferReleaseNotification({ candidateId: id, companyId }).catch((e) =>
          console.error("Failed to send candidate offer release email:", e)
        );
      }

      // Step 6: Offer acceptance & DOJ confirmed -> Revert mail to Hiring Manager
      else if (stageKey === "offer_acceptance") {
        let finalDoj = joiningDate || payload.joiningDate;
        if (!finalDoj) {
          try {
            const { rows } = await db.query(
              `SELECT joining_date FROM public.ca_offers WHERE candidate_id = $1 ORDER BY id DESC LIMIT 1`,
              [Number(id)]
            );
            if (rows[0]?.joining_date) {
              finalDoj = rows[0].joining_date;
            }
          } catch (e) {}
        }
        if (!finalDoj && payload.date) {
          finalDoj = payload.date;
        }
        try {
          if (finalDoj) {
            await db.query(
              `UPDATE public.ca_offers SET status = 'Accepted', joining_date = $1, updated_at = NOW() 
               WHERE candidate_id = $2 AND (created_by_company_id = $3 OR created_by_company_id IS NULL)`,
              [finalDoj, Number(id), companyId]
            );
          }
        } catch (e) {
          console.warn("Could not sync ca_offers joining_date on acceptance in DB:", e.message);
        }

        void sendHiringManagerOfferAcceptedRevert({
          candidateId: id,
          companyId,
          joiningDate: finalDoj,
        }).catch((e) => console.error("Failed to send HM revert email on offer acceptance:", e));
      }
    }

    return result;
  },

  async updateOutcomeStatus(id, companyId, payload = {}) {
    const { outcomeStatus, statusReason, candidateEmail, candidateName, role } = payload;
    const candidate = await caCandidatesRepository.updateOutcomeStatus(id, companyId, outcomeStatus, statusReason);

    if (outcomeStatus === "Selected") {
      // Step 1: Candidate is "Selected" in interview
      // 1A. Candidate selection mail
      void sendCandidateSelectionEmail({
        candidateId: id,
        companyId,
        candidateEmail: candidateEmail || candidate?.email,
        candidateName: candidateName || candidate?.name,
        role: role || candidate?.role,
      }).catch((e) => console.error("Failed to send candidate selection email:", e));

      // 1B. At the same time, Hiring Manager document collection request mail
      void sendHiringManagerDocumentCollectionRequest({
        candidateId: id,
        companyId,
      }).catch((e) => console.error("Failed to send HM document collection email:", e));
    } else if (outcomeStatus === "Rejected") {
      void sendCandidateRejectionEmail({
        candidateId: id,
        companyId,
        candidateEmail: candidateEmail || candidate?.email,
        candidateName: candidateName || candidate?.name,
        role: role || candidate?.role,
      }).catch((e) => console.error("Failed to trigger rejection email on updateOutcomeStatus:", e));
    } else if (outcomeStatus) {
      // For other outcomes (On Hold, No Show, etc.), send standard interview outcome feedback
      void sendInterviewFeedbackEmail({
        candidateId: id,
        companyId,
        outcomeStatus,
        statusReason,
        candidateEmail: candidateEmail || candidate?.email,
        candidateName: candidateName || candidate?.name,
        role: role || candidate?.role,
      }).catch((e) => console.error("Failed to trigger outcome status email:", e));
    }

    return candidate;
  },

  async delete(id, companyId) {
    const deleted = await caCandidatesRepository.delete(id, companyId);
    if (!deleted) {
      throw new AppError("Candidate not found or unauthorized", 404, "NOT_FOUND");
    }
    return true;
  },

  async uploadResume(companyId, file, candidateId) {
    const uploaded = await caCandidatesStorage.upload(file);
    if (candidateId) {
      await caCandidatesRepository.update(candidateId, companyId, {
        resumeUrl: uploaded.url,
        resumeName: uploaded.name,
      });
    }
    return uploaded;
  },

  async getResume(id, companyId) {
    const candidate = await caCandidatesRepository.findById(id, companyId);
    if (!candidate) {
      throw new AppError("Candidate not found", 404, "NOT_FOUND");
    }

    const cleanFilename = (candidate.resumeName || `${(candidate.name || "Candidate").replace(/\s+/g, "_")}_Resume.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");

    // Case 1: Base64 data URL
    if (candidate.resumeUrl && candidate.resumeUrl.startsWith("data:")) {
      const match = candidate.resumeUrl.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.+)$/s);
      if (match) {
        const contentType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        return {
          buffer,
          contentType,
          filename: cleanFilename,
        };
      }
    }

    // Case 2: S3 key or S3 URL
    if (candidate.resumeUrl && (candidate.resumeUrl.includes("candidate-resumes/") || candidate.resumeUrl.startsWith("candidate-resumes/"))) {
      const keyMatch = candidate.resumeUrl.match(/candidate-resumes\/[^\s?#]+/);
      const key = keyMatch ? keyMatch[0] : candidate.resumeUrl;
      const s3Res = await caCandidatesStorage.get(key);
      if (s3Res && s3Res.stream) {
        return {
          stream: s3Res.stream,
          contentType: s3Res.contentType || "application/pdf",
          filename: cleanFilename,
        };
      }
    }

    // Case 3: Public HTTP URL
    if (candidate.resumeUrl && candidate.resumeUrl.startsWith("http")) {
      return {
        redirectUrl: candidate.resumeUrl,
        filename: cleanFilename,
      };
    }

    // Case 4: No resume uploaded yet -> Generate an executive candidate profile PDF
    const pdfBuffer = await generateCandidatePdfBuffer(candidate);
    return {
      buffer: pdfBuffer,
      contentType: "application/pdf",
      filename: `${(candidate.name || "Candidate").replace(/\s+/g, "_")}_Resume.pdf`,
    };
  },

  async getDocuments(id, companyId) {
    return caCandidatesRepository.getDocuments(id, companyId);
  },

  async updateDocuments(id, companyId, documents) {
    return caCandidatesRepository.updateDocuments(id, companyId, documents);
  },

  async updateChecklist(id, companyId, checklist) {
    return caCandidatesRepository.updateChecklist(id, companyId, checklist);
  },
};
