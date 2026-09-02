import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { onboardService } from "./onboard.service.js";
import { validateOnboardBody } from "./onboard.validator.js";

const sendAppError = (res, error) => {
  if (error instanceof AppError) {
    return fail(res, {
      status: error.statusCode,
      message: error.message,
      code: error.code,
    });
  }

  throw error;
};

const validatedBody = (res, body) => {
  const { isValid, errors, value } = validateOnboardBody(body);

  if (isValid) {
    return value;
  }

  fail(res, {
    status: 422,
    message: Object.values(errors)[0] || "Validation failed",
    code: "VALIDATION_ERROR",
    errors,
  });
  return null;
};

export const onboardController = {
  list: asyncHandler(async (_req, res) => {
    const items = await onboardService.list();

    return success(res, {
      message: "Onboard loaded",
      data: { onboard: items },
    });
  }),

  create: asyncHandler(async (req, res) => {
    const value = validatedBody(res, req.body);

    if (!value) {
      return;
    }

    try {
      const onboard = await onboardService.create(value);
      const message = "Onboard added successfully";

      return success(res, {
        status: 201,
        message,
        data: { onboard },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const value = validatedBody(res, req.body);

    if (!value) {
      return;
    }

    try {
      const onboard = await onboardService.update(req.params.id, value);
      const message = "Onboard updated successfully";

      return success(res, {
        message,
        data: { onboard },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  remove: asyncHandler(async (req, res) => {
    try {
      await onboardService.remove(req.params.id);
      const message = "Onboard deleted successfully";

      return success(res, {
        message,
        data: null,
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
