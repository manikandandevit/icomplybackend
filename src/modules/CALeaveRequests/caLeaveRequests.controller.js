import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { leaveAttachmentsStorage } from "../../core/storage/leaveAttachments.js";
import { caLeaveRequestsService, leaveActorFromReq } from "./caLeaveRequests.service.js";
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
    const requests = await caLeaveRequestsService.list(req.companyId, leaveActorFromReq(req), req.query?.scope);
    return success(res, { message: "Leave requests loaded", data: { requests } });
  }),

  balances: asyncHandler(async (req, res) => {
    const year = Number(req.query?.year) || new Date().getFullYear();
    const balances = await caLeaveRequestsService.balances(req.companyId, year);
    return success(res, { message: "Leave balances loaded", data: { balances, year } });
  }),

  uploadAttachment: asyncHandler(async (req, res) => {
    if (!req.file) {
      return fail(res, { status: 400, message: "Choose a PDF or image file", code: "ATTACHMENT_REQUIRED" });
    }
    try {
      const uploaded = await leaveAttachmentsStorage.upload(req.file);
      return success(res, { message: "Attachment uploaded", data: uploaded });
    } catch (error) {
      return sendAppError(res, error);
    }
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
      const request = await caLeaveRequestsService.create(req.companyId, value, leaveActorFromReq(req));
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
      const request = await caLeaveRequestsService.approve(
        req.params.id,
        req.companyId,
        req.actorName,
        leaveActorFromReq(req),
      );
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
        leaveActorFromReq(req),
      );
      return success(res, { message: "Leave request rejected", data: { request } });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  cancel: asyncHandler(async (req, res) => {
    try {
      await caLeaveRequestsService.cancel(req.params.id, req.companyId, leaveActorFromReq(req));
      return success(res, { message: "Leave request cancelled" });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
