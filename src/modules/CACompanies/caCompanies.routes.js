import { Router } from "express";
import multer from "multer";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caCompaniesController } from "./caCompanies.controller.js";
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES } from "../Companies/companies.storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (_req, file, callback) => {
    callback(null, LOGO_MIME_TYPES.includes(file.mimetype));
  },
});

export const caCompaniesRouter = Router();

caCompaniesRouter.get("/", authenticateToken, requireCompanyAdmin, caCompaniesController.list);
caCompaniesRouter.post("/logo", authenticateToken, requireCompanyAdmin, upload.single("logo"), caCompaniesController.uploadLogo);
caCompaniesRouter.get("/:id/logo", caCompaniesController.logo);
caCompaniesRouter.get("/:id", authenticateToken, requireCompanyAdmin, caCompaniesController.get);
caCompaniesRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, caCompaniesController.updateStatus);
caCompaniesRouter.put("/:id", authenticateToken, requireCompanyAdmin, caCompaniesController.update);
caCompaniesRouter.post("/", authenticateToken, requireCompanyAdmin, caCompaniesController.create);
