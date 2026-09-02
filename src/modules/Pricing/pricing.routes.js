import { Router } from "express";
import { authenticateToken } from "../Login/login.middleware.js";
import { pricingController } from "./pricing.controller.js";

export const pricingRouter = Router();

pricingRouter.get("/currencies", authenticateToken, pricingController.currencies);
pricingRouter.get("/", authenticateToken, pricingController.list);
pricingRouter.post("/", authenticateToken, pricingController.create);
pricingRouter.put("/:id", authenticateToken, pricingController.update);
pricingRouter.delete("/:id", authenticateToken, pricingController.remove);
