import { success } from "../../core/utils/response.js";
import { caOffersService } from "./caOffers.service.js";

export const caOffersController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId;
      const { status } = req.query;
      const offers = await caOffersService.list(companyId, { status });
      return success(res, { data: { offers } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = req.companyId;
      const offer = await caOffersService.create(companyId, req.body);
      return success(res, { data: { offer }, status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async getPdf(req, res, next) {
    try {
      const companyId = req.companyId;
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
      const companyId = req.companyId;
      const { id } = req.params;
      const result = await caOffersService.sendOffer(id, companyId, req.body);
      return success(res, { data: result, message: result.message });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { status } = req.body;
      const offer = await caOffersService.updateStatus(id, companyId, status);
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const offer = await caOffersService.update(id, companyId, req.body);
      return success(res, { data: { offer } });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      await caOffersService.delete(id, companyId);
      return success(res, { message: "Offer deleted successfully" });
    } catch (err) {
      next(err);
    }
  },

  async getDocuments(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const documents = await caOffersService.getDocuments(id, companyId);
      return success(res, { data: { documents } });
    } catch (err) {
      next(err);
    }
  },

  async updateDocuments(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { documents } = req.body;
      const offer = await caOffersService.updateDocuments(id, companyId, documents);
      return success(res, { data: { offer, documents: offer?.documents || documents }, message: "Documents saved successfully" });
    } catch (err) {
      next(err);
    }
  }
};
