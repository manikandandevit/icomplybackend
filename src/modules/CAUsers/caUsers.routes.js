import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caUsersController } from "./caUsers.controller.js";

export const caUsersRouter = Router();

caUsersRouter.get("/", authenticateToken, requireCompanyAdmin, caUsersController.list);
caUsersRouter.get("/:id", authenticateToken, requireCompanyAdmin, caUsersController.get);
caUsersRouter.patch("/:id/status", authenticateToken, requireCompanyAdmin, caUsersController.updateStatus);
caUsersRouter.put("/:id", authenticateToken, requireCompanyAdmin, caUsersController.update);
caUsersRouter.post("/", authenticateToken, requireCompanyAdmin, caUsersController.create);
caUsersRouter.delete("/:id", authenticateToken, requireCompanyAdmin, caUsersController.delete);
