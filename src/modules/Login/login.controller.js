import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { loginService } from "./login.service.js";

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
};
