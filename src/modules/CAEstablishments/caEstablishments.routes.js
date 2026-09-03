import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caEstablishmentsController } from "./caEstablishments.controller.js";

export const caEstablishmentsRouter = Router();

caEstablishmentsRouter.get("/", authenticateToken, requireCompanyAdmin, caEstablishmentsController.list);
caEstablishmentsRouter.get("/:id", authenticateToken, requireCompanyAdmin, caEstablishmentsController.get);
caEstablishmentsRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, caEstablishmentsController.updateStatus);
caEstablishmentsRouter.put("/:id", authenticateToken, requireCompanyAdmin, caEstablishmentsController.update);
caEstablishmentsRouter.post("/", authenticateToken, requireCompanyAdmin, caEstablishmentsController.create);
