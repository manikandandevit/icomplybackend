import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { caCompaniesService } from "./caCompanies.service.js";
import { validateCACompanyBody } from "./caCompanies.validator.js";

const sendImage = async (res, file) => {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  file.body.pipe(res);
};

const sendAppError = (res, error) => {
  if (error instanceof AppError) {
    return fail(res, {
      status: error.statusCode,
      message: error.message,
      code: error.code,
    });
  }

  throw error;
};

export const caCompaniesController = {
  list: asyncHandler(async (req, res) => {
    const result = await caCompaniesService.list(req.companyId, req.companyAccess);

    return success(res, {
      message: "Companies loaded",
      data: result,
    });
  }),

  uploadLogo: asyncHandler(async (req, res) => {
    if (!req.file) {
      return fail(res, {
        status: 400,
        message: "Logo file is required",
        code: "LOGO_REQUIRED",
      });
    }

    const uploaded = await caCompaniesService.uploadLogo(req.file);

    return success(res, {
      message: "Logo uploaded",
      data: uploaded,
    });
  }),

  logo: asyncHandler(async (req, res) => {
    const file = await caCompaniesService.logoById(req.params.id);
    await sendImage(res, file);
  }),

  get: asyncHandler(async (req, res) => {
    try {
      const company = await caCompaniesService.get(req.params.id, req.companyId);

      return success(res, {
        message: "Company loaded",
        data: { company },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCACompanyBody(req.body);

    if (!isValid) {
      const message = Object.values(errors)[0] || "Validation failed";
      return fail(res, {
        status: 422,
        message,
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const company = await caCompaniesService.create(req.companyId, value);
      const message = "Company details saved";

      return success(res, {
        status: 201,
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCACompanyBody(req.body, { logoRequired: false });

    if (!isValid) {
      const message = Object.values(errors)[0] || "Validation failed";
      return fail(res, {
        status: 422,
        message,
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const company = await caCompaniesService.update(req.params.id, req.companyId, value);
      const message = "Company details updated";

      return success(res, {
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const status = String(req.body?.status ?? "").trim() === "Active" ? "Active" : "Inactive";

    try {
      const company = await caCompaniesService.updateStatus(req.params.id, req.companyId, status);
      const message = status === "Active" ? "Company set to Active" : "Company set to Inactive";

      return success(res, {
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
