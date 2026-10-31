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

export const employeeActorFromReq = (req) => ({
  employeeId: req.employeeId ? String(req.employeeId) : null,
  isOwner: Boolean(req.isCompanyOwner),
  isCaUser: Boolean(req.caUserId),
  actorName: req.actorName || "",
  departmentId: req.departmentId ? String(req.departmentId) : null,
  departmentName: req.departmentName || null,
  designationId: req.designationId ? String(req.designationId) : null,
  designationName: req.designationName || null,
  allowedModules: req.allowedModules || [],
});

export const caEmployeesController = {
  counts: asyncHandler(async (req, res) => {
    const counts = await caEmployeesService.counts(req.companyId);
    return success(res, {
      message: "Employee counts loaded",
      data: counts,
    });
  }),

  list: asyncHandler(async (req, res) => {
    const employees = await caEmployeesService.list(req.companyId, req.companyAccess, employeeActorFromReq(req));
    return success(res, {
      message: "Employees loaded",
      data: { employees },
    });
  }),

  get: asyncHandler(async (req, res) => {
    try {
      const employee = await caEmployeesService.get(req.params.id, req.companyId, req.companyAccess, employeeActorFromReq(req));
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
      const employee = await caEmployeesService.create(req.companyId, value, req.companyAccess);
      return success(res, {
        status: 201,
        message: "Employee created successfully",
        data: { employee },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const status = String(req.body?.status ?? "").trim() === "Active" ? "Active" : "Inactive";
    const resignationReason = req.body?.resignationReason || req.body?.reason || "";
    const lastWorkingDay = req.body?.lastWorkingDay || null;
    const resignationDate = req.body?.resignationDate || null;
    try {
      const employee = await caEmployeesService.updateStatus(
        req.params.id,
        req.companyId,
        status,
        req.companyAccess,
        { resignationReason, lastWorkingDay, resignationDate }
      );
      const message = status === "Active" 
        ? "Employee set to Active" 
        : resignationReason 
        ? "Employee marked as Resigned" 
        : "Employee set to Inactive";
      return success(res, {
        message,
        data: { employee },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
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
      const employee = await caEmployeesService.update(req.params.id, req.companyId, value, req.companyAccess, req.employeeId);
      return success(res, {
        message: "Employee updated successfully",
        data: { employee },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  delete: asyncHandler(async (req, res) => {
    try {
      await caEmployeesService.delete(req.params.id, req.companyId, req.companyAccess);
      return success(res, { message: "Employee deleted successfully" });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
