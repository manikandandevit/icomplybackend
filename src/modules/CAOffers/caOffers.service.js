import { caOffersRepository } from "./caOffers.repository.js";
import { caCandidatesService } from "../CACandidates/caCandidates.service.js";
import { generateOfferPdfBuffer } from "./caOffers.pdf.js";
import { sendMail } from "../../core/mail/mailer.js";
import { AppError } from "../../core/errors/AppError.js";

export const caOffersService = {
  async list(companyId, filter = {}) {
    return caOffersRepository.list(companyId, filter);
  },

  async getById(id, companyId) {
    return caOffersRepository.findById(id, companyId);
  },

  async generatePdf(id, companyId, queryOffer = null) {
    let offer = null;
    if (id && Number(id) > 0) {
      offer = await caOffersRepository.findById(id, companyId);
    }

    if (!offer) {
      if (queryOffer && (queryOffer.candidate || queryOffer.role)) {
        offer = {
          candidate: queryOffer.candidate || queryOffer.candidateName || "Candidate",
          role: queryOffer.role || "Software Engineer",
          ctc: queryOffer.ctc || "₹96,000/mo",
          joiningBonus: queryOffer.joiningBonus || "₹1,20,000",
          joiningDate: queryOffer.joiningDate || "01 Oct 2026",
          sentOn: queryOffer.sentOn || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          location: queryOffer.location || "Madurai",
          department: queryOffer.department || "Engineering",
          reportingManager: queryOffer.reportingManager || "Engineering Manager",
          email: queryOffer.email || null,
        };
      } else {
        offer = {
          candidate: "Candidate Name",
          role: "Designation",
          ctc: "₹96,000/mo",
          joiningBonus: "₹1,20,000",
          joiningDate: "01 Oct 2026",
          sentOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          location: "Madurai",
          department: "Engineering",
          reportingManager: "Reporting Manager",
        };
      }
    }

    const company = await caOffersRepository.findCompanyById(companyId);
    const pdfBuffer = await generateOfferPdfBuffer(offer, company || {});
    const candidateName = (offer.candidate || offer.candidateName || "Candidate").trim();
    const filename = `Offer_Letter_${candidateName.replace(/\s+/g, "_")}.pdf`;

    return { pdfBuffer, filename, offer };
  },

  async create(companyId, payload) {
    const offer = await caOffersRepository.create(companyId, payload);
    const targetCandidateId = payload.candidateId || offer?.candidateId;
    // If created with candidateId and not already Hired, update candidate stage to 'Offer'
    if (targetCandidateId) {
      try {
        const candidate = await caCandidatesService.getById(targetCandidateId, companyId);
        if (candidate?.stage !== 'Hired') {
          await caCandidatesService.updateStage(targetCandidateId, companyId, 'Offer');
        }
      } catch (e) {
        console.warn("Could not sync candidate stage to Offer:", e.message);
      }
    }

    // Auto send offer email if requested or if candidate has email
    if (payload.sendNow || payload.sendEmail) {
      try {
        await this.sendOffer(offer.id, companyId, { to: payload.email });
      } catch (e) {
        console.warn("Could not send offer email automatically:", e.message);
      }
    }

    return offer;
  },

  async sendOffer(id, companyId, options = {}) {
    const { pdfBuffer, filename, offer } = await this.generatePdf(id, companyId, options.offer);
    const company = await caOffersRepository.findCompanyById(companyId);
    const companyName = company?.trade_name || company?.legal_name || "iComply Technologies";

    const candidateEmail = options.to || offer.email;
    const candidateName = offer.candidate || offer.candidateName || "Candidate";

    let emailSent = false;
    if (candidateEmail) {
      const subject = `Job Offer: ${offer.role} - ${companyName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0c2340; margin-bottom: 16px;">Congratulations, ${candidateName}!</h2>
          <p>We are pleased to extend an offer of employment for the position of <strong>${offer.role}</strong> at <strong>${companyName}</strong>.</p>
          <p>Please find attached your formal <strong>Offer Cum Appointment Letter</strong> containing the complete terms of employment, compensation breakdown, and joining instructions.</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0c2340; padding: 12px 16px; margin: 20px 0;">
            <p style="margin: 0 0 6px 0;"><strong>Position:</strong> ${offer.role}</p>
            <p style="margin: 0 0 6px 0;"><strong>Annual CTC:</strong> ${offer.ctc}</p>
            <p style="margin: 0;"><strong>Joining Date:</strong> ${offer.joiningDate || "As discussed"}</p>
          </div>
          <p>Please review the attached PDF, sign the employee acceptance copy, and return it to us.</p>
          <p style="margin-top: 24px;">Warm regards,<br /><strong>${company?.contact_name || "HR Department"}</strong><br />${companyName}</p>
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
        sentOn: offer.sentOn || todayStr,
        documentName: filename,
        documentUrl: `/api/ca-offers/${id}/pdf`
      });
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

  async updateStatus(id, companyId, status) {
    const updated = await caOffersRepository.updateStatus(id, companyId, status);
    if (!updated) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
    }
    // If accepted, optionally update candidate stage to 'Hired'
    if (status === 'Accepted' && updated.candidateId) {
      try {
        await caCandidatesService.updateStage(updated.candidateId, companyId, 'Hired');
      } catch (e) {
        console.warn("Could not sync candidate to Hired:", e.message);
      }
    }
    return updated;
  },

  async update(id, companyId, payload) {
    const updated = await caOffersRepository.update(id, companyId, payload);
    if (!updated) {
      throw new AppError("Offer not found or unauthorized", 404, "NOT_FOUND");
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
  }
};
