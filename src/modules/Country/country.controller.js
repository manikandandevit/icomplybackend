import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { countryService } from "./country.service.js";
import { validateCountryBody } from "./country.validator.js";

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

const validatedName = (res, body) => {
  const { isValid, errors, value } = validateCountryBody(body);

  if (isValid) {
    return value.name;
  }

  const message = Object.values(errors)[0] || "Validation failed";
  fail(res, {
    status: 422,
    message,
    code: "VALIDATION_ERROR",
    errors,
  });
  return null;
};

export const countryController = {
  list: asyncHandler(async (_req, res) => {
    const countries = await countryService.list();

    return success(res, {
      message: "Countries loaded",
      data: { countries },
    });
  }),

  getStates: asyncHandler(async (req, res) => {
    const country = req.query.countryCode || req.query.countryName || req.query.country || "";
    const states = countryService.getStates(country);

    return success(res, {
      message: "States loaded",
      data: { states },
    });
  }),

  getCities: asyncHandler(async (req, res) => {
    const country = req.query.countryCode || req.query.countryName || req.query.country || "";
    const state = req.query.stateCode || req.query.stateName || req.query.state || "";
    const cities = countryService.getCities(country, state);

    return success(res, {
      message: "Cities loaded",
      data: { cities },
    });
  }),

  create: asyncHandler(async (req, res) => {
    const name = validatedName(res, req.body);

    if (!name) {
      return;
    }

    try {
      const country = await countryService.create(name);
      const message = "Country added successfully";

      return success(res, {
        status: 201,
        message,
        data: { country },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const name = validatedName(res, req.body);

    if (!name) {
      return;
    }

    try {
      const country = await countryService.update(req.params.id, name);
      const message = "Country updated successfully";

      return success(res, {
        message,
        data: { country },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  remove: asyncHandler(async (req, res) => {
    try {
      await countryService.remove(req.params.id);
      const message = "Country deleted successfully";

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
