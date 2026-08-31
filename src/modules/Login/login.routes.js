import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticateToken, validateLoginRequest } from "./login.middleware.js";
import { loginController } from "./login.controller.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-in attempts. Try again later.",
    code: "RATE_LIMITED",
  },
});

export const loginRouter = Router();

loginRouter.post("/", loginLimiter, validateLoginRequest, loginController.login);
loginRouter.get("/profile", authenticateToken, loginController.profile);
