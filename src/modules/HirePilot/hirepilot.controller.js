import { success } from "../../core/utils/response.js";
import { hirePilotService } from "./hirepilot.service.js";

export const hirePilotController = {
  getStatus: async (req, res, next) => {
    try {
      const data = await hirePilotService.getStatus();
      return success(res, {
        message: "HirePilot service is ready",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  listCredentials: async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      const { establishmentId } = req.query;
      const data = await hirePilotService.listCredentials(companyId, establishmentId);
      return success(res, {
        message: "HirePilot credentials retrieved",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  saveCredential: async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      const data = await hirePilotService.saveCredential(companyId, req.body);
      return success(res, {
        message: "Credentials saved successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteCredential: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await hirePilotService.deleteCredential(id);
      return success(res, {
        message: "Credential deleted successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  listOpenings: async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      const data = await hirePilotService.listOpenings(companyId);
      return success(res, {
        message: "Openings retrieved successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  createOpening: async (req, res, next) => {
    try {
      const companyId = req.user?.companyId;
      const data = await hirePilotService.createOpening(companyId, req.body);
      return success(res, {
        message: "Opening created successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  deleteOpening: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await hirePilotService.deleteOpening(id);
      return success(res, {
        message: "Opening deleted successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  postOpening: async (req, res, next) => {
    try {
      const { id } = req.params;
      let frontendUrl = req.body?.frontendUrl;

      if (!frontendUrl || typeof frontendUrl !== "string" || !frontendUrl.startsWith("http")) {
        const origin = req.get("origin");
        if (origin && origin.startsWith("http")) {
          frontendUrl = origin;
        } else {
          frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        }
      }

      // Strip trailing slash if any
      frontendUrl = frontendUrl.replace(/\/+$/, "");

      const data = await hirePilotService.postOpening(id, frontendUrl);
      return success(res, {
        message: "Opening published to channels successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  redirectToApplyPage: async (req, res) => {
    const { id } = req.params;
    const frontendUrl = (process.env.FRONTEND_URL || "https://icomplyfront-end.vercel.app").replace(/\/+$/, "");
    return res.redirect(`${frontendUrl}/careers/apply/${id}`);
  },

  linkedInCallback: async (req, res) => {
    const { code, state, error, error_description } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    if (error) {
      return res.redirect(`${frontendUrl}/company-admin/pilot-setting?oauth_error=${encodeURIComponent(error_description || error)}`);
    }
    return res.redirect(`${frontendUrl}/company-admin/pilot-setting?oauth_code=${encodeURIComponent(code || "")}&state=${encodeURIComponent(state || "")}`);
  },

  getPublicOpening: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await hirePilotService.getPublicOpening(id);
      return success(res, {
        message: "Opening details retrieved",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  submitApplication: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { fullName, email, phone } = req.body;
      if (!fullName || !email || !phone) {
        return res.status(400).json({
          success: false,
          message: "Full Name, Email, and Phone number are required.",
        });
      }

      const data = await hirePilotService.submitApplication(id, req.body);
      return success(res, {
        message: "Application submitted successfully! Our team will reach out soon.",
        data: { id: data.id },
      });
    } catch (error) {
      next(error);
    }
  },

  listApplications: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await hirePilotService.listApplications(id);
      return success(res, {
        message: "Applications retrieved",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  listAcceptedCandidates: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await hirePilotService.listAcceptedCandidates(id);
      return success(res, {
        message: "Accepted candidates retrieved",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  moveCandidate: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await hirePilotService.moveCandidate(id);
      return success(res, {
        message: "Candidate moved to interview pipeline successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};
