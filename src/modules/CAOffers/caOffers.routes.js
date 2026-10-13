import { Router } from "express";
import { caOffersController } from "./caOffers.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", caOffersController.list);
router.get("/:id", caOffersController.getById);
router.post("/", caOffersController.create);
router.patch("/:id/status", caOffersController.updateStatus);
router.put("/:id", caOffersController.update);
router.delete("/:id", caOffersController.delete);

export { router as caOffersRouter };
