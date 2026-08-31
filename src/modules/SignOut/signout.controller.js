import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { createToast } from "../../core/toast/index.js";
import { success } from "../../core/utils/response.js";
import { signOutService } from "./signout.service.js";

export const signOutController = {
  logout: asyncHandler(async (_req, res) => {
    const payload = await signOutService.logout();

    return success(res, {
      message: payload.message,
      data: { signedOut: payload.signedOut },
      toast: createToast({ type: "success", message: payload.message }),
    });
  }),
};
