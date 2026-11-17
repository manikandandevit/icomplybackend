import { Router } from "express";
import multer from "multer";
import { fail } from "../../core/utils/response.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { FILING_DOC_MAX_BYTES, FILING_DOC_MAX_FILES } from "./caFilingDocuments.storage.js";
import { caFilingDocumentsController } from "./caFilingDocuments.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILING_DOC_MAX_BYTES, files: FILING_DOC_MAX_FILES },
});

/** Turns multer limit errors into a clear 400 instead of a server error. */
const receiveFiles = (req, res, next) => {
  upload.array("files", FILING_DOC_MAX_FILES)(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each file must be 10 MB or smaller"
        : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
          ? `Upload up to ${FILING_DOC_MAX_FILES} files at a time`
          : "Could not read the uploaded files";
    return fail(res, { status: 400, message, code: "UPLOAD_ERROR" });
  });
};

export const caFilingDocumentsRouter = Router();

caFilingDocumentsRouter.get("/", authenticateToken, requireCompanyAdmin, caFilingDocumentsController.list);
caFilingDocumentsRouter.post(
  "/",
  authenticateToken,
  requireCompanyAdmin,
  receiveFiles,
  caFilingDocumentsController.upload,
);
caFilingDocumentsRouter.get("/:id/download", authenticateToken, requireCompanyAdmin, caFilingDocumentsController.download);
caFilingDocumentsRouter.delete("/:id", authenticateToken, requireCompanyAdmin, caFilingDocumentsController.remove);
