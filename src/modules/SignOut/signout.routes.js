import { Router } from "express";
import { authenticateToken } from "../Login/login.middleware.js";
import { signOutController } from "./signout.controller.js";

export const signOutRouter = Router();

signOutRouter.post("/", authenticateToken, signOutController.logout);
