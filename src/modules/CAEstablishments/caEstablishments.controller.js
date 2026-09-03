import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { caEstablishmentsService } from "./caEstablishments.service.js";
import { validateCAEstablishmentBody } from "./caEstablishments.validator.js";

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

export const caEstablishmentsController = {
  list: asyncHandler(async (req, res) => {
    const establishments = await caEstablishmentsService.list(req.companyId);

    return success(res, {
      message: "Establishments loaded",
      data: { establishments },
    });
  }),

  get: asyncHandler(async (req, res) => {
    try {
      const establishment = await caEstablishmentsService.get(req.params.id, req.companyId);

      return success(res, {
        message: "Establishment loaded",
        data: { establishment },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCAEstablishmentBody(req.body);

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
      const establishment = await caEstablishmentsService.create(req.companyId, value);
      const message = "Establishment registered";

      return success(res, {
        status: 201,
        message,
        data: { establishment },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCAEstablishmentBody(req.body);

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
      const establishment = await caEstablishmentsService.update(req.params.id, req.companyId, value);
      const message = "Establishment updated";

      return success(res, {
        message,
        data: { establishment },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const status = String(req.body?.status ?? "").trim() === "Active" ? "Active" : "Inactive";

    try {
      const establishment = await caEstablishmentsService.updateStatus(req.params.id, req.companyId, status);
      const message = status === "Active" ? "Establishment set to Active" : "Establishment set to Inactive";

      return success(res, {
        message,
        data: { establishment },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
