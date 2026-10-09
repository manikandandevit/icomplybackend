import { success } from "../../core/utils/response.js";
import { caCandidatesService } from "./caCandidates.service.js";

export const caCandidatesController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId;
      const candidates = await caCandidatesService.list(companyId);
      return success(res, { data: { candidates } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = req.companyId;
      const candidate = await caCandidatesService.create(companyId, req.body);
      return success(res, { data: { candidate }, status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async updateStage(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { stage, assessmentCount } = req.body;
      const candidate = await caCandidatesService.updateStage(id, companyId, stage, assessmentCount);
      return success(res, { data: { candidate } });
    } catch (err) {
      next(err);
    }
  },

  async addNote(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { text } = req.body;
      const candidate = await caCandidatesService.addNote(id, companyId, text);
      return success(res, { data: { candidate } });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      await caCandidatesService.delete(id, companyId);
      return success(res, { message: "Candidate deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
};
