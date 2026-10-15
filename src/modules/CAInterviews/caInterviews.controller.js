import { success } from "../../core/utils/response.js";
import { caInterviewsService } from "./caInterviews.service.js";
import { caCandidatesService } from "../CACandidates/caCandidates.service.js";

export const caInterviewsController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId;
      const interviews = await caInterviewsService.list(companyId);
      return success(res, { data: { interviews } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const companyId = req.companyId;
      const interview = await caInterviewsService.create(companyId, req.body);
      
      // Update candidate status to 'Scheduled'
      if (req.body.candidateId) {
        await caCandidatesService.updateStage(req.body.candidateId, companyId, 'Interview'); // or just keep stage Interview
      }
      
      return success(res, { data: { interview }, status: 201 });
    } catch (err) {
      next(err);
    }
  }
};
