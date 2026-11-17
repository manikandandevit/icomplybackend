import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { authenticateToken, validateLoginRequest } from "./login.middleware.js";
import { loginController } from "./login.controller.js";
import { SUPER_ADMIN_LOGO_MAX_BYTES, SUPER_ADMIN_LOGO_MIME_TYPES } from "./login.storage.js";

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SUPER_ADMIN_LOGO_MAX_BYTES },
  fileFilter: (_req, file, callback) => {
    callback(null, SUPER_ADMIN_LOGO_MIME_TYPES.includes(file.mimetype));
  },
});

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
loginRouter.get("/super-admin/:id/logo", loginController.superAdminLogo);
loginRouter.post("/profile/logo", authenticateToken, logoUpload.single("logo"), loginController.uploadSuperAdminLogo);
loginRouter.post("/reset-password", authenticateToken, loginController.resetPassword);
loginRouter.post("/forgot-password", loginLimiter, loginController.forgotPassword);
loginRouter.post("/reset-password-with-token", loginLimiter, loginController.resetPasswordWithToken);
