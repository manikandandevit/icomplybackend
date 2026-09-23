import { Router } from "express";
import { caStatutoryConfigController } from "./caStatutoryConfig.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

export const caStatutoryConfigRouter = Router();

caStatutoryConfigRouter.use(authenticateToken, requireCompanyAdmin);

caStatutoryConfigRouter.get("/", caStatutoryConfigController.list);
caStatutoryConfigRouter.post("/", caStatutoryConfigController.save);
caStatutoryConfigRouter.delete("/:id", caStatutoryConfigController.delete);
