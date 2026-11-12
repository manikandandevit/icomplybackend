import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { caEmployeesService } from "./caEmployees.service.js";
import { validateEmployeeBody } from "./caEmployees.validator.js";
import { caEmployeesRepository } from "./caEmployees.repository.js";
import { preparePhoto } from "./caEmployees.photoStorage.js";

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
  /** POST /:id/photo (multipart "photo"): upload + save the profile photo. */
  uploadPhoto: asyncHandler(async (req, res) => {
    try {
      if (!req.file) throw new AppError("Choose a photo to upload", 400, "PHOTO_REQUIRED");
      const existing = await caEmployeesRepository.findById(req.params.id, req.companyId);
      if (!existing) throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
      const photo = preparePhoto(req.file);
      const employee = await caEmployeesRepository.updatePhoto(req.params.id, req.companyId, photo);
      return success(res, {
        message: "Profile photo updated",
        data: { photoUrl: employee?.photoUrl || null, employee },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  /** GET /:id/photo: the photo image from the DB (same company; token header or ?token). */
  photo: async (req, res, next) => {
    try {
      const photo = await caEmployeesRepository.findPhoto(req.params.id, req.companyId);
      if (!photo?.data) {
        return fail(res, { status: 404, message: "No photo", code: "PHOTO_NOT_FOUND" });
      }
      res.setHeader("Content-Type", photo.mime);
      res.setHeader("Content-Length", photo.data.length);
      res.setHeader("Cache-Control", "private, max-age=86400");
      return res.end(photo.data);
    } catch (error) {
      if (error instanceof AppError) return sendAppError(res, error);
      return next(error);
    }
  },

  counts: asyncHandler(async (req, res) => {
    const counts = await caEmployeesService.counts(req.companyId);
    return success(res, {
      message: "Employee counts loaded",
      data: counts,
    });
  }),

  upcomingBirthdays: asyncHandler(async (req, res) => {
    const isEmployee = Boolean(req.employeeId && !req.isCompanyOwner && !req.caUserId);
    const establishmentId = isEmployee ? req.establishmentId : req.query?.establishmentId || null;
    if (isEmployee && !establishmentId) {
      return success(res, { message: "Upcoming birthdays loaded", data: { birthdays: [] } });
    }
    const birthdays = await caEmployeesService.upcomingBirthdays(req.companyId, establishmentId, req.query?.limit);
    return success(res, {
      message: "Upcoming birthdays loaded",
      data: { birthdays },
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
