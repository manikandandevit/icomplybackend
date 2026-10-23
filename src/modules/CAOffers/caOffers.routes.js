import { Router } from "express";
import { caOffersController } from "./caOffers.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

// Public routes for 1-click email approvals (no admin session required)
router.get("/public-approve", caOffersController.publicApprove);
router.get("/public-reject", caOffersController.publicReject);
router.get("/public-pdf", caOffersController.publicPdf);

// Public routes for candidate offer letter response (accept with DOJ confirmation & decline)
router.get("/candidate-accept", caOffersController.candidateAcceptPage);
router.post("/candidate-accept", caOffersController.candidateAcceptSubmit);
router.get("/candidate-reject", caOffersController.candidateRejectPage);
router.post("/candidate-reject", caOffersController.candidateRejectSubmit);
router.get("/candidate-pdf", caOffersController.candidatePdf);

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caOffersController.list);
router.post("/", caOffersController.create);
router.get("/:id/pdf", caOffersController.getPdf);
router.post("/:id/send", caOffersController.sendOffer);
router.patch("/:id/status", caOffersController.updateStatus);
router.post("/:id/onboard", caOffersController.onboardCandidate);
router.get("/:id/documents", caOffersController.getDocuments);
router.patch("/:id/documents", caOffersController.updateDocuments);
router.put("/:id/documents", caOffersController.updateDocuments);
router.put("/:id", caOffersController.update);
router.delete("/:id", caOffersController.delete);

export { router as caOffersRouter };
