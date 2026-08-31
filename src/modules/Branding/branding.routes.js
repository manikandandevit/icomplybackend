import { Router } from "express";
import { brandingController } from "./branding.controller.js";

export const brandingRouter = Router();

brandingRouter.get("/logo", brandingController.logo);
brandingRouter.get("/tabbar", brandingController.tabbar);
