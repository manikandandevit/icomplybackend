import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { success } from "../../core/utils/response.js";
import { attendanceActorFromReq, caAttendanceService } from "./caAttendance.service.js";

export const caAttendanceController = {
  list: asyncHandler(async (req, res) => {
    const records = await caAttendanceService.list(req.companyId, attendanceActorFromReq(req));
    return success(res, { message: "Attendance loaded", data: { records } });
  }),

  checkIn: asyncHandler(async (req, res) => {
    const record = await caAttendanceService.punch(req.companyId, "in", req.body, attendanceActorFromReq(req));
    return success(res, { message: "Checked in", data: { record } });
  }),

  checkOut: asyncHandler(async (req, res) => {
    const record = await caAttendanceService.punch(req.companyId, "out", req.body, attendanceActorFromReq(req));
    return success(res, { message: "Checked out", data: { record } });
  }),

  create: asyncHandler(async (req, res) => {
    const record = await caAttendanceService.create(req.companyId, req.body, attendanceActorFromReq(req));
    return success(res, { status: 201, message: "Attendance created", data: { record } });
  }),

  applyRegularization: asyncHandler(async (req, res) => {
    const record = await caAttendanceService.applyRegularization(
      req.companyId,
      req.body,
      attendanceActorFromReq(req),
    );
    return success(res, { status: 201, message: "Regularization request submitted", data: { record } });
  }),

  update: asyncHandler(async (req, res) => {
    const actor = attendanceActorFromReq(req);
    const record = await caAttendanceService.updateTimes(req.params.id, req.companyId, req.body, actor);
    return success(res, { message: "Attendance time updated", data: { record } });
  }),

  regularize: asyncHandler(async (req, res) => {
    const record = await caAttendanceService.regularize(
      req.params.id,
      req.companyId,
      req.body,
      attendanceActorFromReq(req),
    );
    return success(res, { message: "Regularization updated", data: { record } });
  }),
};
