import { success } from "../../core/utils/response.js";
import { caCandidatesService } from "./caCandidates.service.js";

export const caCandidatesController = {
  async list(req, res, next) {
    try {
      const companyId = req.companyId;
      const { role, position, stage } = req.query;
      const candidates = await caCandidatesService.list(companyId, { role: role || position, stage });
      return success(res, { data: { candidates } });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const candidate = await caCandidatesService.getById(id, companyId);
      return success(res, { data: { candidate } });
    } catch (err) {
      next(err);
    }
  },

  async getTimeline(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const result = await caCandidatesService.getTimeline(id, companyId);
      return success(res, { data: result });
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

  async update(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const candidate = await caCandidatesService.update(id, companyId, req.body);
      return success(res, { data: { candidate } });
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

  async updateWorkflowStep(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const candidate = await caCandidatesService.updateWorkflowStep(id, companyId, req.body);
      return success(res, { data: { candidate } });
    } catch (err) {
      next(err);
    }
  },

  async updateOutcomeStatus(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const candidate = await caCandidatesService.updateOutcomeStatus(id, companyId, req.body);
      return success(res, { data: { candidate }, message: `Candidate status updated to ${req.body?.outcomeStatus} and email notification triggered` });
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
  },

  async uploadResume(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No resume file uploaded" });
      }
      const companyId = req.companyId;
      const candidateId = req.body?.candidateId || req.query?.candidateId;
      const result = await caCandidatesService.uploadResume(companyId, req.file, candidateId);
      return success(res, { data: result });
    } catch (err) {
      next(err);
    }
  },

  async downloadResume(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const result = await caCandidatesService.getResume(id, companyId);

      if (!result) {
        return res.status(404).json({ success: false, message: "Resume not found" });
      }

      res.setHeader("Content-Type", result.contentType || "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename || 'Candidate_Resume.pdf'}"`
      );

      if (result.buffer) {
        res.setHeader("Content-Length", result.buffer.length);
        return res.end(result.buffer);
      } else if (result.stream) {
        return result.stream.pipe(res);
      } else if (result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }
    } catch (err) {
      next(err);
    }
  },

  async getDocuments(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const documents = await caCandidatesService.getDocuments(id, companyId);
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
      const candidate = await caCandidatesService.updateDocuments(id, companyId, documents);
      return success(res, {
        data: { candidate, documents: candidate?.documents || documents },
        message: "Documents saved successfully to candidate record"
      });
    } catch (err) {
      next(err);
    }
  },

  async updateChecklist(req, res, next) {
    try {
      const companyId = req.companyId;
      const { id } = req.params;
      const { checklist } = req.body;
      const candidate = await caCandidatesService.updateChecklist(id, companyId, checklist);
      return success(res, {
        data: { candidate, checklist: candidate?.preJoiningChecklist || checklist },
        message: "Checklist updated successfully in database"
      });
    } catch (err) {
      next(err);
    }
  },
};
