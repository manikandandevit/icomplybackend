import { Router } from "express";
import { authenticateToken } from "../Login/login.middleware.js";
import { onboardController } from "./onboard.controller.js";

export const onboardRouter = Router();

onboardRouter.get("/", authenticateToken, onboardController.list);
onboardRouter.post("/", authenticateToken, onboardController.create);
onboardRouter.put("/:id", authenticateToken, onboardController.update);
onboardRouter.delete("/:id", authenticateToken, onboardController.remove);
