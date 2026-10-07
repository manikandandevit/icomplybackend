import { Router } from "express";
import { caEcrSlabsController } from "./caEcrSlabs.controller.js";
import { authenticateToken, requireCompanyAdmin } from "../Login/login.middleware.js";

export const caEcrSlabsRouter = Router();

caEcrSlabsRouter.use(authenticateToken, requireCompanyAdmin);

caEcrSlabsRouter.get("/", caEcrSlabsController.list);
caEcrSlabsRouter.post("/", caEcrSlabsController.create);
caEcrSlabsRouter.post("/bulk-save", caEcrSlabsController.bulkSave);
caEcrSlabsRouter.put("/:id", caEcrSlabsController.update);
caEcrSlabsRouter.delete("/:id", caEcrSlabsController.delete);
