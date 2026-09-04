import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { caEmployeesService } from "./caEmployees.service.js";
import { validateEmployeeBody } from "./caEmployees.validator.js";

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

export const caEmployeesController = {
  list: asyncHandler(async (req, res) => {
    const employees = await caEmployeesService.list(req.companyId);
    return success(res, {
      message: "Employees loaded",
      data: { employees },
    });
  }),

  get: asyncHandler(async (req, res) => {
    try {
      const employee = await caEmployeesService.get(req.params.id, req.companyId);
      return success(res, {
        message: "Employee loaded",
        data: { employee },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateEmployeeBody(req.body);
    if (!isValid) {
      const message = Object.values(errors)[0] || "Validation failed";
      return fail(res, {
        status: 422,
        message,
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const employee = await caEmployeesService.create(req.companyId, value);
      return success(res, {
        status: 201,
        message: "Employee created successfully",
        data: { employee },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  delete: asyncHandler(async (req, res) => {
    try {
      await caEmployeesService.delete(req.params.id, req.companyId);
      return success(res, { message: "Employee deleted successfully" });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
