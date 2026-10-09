import { Router } from "express";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";
import { caJobRequisitionsController } from "./caJobRequisitions.controller.js";

export const caJobRequisitionsRouter = Router();

caJobRequisitionsRouter.use(authenticateToken, requireCompanyAdmin);

caJobRequisitionsRouter.get("/", caJobRequisitionsController.list);
caJobRequisitionsRouter.post("/", caJobRequisitionsController.create);
caJobRequisitionsRouter.put("/:id", caJobRequisitionsController.update);
caJobRequisitionsRouter.patch("/:id/approve", caJobRequisitionsController.approve);
caJobRequisitionsRouter.delete("/:id", caJobRequisitionsController.remove);
