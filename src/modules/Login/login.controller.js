import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { createToast } from "../../core/toast/index.js";
import { success } from "../../core/utils/response.js";
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
    const user = await loginService.getProfile(req.user.sub);

    return success(res, {
      message: "Profile loaded",
      data: { user },
    });
  }),
};
