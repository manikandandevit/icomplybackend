import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { requireNavPermission } from "../CAPermissions/caPermissions.middleware.js";
import { caHolidaysController } from "./caHolidays.controller.js";

export const caHolidaysRouter = Router();

caHolidaysRouter.get("/", authenticateToken, requireCompanyAdmin, caHolidaysController.list);
caHolidaysRouter.post(
  "/",
  authenticateToken,
  requireCompanyAdmin,
  requireNavPermission("holiday"),
  caHolidaysController.create,
);
caHolidaysRouter.put(
  "/:id",
  authenticateToken,
  requireCompanyAdmin,
  requireNavPermission("holiday"),
  caHolidaysController.update,
);
caHolidaysRouter.delete(
  "/:id",
  authenticateToken,
  requireCompanyAdmin,
  requireNavPermission("holiday"),
  caHolidaysController.remove,
);
