import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import multer from "multer";
import { caEmployeesController } from "./caEmployees.controller.js";
import { PHOTO_MAX_BYTES } from "./caEmployees.photoStorage.js";

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: PHOTO_MAX_BYTES } });

/** The employee themself, or a user with Employee Master permission. */
const selfOrEmployeeMaster = (req, res, next) => {
  if (req.employeeId && String(req.employeeId) === String(req.params.id)) return next();
  return requireNavPermission("employee-master")(req, res, next);
};

export const caEmployeesRouter = Router();

caEmployeesRouter.get("/upcoming-birthdays", authenticateToken, requireCompanyAdmin, caEmployeesController.upcomingBirthdays);
caEmployeesRouter.get("/counts", authenticateToken, requireCompanyAdmin, caEmployeesController.counts);
caEmployeesRouter.get("/", authenticateToken, requireCompanyAdmin, caEmployeesController.list);
caEmployeesRouter.get("/:id/photo", authenticateToken, requireCompanyAdmin, caEmployeesController.photo);
caEmployeesRouter.post(
  "/:id/photo",
  authenticateToken,
  requireCompanyAdmin,
  selfOrEmployeeMaster,
  photoUpload.single("photo"),
  caEmployeesController.uploadPhoto
);
caEmployeesRouter.get("/:id", authenticateToken, requireCompanyAdmin, caEmployeesController.get);
caEmployeesRouter.post("/", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.create);
caEmployeesRouter.put(
  "/:id",
  authenticateToken,
  requireCompanyAdmin,
  (req, res, next) => {
    if (req.employeeId && String(req.employeeId) === String(req.params.id)) {
      return next();
    }
    return requireNavPermission("employee-master")(req, res, next);
  },
  caEmployeesController.update
);
caEmployeesRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.updateStatus);
caEmployeesRouter.delete("/:id", authenticateToken, requireCompanyAdmin, requireNavPermission("employee-master"), caEmployeesController.delete);
