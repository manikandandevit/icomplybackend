import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import { caAttendanceController } from "./caAttendance.controller.js";

export const caAttendanceRouter = Router();

caAttendanceRouter.get("/", authenticateToken, requireCompanyAdmin, caAttendanceController.list);
caAttendanceRouter.post("/check-in", authenticateToken, requireCompanyAdmin, caAttendanceController.checkIn);
caAttendanceRouter.post("/check-out", authenticateToken, requireCompanyAdmin, caAttendanceController.checkOut);
caAttendanceRouter.post("/regularization", authenticateToken, requireCompanyAdmin, caAttendanceController.applyRegularization);
caAttendanceRouter.post("/", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.create);
caAttendanceRouter.put("/:id/regularize", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.regularize);
caAttendanceRouter.put("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("attendance"), caAttendanceController.update);
