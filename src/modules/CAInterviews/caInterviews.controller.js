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
      return success(res, { data: { interview }, status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const interview = await caInterviewsService.update(id, companyId, req.body);
      return success(res, { data: { interview } });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { status } = req.body;
      const interview = await caInterviewsService.updateStatus(id, companyId, status);
      return success(res, { data: { interview } });
    } catch (err) {
      next(err);
    }
  },

  async submitFeedback(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { rating, feedback, outcomeStatus, statusReason, roundsCompleted, completedRound, candidateId } = req.body;
      if (!feedback || !String(feedback).trim()) {
        return res.status(400).json({ status: "fail", message: "Feedback is a required field." });
      }
      const effectiveStatus = outcomeStatus && String(outcomeStatus).trim() ? String(outcomeStatus).trim() : "Completed";
      const interview = await caInterviewsService.submitFeedback(id, companyId, {
        rating: rating || null,
        feedback: String(feedback).trim(),
        outcomeStatus: effectiveStatus,
        statusReason,
        roundsCompleted,
        completedRound,
        candidateId,
      });
      return success(res, { data: { interview } });
    } catch (err) {
      next(err);
    }
  },

  async sendInvite(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const interview = await caInterviewsService.sendInvite(id, companyId, req.body);
      return success(res, {
        message: interview?.emailSent
          ? `Interview invitation sent successfully to ${interview?.candidateEmail || "candidate"}`
          : "Interview invitation sent successfully",
        data: { interview },
      });
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const deleted = await caInterviewsService.delete(id, companyId);
      return success(res, { message: "Interview deleted successfully", data: { deleted } });
    } catch (err) {
      next(err);
    }
  }
};
