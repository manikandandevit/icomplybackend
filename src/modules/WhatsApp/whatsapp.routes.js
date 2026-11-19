import { Router } from "express";
import { whatsappController } from "./whatsapp.controller.js";

export const whatsappRouter = Router();

// Public endpoints called by Meta (no login token).
whatsappRouter.get("/webhook", whatsappController.verify);
whatsappRouter.post("/webhook", whatsappController.receive);
