import { Router } from "express";
import { hirePilotController } from "./hirepilot.controller.js";
import { authenticateToken } from "../Login/login.middleware.js";

export const hirePilotRouter = Router();

hirePilotRouter.get("/status", hirePilotController.getStatus);
hirePilotRouter.get("/oauth/linkedin/callback", hirePilotController.linkedInCallback);

// Public unauthenticated routes for candidates
hirePilotRouter.get("/public/openings/:id", hirePilotController.getPublicOpening);
hirePilotRouter.post("/public/openings/:id/apply", hirePilotController.submitApplication);
hirePilotRouter.get("/public/openings/:id/apply-link", hirePilotController.redirectToApplyPage);
hirePilotRouter.get("/careers/apply/:id", hirePilotController.redirectToApplyPage);

hirePilotRouter.use(authenticateToken);
hirePilotRouter.get("/credentials", hirePilotController.listCredentials);
hirePilotRouter.post("/credentials", hirePilotController.saveCredential);
hirePilotRouter.delete("/credentials/:id", hirePilotController.deleteCredential);

hirePilotRouter.get("/openings", hirePilotController.listOpenings);
hirePilotRouter.post("/openings", hirePilotController.createOpening);
hirePilotRouter.delete("/openings/:id", hirePilotController.deleteOpening);
hirePilotRouter.post("/openings/:id/post", hirePilotController.postOpening);
hirePilotRouter.get("/openings/:id/applications", hirePilotController.listApplications);
hirePilotRouter.get("/openings/:id/accepted-candidates", hirePilotController.listAcceptedCandidates);
hirePilotRouter.post("/applications/:id/move", hirePilotController.moveCandidate);
