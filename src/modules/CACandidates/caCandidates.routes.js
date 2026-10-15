import { Router } from "express";
import { caCandidatesController } from "./caCandidates.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caCandidatesController.list);
router.post("/", caCandidatesController.create);
router.patch("/:id/stage", caCandidatesController.updateStage);
router.post("/:id/notes", caCandidatesController.addNote);
router.delete("/:id", caCandidatesController.delete);

export { router as caCandidatesRouter };
