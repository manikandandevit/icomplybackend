import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { pricingService } from "./pricing.service.js";
import { validatePricingBody } from "./pricing.validator.js";

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
  const { isValid, errors, value } = validatePricingBody(body);

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

export const pricingController = {
  currencies: asyncHandler(async (_req, res) => {
    return success(res, {
      message: "Currencies loaded",
      data: { currencies: pricingService.currencies() },
    });
  }),

  list: asyncHandler(async (_req, res) => {
    const items = await pricingService.list();

    return success(res, {
      message: "Pricing loaded",
      data: { pricing: items },
    });
  }),

  create: asyncHandler(async (req, res) => {
    const value = validatedBody(res, req.body);

    if (!value) {
      return;
    }

    try {
      const pricing = await pricingService.create(value);
      const message = "Pricing added successfully";

      return success(res, {
        status: 201,
        message,
        data: { pricing },
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
      const pricing = await pricingService.update(req.params.id, value);
      const message = "Pricing updated successfully";

      return success(res, {
        message,
        data: { pricing },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  remove: asyncHandler(async (req, res) => {
    try {
      await pricingService.remove(req.params.id);
      const message = "Pricing deleted successfully";

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
