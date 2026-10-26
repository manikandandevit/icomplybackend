import { Router } from "express";
import multer from "multer";
import { caCandidatesController } from "./caCandidates.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max resume size
});

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caCandidatesController.list);
router.post("/", caCandidatesController.create);
router.post("/upload-resume", upload.single("resume"), caCandidatesController.uploadResume);
router.get("/:id/resume", caCandidatesController.downloadResume);
router.get("/:id/timeline", caCandidatesController.getTimeline);
router.get("/:id/documents", caCandidatesController.getDocuments);
router.patch("/:id/documents", caCandidatesController.updateDocuments);
router.put("/:id/documents", caCandidatesController.updateDocuments);
router.patch("/:id/checklist", caCandidatesController.updateChecklist);
router.put("/:id/checklist", caCandidatesController.updateChecklist);
router.get("/:id", caCandidatesController.getById);
router.put("/:id", caCandidatesController.update);
router.patch("/:id", caCandidatesController.update);
router.patch("/:id/stage", caCandidatesController.updateStage);
router.patch("/:id/workflow-step", caCandidatesController.updateWorkflowStep);
router.post("/:id/outcome-status", caCandidatesController.updateOutcomeStatus);
router.post("/:id/notes", caCandidatesController.addNote);
router.delete("/:id", caCandidatesController.delete);

export { router as caCandidatesRouter };
