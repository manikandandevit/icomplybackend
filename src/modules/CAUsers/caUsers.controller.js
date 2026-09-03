import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { caUsersService } from "./caUsers.service.js";
import { validateCAUserBody } from "./caUsers.validator.js";

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

export const caUsersController = {
  list: asyncHandler(async (req, res) => {
    const users = await caUsersService.list(req.companyId);

    return success(res, {
      message: "Users loaded",
      data: { users },
    });
  }),

  get: asyncHandler(async (req, res) => {
    try {
      const user = await caUsersService.get(req.params.id, req.companyId);

      return success(res, {
        message: "User loaded",
        data: { user },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  create: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCAUserBody(req.body);

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
      const user = await caUsersService.create(req.companyId, value);

      return success(res, {
        status: 201,
        message: "User created successfully",
        data: { user },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const { isValid, errors, value } = validateCAUserBody(req.body, { passwordRequired: false });

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
      const user = await caUsersService.update(req.params.id, req.companyId, value);

      return success(res, {
        message: "User updated successfully",
        data: { user },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const status = req.body?.status === "Inactive" ? "Inactive" : "Active";

    try {
      const user = await caUsersService.updateStatus(req.params.id, req.companyId, status);

      return success(res, {
        message: `User marked as ${status}`,
        data: { user },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  delete: asyncHandler(async (req, res) => {
    try {
      await caUsersService.delete(req.params.id, req.companyId);

      return success(res, {
        message: "User deleted successfully",
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
