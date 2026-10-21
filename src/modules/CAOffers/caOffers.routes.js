import { Router } from "express";
import { caOffersController } from "./caOffers.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caOffersController.list);
router.get("/:id", caOffersController.getById);
router.post("/", caOffersController.create);
router.get("/:id/pdf", caOffersController.getPdf);
router.post("/:id/send", caOffersController.sendOffer);
router.patch("/:id/status", caOffersController.updateStatus);
router.get("/:id/documents", caOffersController.getDocuments);
router.patch("/:id/documents", caOffersController.updateDocuments);
router.put("/:id/documents", caOffersController.updateDocuments);
router.put("/:id", caOffersController.update);
router.delete("/:id", caOffersController.delete);

export { router as caOffersRouter };
