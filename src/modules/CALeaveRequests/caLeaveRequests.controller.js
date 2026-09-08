import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { caLeaveRequestsService } from "./caLeaveRequests.service.js";
import { validateLeaveRequestBody } from "./caLeaveRequests.validator.js";

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

export const caLeaveRequestsController = {
  list: asyncHandler(async (req, res) => {
    const requests = await caLeaveRequestsService.list(req.companyId);
    return success(res, { message: "Leave requests loaded", data: { requests } });
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateLeaveRequestBody(req.body);
    if (!isValid) {
      return fail(res, {
        status: 422,
        message: Object.values(errors)[0] || "Validation failed",
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const request = await caLeaveRequestsService.create(req.companyId, value);
      return success(res, {
        status: 201,
        message: "Leave request created",
        data: { request },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  approve: asyncHandler(async (req, res) => {
    try {
      const request = await caLeaveRequestsService.approve(req.params.id, req.companyId, req.actorName);
      return success(res, { message: "Leave request approved", data: { request } });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  reject: asyncHandler(async (req, res) => {
    try {
      const request = await caLeaveRequestsService.reject(
        req.params.id,
        req.companyId,
        req.body?.reason,
        req.actorName,
      );
      return success(res, { message: "Leave request rejected", data: { request } });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
