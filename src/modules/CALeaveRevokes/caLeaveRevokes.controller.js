import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { caLeaveRevokesService, leaveActorFromReq } from "./caLeaveRevokes.service.js";
import { validateRevokeBody } from "./caLeaveRevokes.validator.js";

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

export const caLeaveRevokesController = {
  list: asyncHandler(async (req, res) => {
    const requests = await caLeaveRevokesService.list(req.companyId, leaveActorFromReq(req), req.query?.scope);
    return success(res, { message: "Revoke requests loaded", data: { requests } });
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateRevokeBody(req.body);
    if (!isValid) {
      return fail(res, {
        status: 422,
        message: Object.values(errors)[0] || "Validation failed",
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const request = await caLeaveRevokesService.create(req.companyId, value, leaveActorFromReq(req));
      return success(res, {
        status: 201,
        message: "Revoke request created",
        data: { request },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  approve: asyncHandler(async (req, res) => {
    try {
      const request = await caLeaveRevokesService.approve(
        req.params.id,
        req.companyId,
        req.actorName,
        leaveActorFromReq(req),
      );
      return success(res, { message: "Revoke request approved", data: { request } });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  reject: asyncHandler(async (req, res) => {
    try {
      const request = await caLeaveRevokesService.reject(
        req.params.id,
        req.companyId,
        req.body?.reason,
        req.actorName,
        leaveActorFromReq(req),
      );
      return success(res, { message: "Revoke request rejected", data: { request } });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  cancel: asyncHandler(async (req, res) => {
    try {
      await caLeaveRevokesService.cancel(req.params.id, req.companyId, leaveActorFromReq(req));
      return success(res, { message: "Revoke request cancelled" });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
