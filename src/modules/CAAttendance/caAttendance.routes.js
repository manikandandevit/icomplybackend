import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caAttendanceController } from "./caAttendance.controller.js";

export const caAttendanceRouter = Router();

caAttendanceRouter.get("/", authenticateToken, requireCompanyAdmin, caAttendanceController.list);
caAttendanceRouter.post("/check-in", authenticateToken, requireCompanyAdmin, caAttendanceController.checkIn);
caAttendanceRouter.post("/check-out", authenticateToken, requireCompanyAdmin, caAttendanceController.checkOut);
caAttendanceRouter.post("/regularization", authenticateToken, requireCompanyAdmin, caAttendanceController.applyRegularization);
caAttendanceRouter.post("/", authenticateToken, requireCompanyAdmin, caAttendanceController.create);
caAttendanceRouter.put("/:id/regularize", authenticateToken, requireCompanyAdmin, caAttendanceController.regularize);
caAttendanceRouter.put("/:id", authenticateToken, requireCompanyAdmin, caAttendanceController.update);
