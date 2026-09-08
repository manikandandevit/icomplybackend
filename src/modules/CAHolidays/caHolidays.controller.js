import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { caHolidaysService } from "./caHolidays.service.js";
import { validateHolidayBody } from "./caHolidays.validator.js";

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

const parsedBody = (req, res) => {
  const { isValid, errors, value } = validateHolidayBody(req.body);
  if (!isValid) {
    fail(res, {
      status: 422,
      message: Object.values(errors)[0] || "Validation failed",
      code: "VALIDATION_ERROR",
      errors,
    });
    return null;
  }
  return value;
};

export const caHolidaysController = {
  list: asyncHandler(async (req, res) => {
    const holidays = await caHolidaysService.list(req.companyId);
    return success(res, { message: "Holidays loaded", data: { holidays } });
  }),

  create: asyncHandler(async (req, res) => {
    const value = parsedBody(req, res);
    if (!value) return;
    try {
      const holiday = await caHolidaysService.create(req.companyId, value);
      return success(res, {
        status: 201,
        message: "Holiday saved",
        data: { holiday },
        toast: createToast({ type: "success", message: "Holiday saved" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const value = parsedBody(req, res);
    if (!value) return;
    try {
      const holiday = await caHolidaysService.update(req.params.id, req.companyId, value);
      return success(res, {
        message: "Holiday updated",
        data: { holiday },
        toast: createToast({ type: "success", message: "Holiday updated" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  remove: asyncHandler(async (req, res) => {
    try {
      await caHolidaysService.remove(req.params.id, req.companyId);
      return success(res, {
        message: "Holiday deleted",
        toast: createToast({ type: "success", message: "Holiday deleted" }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
