import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import { caAttendanceController } from "./caAttendance.controller.js";

export const caAttendanceRouter = Router();

caAttendanceRouter.get("/", authenticateToken, requireCompanyAdmin, caAttendanceController.list);
caAttendanceRouter.get("/punch-window", authenticateToken, requireCompanyAdmin, caAttendanceController.punchWindow);
caAttendanceRouter.post("/check-in", authenticateToken, requireCompanyAdmin, caAttendanceController.checkIn);
caAttendanceRouter.post("/check-out", authenticateToken, requireCompanyAdmin, caAttendanceController.checkOut);
caAttendanceRouter.post("/regularization", authenticateToken, requireCompanyAdmin, caAttendanceController.applyRegularization);
caAttendanceRouter.post("/", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.create);
// Review: the service allows company admin, the reporting manager, or attendance / requests edit permission
// (the nav-permission gate here blocked reporting managers without the Attendance menu).
caAttendanceRouter.put("/:id/regularize", authenticateToken, requireCompanyAdmin, caAttendanceController.regularize);
caAttendanceRouter.put("/:id/cancel-regularization", authenticateToken, requireCompanyAdmin, caAttendanceController.cancelRegularization);
caAttendanceRouter.post("/edit-time", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.update);
caAttendanceRouter.put("/edit-time", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.update);
caAttendanceRouter.put("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.update);
