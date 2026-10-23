import { config } from "../../config/index.js";
import { success, fail } from "../../core/utils/response.js";
import { caOffersService } from "./caOffers.service.js";
import {
  renderOfferApprovalSuccessPage,
  renderOfferAlreadyProcessedPage,
  renderOfferRejectionSuccessPage,
  renderOfferErrorPage,
  renderCandidateOfferAcceptancePage,
  renderCandidateOfferAcceptedSuccessPage,
  renderCandidateOfferDeclinePage,
  renderCandidateOfferDeclinedSuccessPage,
} from "./caOffers.views.js";

export const caOffersController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { status } = req.query;
      const offers = await caOffersService.list(companyId, status ? { status } : {});
      return success(res, { data: { offers } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const offer = await caOffersService.getById(id, companyId);
      if (!offer) {
        return fail(res, { message: "Offer not found", status: 404 });
      }
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const offer = await caOffersService.create(companyId, req.body);
      return success(res, { data: { offer }, status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async getPdf(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const { pdfBuffer, filename } = await caOffersService.generatePdf(id, companyId, req.query);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },

  async sendOffer(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const result = await caOffersService.sendOffer(id, companyId, req.body);
      return success(res, { data: result, message: result.message });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const { status, stage } = req.body;
      const offer = await caOffersService.updateStatus(id, companyId, status, stage);
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async onboardCandidate(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const result = await caOffersService.onboardCandidate(id, companyId, req.body);
      return success(res, { data: result, message: result.message });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const offer = await caOffersService.update(id, companyId, req.body);
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      await caOffersService.delete(id, companyId);
      return success(res, { message: "Offer deleted successfully" });
    } catch (err) {
      next(err);
    }
  },

  async getDocuments(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const documents = await caOffersService.getDocuments(id, companyId);
      return success(res, { data: { documents } });
    } catch (err) {
      next(err);
    }
  },

  async updateDocuments(req, res, next) {
    try {
      const companyId = req.companyId || req.user?.companyId;
      const { id } = req.params;
      const { documents } = req.body;
      const offer = await caOffersService.updateDocuments(id, companyId, documents);
      return success(res, { data: { offer, documents: offer?.documents || documents }, message: "Documents saved successfully" });
    } catch (err) {
      next(err);
    }
  },

  async publicApprove(req, res) {
    try {
      const result = await caOffersService.publicApprove(req.query.token);
      if (result.status === "already_approved") {
        return res.send(renderOfferAlreadyProcessedPage(result.candidate, result.offer, "Approved"));
      }
      return res.send(renderOfferApprovalSuccessPage(result.candidate, result.offer));
    } catch (error) {
      return res.status(400).send(renderOfferErrorPage(error.message));
    }
  },

  async publicReject(req, res) {
    try {
      const result = await caOffersService.publicReject(req.query.token);
      if (result.status === "already_rejected") {
        return res.send(renderOfferAlreadyProcessedPage(result.candidate, result.offer, "Rejected"));
      }
      return res.send(renderOfferRejectionSuccessPage(result.candidate, result.offer));
    } catch (error) {
      return res.status(400).send(renderOfferErrorPage(error.message));
    }
  },

  async publicPdf(req, res, next) {
    try {
      const { pdfBuffer, filename } = await caOffersService.publicPdf(req.query.token);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (err) {
      return res.status(400).send(renderOfferErrorPage(err.message));
    }
  },

  async candidateAcceptPage(req, res) {
    try {
      const token = req.query.token;
      const { offer, candidate, company } = await caOffersService.candidateGetOfferDetails(token);

      const backendBaseUrl = process.env.BACKEND_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/:\d+$/, "")}:${config.port}` : `http://localhost:${config.port}`);
      const acceptSubmitUrl = `${backendBaseUrl}/api/ca-offers/candidate-accept`;
      const rejectUrl = `${backendBaseUrl}/api/ca-offers/candidate-reject?token=${encodeURIComponent(token)}`;
      const pdfUrl = `${backendBaseUrl}/api/ca-offers/candidate-pdf?token=${encodeURIComponent(token)}`;

      if (offer.status === "Accepted") {
        return res.send(renderCandidateOfferAcceptedSuccessPage({
          candidate,
          offer,
          joiningDate: offer.joiningDate,
          pdfUrl,
        }));
      }

      if (offer.status === "Rejected" || offer.status === "Declined") {
        return res.send(renderCandidateOfferDeclinedSuccessPage({ candidate, offer }));
      }

      return res.send(renderCandidateOfferAcceptancePage({
        candidate,
        offer,
        company,
        token,
        acceptSubmitUrl,
        rejectUrl,
        pdfUrl,
      }));
    } catch (err) {
      return res.status(400).send(renderOfferErrorPage(err.message));
    }
  },

  async candidateAcceptSubmit(req, res) {
    try {
      const token = req.body.token || req.query.token;
      const joiningDate = req.body.joiningDate;
      const remarks = req.body.remarks;

      const result = await caOffersService.candidateAcceptOffer(token, joiningDate, remarks);

      const backendBaseUrl = process.env.BACKEND_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/:\d+$/, "")}:${config.port}` : `http://localhost:${config.port}`);
      const pdfUrl = `${backendBaseUrl}/api/ca-offers/candidate-pdf?token=${encodeURIComponent(token)}`;

      return res.send(renderCandidateOfferAcceptedSuccessPage({
        candidate: result.candidate,
        offer: result.offer,
        joiningDate: result.joiningDate,
        pdfUrl,
      }));
    } catch (err) {
      return res.status(400).send(renderOfferErrorPage(err.message));
    }
  },

  async candidateRejectPage(req, res) {
    try {
      const token = req.query.token;
      const { offer, candidate, company } = await caOffersService.candidateGetOfferDetails(token);

      const backendBaseUrl = process.env.BACKEND_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/:\d+$/, "")}:${config.port}` : `http://localhost:${config.port}`);
      const declineSubmitUrl = `${backendBaseUrl}/api/ca-offers/candidate-reject`;
      const acceptUrl = `${backendBaseUrl}/api/ca-offers/candidate-accept?token=${encodeURIComponent(token)}`;

      if (offer.status === "Accepted") {
        const pdfUrl = `${backendBaseUrl}/api/ca-offers/candidate-pdf?token=${encodeURIComponent(token)}`;
        return res.send(renderCandidateOfferAcceptedSuccessPage({
          candidate,
          offer,
          joiningDate: offer.joiningDate,
          pdfUrl,
        }));
      }

      if (offer.status === "Rejected" || offer.status === "Declined") {
        return res.send(renderCandidateOfferDeclinedSuccessPage({ candidate, offer }));
      }

      return res.send(renderCandidateOfferDeclinePage({
        candidate,
        offer,
        company,
        token,
        declineSubmitUrl,
        acceptUrl,
      }));
    } catch (err) {
      return res.status(400).send(renderOfferErrorPage(err.message));
    }
  },

  async candidateRejectSubmit(req, res) {
    try {
      const token = req.body.token || req.query.token;
      const reason = req.body.reason;
      const remarks = req.body.remarks;

      const result = await caOffersService.candidateRejectOffer(token, reason, remarks);
      return res.send(renderCandidateOfferDeclinedSuccessPage({
        candidate: result.candidate,
        offer: result.offer,
      }));
    } catch (err) {
      return res.status(400).send(renderOfferErrorPage(err.message));
    }
  },

  async candidatePdf(req, res) {
    try {
      const { pdfBuffer, filename } = await caOffersService.candidatePdf(req.query.token);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (err) {
      return res.status(400).send(renderOfferErrorPage(err.message));
    }
  }
};
