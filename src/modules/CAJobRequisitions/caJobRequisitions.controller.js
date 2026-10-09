import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { caJobRequisitionsService } from "./caJobRequisitions.service.js";
import { validateJobRequisitionBody } from "./caJobRequisitions.validator.js";

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

const parsedBody = (req, res) => {
  const { isValid, errors, value } = validateJobRequisitionBody(req.body);
  if (!isValid) {
    fail(res, {
      status: 422,
      message: Object.values(errors)[0] || "Validation failed",
      code: "VALIDATION_ERROR",
      errors,
    });
    return null;
  }
  return value;
};

export const caJobRequisitionsController = {
  list: asyncHandler(async (req, res) => {
    const requisitions = await caJobRequisitionsService.list(req.companyId);
    return success(res, { message: "Job requisitions loaded", data: { requisitions } });
  }),

  create: asyncHandler(async (req, res) => {
    const value = parsedBody(req, res);
    if (!value) return;
    try {
      const requisition = await caJobRequisitionsService.create(req.companyId, value);
      return success(res, {
        status: 201,
        message: "Job requisition saved",
        data: { requisition },
        toast: createToast({ type: "success", message: "Job requisition saved" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const value = parsedBody(req, res);
    if (!value) return;
    try {
      const requisition = await caJobRequisitionsService.update(req.params.id, req.companyId, value);
      return success(res, {
        message: "Job requisition updated",
        data: { requisition },
        toast: createToast({ type: "success", message: "Job requisition updated" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  approve: asyncHandler(async (req, res) => {
    try {
      const requisition = await caJobRequisitionsService.approve(req.params.id, req.companyId);
      return success(res, {
        message: "Job requisition approved",
        data: { requisition },
        toast: createToast({ type: "success", message: "Job requisition approved" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  remove: asyncHandler(async (req, res) => {
    try {
      await caJobRequisitionsService.remove(req.params.id, req.companyId);
      return success(res, {
        message: "Job requisition deleted",
        toast: createToast({ type: "success", message: "Job requisition deleted" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
