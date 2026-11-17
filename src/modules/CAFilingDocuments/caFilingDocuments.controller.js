import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { caFilingDocumentsRepository } from "./caFilingDocuments.repository.js";
import { filingDocumentsStorage } from "./caFilingDocuments.storage.js";

const COUNTRIES = ["SG", "MY"];

const filingFrom = (source = {}) => ({
  country: String(source.country || "").trim().toUpperCase(),
  establishmentId: String(source.establishmentId || "").trim(),
  complianceType: String(source.complianceType || "").trim().slice(0, 50),
  month: String(source.month || "").trim().slice(0, 20),
  year: String(source.year || "").trim().slice(0, 10),
});

const sendAppError = (res, error) => {
  if (error instanceof AppError) {
    return fail(res, { status: error.statusCode, message: error.message, code: error.code });
  }
  throw error;
};

export const caFilingDocumentsController = {
  list: asyncHandler(async (req, res) => {
    const filters = filingFrom(req.query);
    const documents = await caFilingDocumentsRepository.list(req.companyId, filters);
    return success(res, { message: "Filing documents loaded", data: { documents } });
  }),

  upload: asyncHandler(async (req, res) => {
    const filing = filingFrom(req.body);
    if (!COUNTRIES.includes(filing.country) || !filing.establishmentId || !filing.complianceType || !filing.month || !filing.year) {
      return fail(res, { status: 422, message: "Filing details are incomplete", code: "VALIDATION_ERROR" });
    }
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return fail(res, { status: 400, message: "Choose at least one file (max 10 MB each)", code: "FILES_REQUIRED" });
    }

    try {
      const documents = [];
      for (const file of files) {
        const stored = await filingDocumentsStorage.upload(file, { companyId: req.companyId, country: filing.country });
        documents.push(
          await caFilingDocumentsRepository.create(req.companyId, {
            ...filing,
            fileName: String(file.originalname || "document").slice(0, 255),
            s3Key: stored.key,
            fileUrl: stored.url,
            mimeType: file.mimetype || "",
            fileSize: file.size || 0,
            uploadedBy: req.actorName || "",
          }),
        );
      }
      return success(res, {
        status: 201,
        message: `${documents.length} document(s) uploaded`,
        data: { documents },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  download: asyncHandler(async (req, res) => {
    const row = await caFilingDocumentsRepository.findRaw(req.companyId, req.params.id);
    if (!row) {
      return fail(res, { status: 404, message: "Document not found", code: "NOT_FOUND" });
    }
    try {
      const file = await filingDocumentsStorage.get(row.s3_key);
      const safeName = String(row.file_name || "document").replace(/["\r\n]/g, "_");
      res.setHeader("Content-Type", row.mime_type || file.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      );
      file.body.pipe(res);
    } catch (error) {
      if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return fail(res, { status: 404, message: "File is no longer available", code: "NOT_FOUND" });
      }
      throw error;
    }
  }),

  remove: asyncHandler(async (req, res) => {
    const row = await caFilingDocumentsRepository.findRaw(req.companyId, req.params.id);
    if (!row) {
      return fail(res, { status: 404, message: "Document not found", code: "NOT_FOUND" });
    }
    await caFilingDocumentsRepository.remove(req.companyId, row.id);
    await filingDocumentsStorage.remove(row.s3_key);
    return success(res, { message: "Document removed", data: { id: String(row.id) } });
  }),
};
