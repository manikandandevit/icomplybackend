import { Router } from "express";
import multer from "multer";
import { authenticateToken } from "../Login/login.middleware.js";
import { companiesController } from "./companies.controller.js";
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES } from "./companies.storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (_req, file, callback) => {
    callback(null, LOGO_MIME_TYPES.includes(file.mimetype));
  },
});

export const companiesRouter = Router();

companiesRouter.get("/", authenticateToken, companiesController.list);
companiesRouter.post("/logo", authenticateToken, upload.single("logo"), companiesController.uploadLogo);
companiesRouter.get("/:id/logo", companiesController.logo);
companiesRouter.get("/:id", authenticateToken, companiesController.get);
companiesRouter.patch("/:id/status", authenticateToken, companiesController.updateStatus);
companiesRouter.put("/:id", authenticateToken, companiesController.update);
companiesRouter.post("/", authenticateToken, companiesController.create);
