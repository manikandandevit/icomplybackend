import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { companiesService } from "./companies.service.js";
import { validateCompanyBody } from "./companies.validator.js";

const sendImage = async (res, file) => {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  file.body.pipe(res);
};

export const companiesController = {
  list: asyncHandler(async (_req, res) => {
    const companies = await companiesService.list();

    return success(res, {
      message: "Companies loaded",
      data: { companies },
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

    const uploaded = await companiesService.uploadLogo(req.file);

    return success(res, {
      message: "Logo uploaded",
      data: uploaded,
    });
  }),

  logo: asyncHandler(async (req, res) => {
    const file = await companiesService.logoById(req.params.id);
    await sendImage(res, file);
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCompanyBody(req.body);

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
      const company = await companiesService.create(value);
      const message = "Company details saved";

      return success(res, {
        status: 201,
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }

      throw error;
    }
  }),

  get: asyncHandler(async (req, res) => {
    const company = await companiesService.get(req.params.id);

    return success(res, {
      message: "Company loaded",
      data: { company },
    });
  }),

  update: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCompanyBody(req.body, { passwordRequired: false });

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
      const company = await companiesService.update(req.params.id, value);
      const message = "Company details updated";

      return success(res, {
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }

      throw error;
    }
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const status = String(req.body?.status ?? "").trim() === "Active" ? "Active" : "Inactive";

    try {
      const company = await companiesService.updateStatus(req.params.id, status);
      const message = status === "Active" ? "Company set to Active" : "Company set to Inactive";

      return success(res, {
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }

      throw error;
    }
  }),

  addUsers: asyncHandler(async (req, res) => {
    try {
      const company = await companiesService.addUsers(req.params.id, req.body?.countryUsers);
      const message = "Users updated successfully";

      return success(res, {
        message,
        data: { company },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }

      throw error;
    }
  }),
};
