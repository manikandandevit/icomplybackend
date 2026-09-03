import { Router } from "express";
import { authenticateToken } from "../Login/login.middleware.js";
import { countryController } from "./country.controller.js";

export const countryRouter = Router();

countryRouter.get("/", authenticateToken, countryController.list);
countryRouter.get("/states", authenticateToken, countryController.getStates);
countryRouter.get("/cities", authenticateToken, countryController.getCities);
countryRouter.post("/", authenticateToken, countryController.create);
countryRouter.put("/:id", authenticateToken, countryController.update);
countryRouter.delete("/:id", authenticateToken, countryController.remove);
