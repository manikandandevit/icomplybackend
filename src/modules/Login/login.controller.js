import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { loginService } from "./login.service.js";
import { loginRepository } from "./login.repository.js";
import { getSuperAdminLogo, superAdminImageUrl, uploadSuperAdminLogo } from "./login.storage.js";

/** Super admin tokens carry the numeric super_Admin id as `sub` and no `type`. */
const superAdminIdFromUser = (user) => {
  const sub = String(user?.sub ?? "");
  return !user?.type && /^\d+$/.test(sub) ? sub : null;
};

export const loginController = {
  login: asyncHandler(async (req, res) => {
    const payload = await loginService.authenticate(req.validatedBody);
    const message = "Signed in successfully";

    return success(res, {
      message,
      data: payload,
      toast: createToast({ type: "success", message }),
    });
  }),

  profile: asyncHandler(async (req, res) => {
    const user = await loginService.getProfile(req.user);

    return success(res, {
      message: "Profile loaded",
      data: { user },
    });
  }),

  uploadSuperAdminLogo: asyncHandler(async (req, res) => {
    const superAdminId = superAdminIdFromUser(req.user);
    const superAdmin = superAdminId ? await loginRepository.findSuperAdminById(superAdminId) : null;
    if (!superAdmin) {
      return fail(res, { status: 403, message: "Super admin access is required", code: "FORBIDDEN" });
    }
    if (!req.file) {
      return fail(res, { status: 400, message: "Choose a PNG, JPG, SVG or WebP image below 2 MB", code: "LOGO_REQUIRED" });
    }

    try {
      const uploaded = await uploadSuperAdminLogo(req.file, superAdmin.id);
      const updated = await loginRepository.updateSuperAdminImage(superAdmin.id, uploaded.url);
      const message = "Logo updated successfully";
      return success(res, {
        message,
        data: { imageUrl: superAdminImageUrl(superAdmin.id, updated?.Image_Url ?? uploaded.url) },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, { status: error.statusCode, message: error.message, code: error.code });
      }
      throw error;
    }
  }),

  superAdminLogo: asyncHandler(async (req, res) => {
    const superAdmin = /^\d+$/.test(String(req.params.id)) ? await loginRepository.findSuperAdminById(req.params.id) : null;
    if (!superAdmin) {
      return res.status(404).end();
    }
    try {
      const file = await getSuperAdminLogo(superAdmin.Image_Url);
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      file.body.pipe(res);
    } catch (error) {
      if (error instanceof AppError || error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
        return res.status(404).end();
      }
      throw error;
    }
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const password = String(req.body?.password ?? "");
    const confirmPassword = String(req.body?.confirmPassword ?? "");
    if (!password) {
      return fail(res, { status: 422, message: "New password is required", code: "VALIDATION_ERROR" });
    }
    if (password !== confirmPassword) {
      return fail(res, { status: 422, message: "Passwords do not match", code: "VALIDATION_ERROR" });
    }

    try {
      const payload = await loginService.resetPassword(req.user, { password });
      const message = "Password updated successfully";
      return success(res, {
        message,
        data: payload,
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return fail(res, { status: 422, message: "Email is required", code: "VALIDATION_ERROR" });
    }

    try {
      let origin = String(req.body?.origin || req.headers.origin || "").trim();
      if (!origin && req.headers.referer) {
        try {
          origin = new URL(req.headers.referer).origin;
        } catch {
          // ignore invalid referer url
        }
      }
      const result = await loginService.requestPasswordReset({ email, origin });
      return success(res, {
        message: result.message || "Password reset link sent to your email",
        data: { sent: true },
        toast: createToast({ type: "success", message: result.message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  }),

  resetPasswordWithToken: asyncHandler(async (req, res) => {
    const token = String(req.body?.token || req.query?.token || "").trim();
    const password = String(req.body?.password || req.body?.newPassword || "").trim();
    const confirmPassword = String(req.body?.confirmPassword || "").trim();

    if (!token) {
      return fail(res, { status: 400, message: "Reset token is required", code: "TOKEN_REQUIRED" });
    }
    if (!password) {
      return fail(res, { status: 422, message: "New password is required", code: "VALIDATION_ERROR" });
    }
    if (password.length < 6) {
      return fail(res, { status: 422, message: "Password must be at least 6 characters", code: "VALIDATION_ERROR" });
    }
    if (confirmPassword && password !== confirmPassword) {
      return fail(res, { status: 422, message: "Passwords do not match", code: "VALIDATION_ERROR" });
    }

    try {
      const result = await loginService.resetPasswordWithToken({ token, password });
      return success(res, {
        message: result.message || "Password updated successfully",
        data: { success: true },
        toast: createToast({ type: "success", message: result.message }),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(res, {
          status: error.statusCode,
          message: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  }),
};
