import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { success } from "../../core/utils/response.js";
import { caOtRequestsService } from "./caOtRequests.service.js";

const otActorFromReq = (req) => ({
  companyId: req.companyId,
  employeeId: req.user?.employeeId,
  isOwner: Boolean(req.user?.isOwner),
  name: req.user?.name || "Company Admin",
  canReview: true,
});

export const caOtRequestsController = {
  list: asyncHandler(async (req, res) => {
    const actor = otActorFromReq(req);
    const requests = await caOtRequestsService.list(req.companyId, req.query, actor);
    return success(res, { message: "Overtime requests loaded", data: { requests } });
  }),

  getById: asyncHandler(async (req, res) => {
    const request = await caOtRequestsService.getById(req.params.id, req.companyId);
    return success(res, { message: "Overtime request loaded", data: { request } });
  }),

  create: asyncHandler(async (req, res) => {
    const actor = otActorFromReq(req);
    const request = await caOtRequestsService.create(req.companyId, req.body, actor);
    return success(res, { status: 201, message: "Overtime request submitted", data: { request } });
  }),

  approve: asyncHandler(async (req, res) => {
    const actor = otActorFromReq(req);
    const request = await caOtRequestsService.approve(req.params.id, req.companyId, req.body, actor);
    return success(res, { message: "Overtime request approved", data: { request } });
  }),

  reject: asyncHandler(async (req, res) => {
    const actor = otActorFromReq(req);
    const request = await caOtRequestsService.reject(req.params.id, req.companyId, req.body, actor);
    return success(res, { message: "Overtime request rejected", data: { request } });
  }),
};
