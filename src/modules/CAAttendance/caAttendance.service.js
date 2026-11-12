import { formatDateToIST } from "../../core/utils/date.js";
import { AppError } from "../../core/errors/AppError.js";
import { notifyRegularizationStatus, notifyRegularizationSubmitted } from "../../core/mail/attendanceMail.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caAttendanceRepository } from "./caAttendance.repository.js";
import { syncOtRequest } from "./caAttendanceOtSync.js";
import { caFcmService } from "../CANotifications/caFcm.service.js";
import { caPermissionsService } from "../CAPermissions/caPermissions.service.js";
import { assertCheckInOpen, punchWindowFor } from "./caAttendance.window.js";
import { todayIn, zonedDateTimeToUtc, zoneForEmployee, zoneForEstablishment } from "../../core/utils/timezone.js";

const todayIso = (zone = "Asia/Kolkata") => todayIn(zone);

const isPrivileged = (actor) => Boolean(actor?.isOwner || actor?.isCaUser || !actor?.employeeId);

const stampFrom = (date, time, zone = "Asia/Kolkata") => {
  const dt = zonedDateTimeToUtc(date, time, zone);
  return dt ? dt.toISOString() : null;
};

export const attendanceActorFromReq = (req) => ({
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

export const caAttendanceService = {


async list(companyId, actor = {}) {
    let scope = "self";
    if (isPrivileged(actor)) {
      scope = "all";
    } else {
      scope = await caPermissionsService.getScope(companyId, actor, "attendance");
    }
    return caAttendanceRepository.list(companyId, {
      scope,
      employeeId: actor.employeeId,
      departmentId: actor.departmentId,
    });
  },

  /** Check-in window for the signed-in employee (or ?employeeId= for admins). */
  async punchWindow(companyId, actor = {}, employeeIdParam = null) {
    const employeeId = !isPrivileged(actor) && actor.employeeId ? actor.employeeId : employeeIdParam || actor.employeeId;
    const shift = employeeId ? await caAttendanceRepository.shiftForEmployee(companyId, employeeId) : null;
    const zone = employeeId ? await zoneForEmployee(employeeId, companyId) : "Asia/Kolkata";
    return punchWindowFor(shift, new Date(), zone);
  },

  async punch(companyId, action, payload = {}, actor = {}) {
    const kind = String(action || "").toLowerCase() === "out" ? "out" : "in";
    let employeeId = String(payload.employeeId || "").trim();
    if (!isPrivileged(actor) && actor.employeeId) {
      employeeId = String(actor.employeeId);
    }
    if (!employeeId) {
      throw new AppError("Select an employee", 422, "EMPLOYEE_REQUIRED");
    }

    const employee = await caEmployeesRepository.findById(employeeId, companyId);
    if (!employee || employee.status === "Inactive") {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const zone = await zoneForEmployee(employee.id, companyId);
    const date = (payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)) ? payload.date : todayIso(zone);
    const existing = await caAttendanceRepository.findByEmployeeDate(companyId, employee.id, date);
    const now = new Date().toISOString();

    if (kind === "in") {
      if (existing?.checkIn) {
        throw new AppError("Already checked in today", 422, "ALREADY_CHECKED_IN");
      }
      // Employee self check-in for today: only from shift start - 10 min until shift end.
      // Admin punches and other dates are not restricted here.
      const isToday = !payload.date || payload.date === todayIso(zone) || payload.date === todayIn(zone);
      if (!isPrivileged(actor) && isToday) {
        const shift = await caAttendanceRepository.shiftForEmployee(companyId, employee.id);
        assertCheckInOpen(punchWindowFor(shift, new Date(), zone));
      }
      if (!existing) {
        const created = await caAttendanceRepository.insert({
          establishmentId: employee.establishmentId,
          establishmentName: employee.establishmentName,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.employeeCode,
          date,
          checkIn: now,
          status: "Present",
          createdByCompanyId: companyId,
        });
        if (!created) {
          throw new AppError("Unable to check in", 500, "CHECK_IN_FAILED");
        }
        return created;
      }
      return caAttendanceRepository.update(existing.id, companyId, { checkIn: now, status: "Present" });
    }

    if (!existing?.checkIn) {
      throw new AppError("Check in first", 422, "CHECK_IN_REQUIRED");
    }
    if (existing.checkOut) {
      throw new AppError("Already checked out today", 422, "ALREADY_CHECKED_OUT");
    }
    const updated = await caAttendanceRepository.update(existing.id, companyId, { checkOut: now });
    void syncOtRequest(companyId, existing.id);
    return updated;
  },

  async create(companyId, data, actor = {}) {
    const canAdd = isPrivileged(actor) || await caPermissionsService.can(companyId, actor, "attendance", "add");
    if (!canAdd) {
      throw new AppError("You do not have permission to create attendance records", 403, "FORBIDDEN");
    }
    if (!data.employeeId || !data.date || !data.establishmentId) {
      throw new AppError("Missing required fields for attendance", 422, "VALIDATION_ERROR");
    }
    return caAttendanceRepository.insert({
      ...data,
      createdByCompanyId: companyId,
    });
  },

  async updateTimes(id, companyId, payload = {}, actor = {}) {
    const canEdit = isPrivileged(actor) || await caPermissionsService.can(companyId, actor, "attendance", "edit") || await caPermissionsService.can(companyId, actor, "daily", "edit");
    if (!canEdit) {
      throw new AppError("You do not have permission to edit attendance time", 403, "FORBIDDEN");
    }

    let existing = null;
    if (id && String(id) !== "0" && String(id) !== "new" && String(id) !== "undefined") {
      existing = await caAttendanceRepository.getById(id, companyId);
    }
    if (!existing && payload.employeeId && payload.date) {
      existing = await caAttendanceRepository.findByEmployeeDate(companyId, payload.employeeId, payload.date);
    }

    const empId = existing?.employeeId || payload.employeeId;
    const zone = empId ? await zoneForEmployee(empId, companyId) : "Asia/Kolkata";
    const date = existing?.date instanceof Date ? existing.date.toISOString().slice(0, 10) : (existing?.date || payload.date || todayIso(zone));
    const checkIn = stampFrom(date, payload.checkIn, zone);
    const checkOut = stampFrom(date, payload.checkOut, zone);
    if (!checkIn) {
      throw new AppError("Check-in time is required", 422, "CHECK_IN_REQUIRED");
    }
    if (checkOut && checkOut <= checkIn) {
      throw new AppError("Check-out must be after check-in", 422, "CHECK_OUT_INVALID");
    }

    let updated;
    if (existing) {
      updated = await caAttendanceRepository.update(existing.id, companyId, {
        checkIn,
        checkOut: checkOut || null,
        status: "Present",
      });
      void syncOtRequest(companyId, existing.id);
    } else {
      const empId = payload.employeeId;
      if (!empId) {
        throw new AppError("Employee is required", 422, "EMPLOYEE_REQUIRED");
      }
      const employee = await caEmployeesRepository.findById(empId, companyId);
      if (!employee) {
        throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
      }
      updated = await caAttendanceRepository.insert({
        establishmentId: employee.establishmentId,
        establishmentName: employee.establishmentName,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        date,
        checkIn,
        checkOut: checkOut || null,
        status: "Present",
        createdByCompanyId: companyId,
      });
      if (updated) {
        void syncOtRequest(companyId, updated.id);
      }
    }
    return updated;
  },

  async update(id, companyId, data, actor = {}) {
    const canEdit = isPrivileged(actor) || await caPermissionsService.can(companyId, actor, "attendance", "edit");
    if (!canEdit) {
      throw new AppError("You do not have permission to edit attendance", 403, "FORBIDDEN");
    }
    const existing = await caAttendanceRepository.getById(id, companyId);
    if (!existing) {
      throw new AppError("Attendance record not found", 404, "ATTENDANCE_NOT_FOUND");
    }
    return caAttendanceRepository.update(id, companyId, data);
  },

  async applyRegularization(companyId, payload = {}, actor = {}) {
    let targetEmployeeId = actor.employeeId;
    if (isPrivileged(actor) || !targetEmployeeId) {
      targetEmployeeId = payload.employeeId;
    }
    if (!targetEmployeeId) {
      throw new AppError("Select an employee", 422, "EMPLOYEE_REQUIRED");
    }

    const employee = await caEmployeesRepository.findById(targetEmployeeId, companyId);
    if (!employee || employee.status === "Inactive") {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const zone = await zoneForEmployee(employee.id, companyId);
    const date = payload.date ? String(payload.date).slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError("Select a date", 422, "DATE_REQUIRED");
    }
    if (date > todayIso(zone)) {
      throw new AppError("Cannot regularize a future date", 422, "FUTURE_DATE");
    }

    const reason = String(payload.reason || "").trim();
    if (!reason) {
      throw new AppError("Reason is required", 422, "REASON_REQUIRED");
    }

    const requestedCheckIn = stampFrom(date, payload.checkIn, zone);
    const requestedCheckOut = stampFrom(date, payload.checkOut, zone);
    if (!requestedCheckIn) {
      throw new AppError("Requested check-in time is required", 422, "CHECK_IN_REQUIRED");
    }
    if (requestedCheckOut && requestedCheckOut <= requestedCheckIn) {
      throw new AppError("Check-out must be after check-in", 422, "CHECK_OUT_INVALID");
    }

    const existing = await caAttendanceRepository.findByEmployeeDate(companyId, employee.id, date);
    if (existing?.regularizationStatus === "Pending") {
      throw new AppError("A regularization request is already pending for this date", 422, "ALREADY_PENDING");
    }
    if (existing?.regularizationStatus === "Approved") {
      throw new AppError("Attendance for this date is already regularized and approved", 422, "ALREADY_APPROVED");
    }
    // Nothing to fix: checked in within grace and checked out at / after shift end.
    if (existing?.checkIn && existing?.checkOut && !existing.lateCheckIn && !existing.earlyCheckOut) {
      throw new AppError("Attendance for this date is already correct. No regularization needed.", 422, "ALREADY_CORRECT");
    }

    const patch = {
      requestedCheckIn,
      requestedCheckOut,
      originalCheckIn: existing?.checkIn || null,
      originalCheckOut: existing?.checkOut || null,
      regularizationStatus: "Pending",
      regularizationReason: reason,
      regularizationReviewedBy: null,
    };

    const saved = existing
      ? await caAttendanceRepository.update(existing.id, companyId, patch)
      : await caAttendanceRepository.insert({
        establishmentId: employee.establishmentId,
        establishmentName: employee.establishmentName,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        date,
        status: "Absent",
        createdByCompanyId: companyId,
        ...patch,
      });

    if (!saved) {
      throw new AppError("Unable to submit regularization request", 500, "REGULARIZE_FAILED");
    }

    setImmediate(async () => {
      try {
        void syncOtRequest(companyId, saved.id);
        void notifyRegularizationSubmitted({ companyId, employee, record: saved });
        void caFcmService.notifyAdminsOfRegularizationRequest({ companyId, employee, record: saved });
      } catch (err) {
        console.error("Regularization apply notification error:", err);
      }
    });
    return saved;
  },

  /** Employee cancels their own Pending regularization; the requested times are cleared. */
  async cancelRegularization(id, companyId, actor = {}) {
    const existing = await caAttendanceRepository.getById(id, companyId);
    if (!existing) {
      throw new AppError("Attendance record not found", 404, "ATTENDANCE_NOT_FOUND");
    }
    if (existing.regularizationStatus !== "Pending") {
      throw new AppError("Only pending regularization requests can be cancelled", 422, "NOT_PENDING");
    }
    if (!isPrivileged(actor) && String(existing.employeeId) !== String(actor.employeeId)) {
      throw new AppError("You can only cancel your own regularization request", 403, "FORBIDDEN");
    }
    const updated = await caAttendanceRepository.update(existing.id, companyId, {
      regularizationStatus: "Cancelled",
      regularizationReviewedBy: actor.actorName || "Employee",
      requestedCheckIn: null,
      requestedCheckOut: null,
    });
    if (!updated) {
      throw new AppError("Unable to cancel regularization request", 500, "REGULARIZE_CANCEL_FAILED");
    }
    // Requested check-out may have created an auto OT request: recalculate.
    void syncOtRequest(companyId, existing.id);
    return updated;
  },

  async regularize(id, companyId, { status, reason, adminReply } = {}, actor = {}) {
    if (!["Approved", "Rejected"].includes(status)) {
      throw new AppError("Invalid regularization status", 422, "INVALID_STATUS");
    }

    const existing = await caAttendanceRepository.getById(id, companyId);
    if (!existing) {
      throw new AppError("Attendance record not found", 404, "ATTENDANCE_NOT_FOUND");
    }
    if (existing.regularizationStatus !== "Pending") {
      throw new AppError("Only pending requests can be reviewed", 422, "NOT_PENDING");
    }

    // 1. SOX Maker-Checker: Self-approval check
    if (actor.employeeId && String(existing.employeeId) === String(actor.employeeId)) {
      throw new AppError("You cannot review or approve your own attendance regularization request", 403, "SELF_APPROVAL_FORBIDDEN");
    }

    const employee = await caEmployeesRepository.findById(existing.employeeId, companyId);
    const isReportingManager = Boolean(actor.employeeId && employee && (
      String(employee.reporting_to_id) === String(actor.employeeId) ||
      String(employee.details?.reportingToId) === String(actor.employeeId)
    ));

    // 2. Permission check: Admin or Reporting Manager or Attendance Edit permission
    const canReview = isPrivileged(actor) || isReportingManager || await caPermissionsService.can(companyId, actor, "attendance", "edit") || await caPermissionsService.can(companyId, actor, "requests", "edit");
    if (!canReview) {
      throw new AppError("You do not have permission to review regularization", 403, "FORBIDDEN");
    }

    // 3. Department Scope check (reporting manager is allowed to review reportees)
    if (!isPrivileged(actor) && !isReportingManager) {
      const scope = await caPermissionsService.getScope(companyId, actor, "attendance");
      if (scope === "self") {
        throw new AppError("You cannot review team regularization requests", 403, "FORBIDDEN");
      }
      if (scope === "department") {
        const emp = await caEmployeesRepository.findById(existing.employeeId, companyId);
        if (emp && actor.departmentId && String(emp.departmentId) !== String(actor.departmentId)) {
          throw new AppError("You can only review attendance in your own department", 403, "DEPARTMENT_MISMATCH");
        }
      }
    }

    const reply = String(adminReply || reason || "").trim();
    const patch = {
      regularizationStatus: status,
      regularizationReviewedBy: actor.actorName || "Company Admin",
    };
    if (reply) {
      patch.adminReply = reply;
    }

    if (status === "Approved") {
      if (!existing.requestedCheckIn) {
        throw new AppError("Requested check-in time is missing", 422, "CHECK_IN_REQUIRED");
      }
      if (!existing.originalCheckIn) {
        patch.originalCheckIn = existing.checkIn || null;
      }
      if (!existing.originalCheckOut) {
        patch.originalCheckOut = existing.checkOut || null;
      }
      patch.checkIn = existing.requestedCheckIn;
      patch.checkOut = existing.requestedCheckOut || null;
      patch.status = "Present";
    }

    const updated = await caAttendanceRepository.update(id, companyId, patch);
    if (!updated) {
      throw new AppError("Unable to update regularization", 500, "REGULARIZE_FAILED");
    }

    if (status === "Approved") {
      void syncOtRequest(companyId, id);
    }

    setImmediate(async () => {
      try {
        const employee = await caEmployeesRepository.findById(existing.employeeId, companyId);
        if (employee) {
          void notifyRegularizationStatus({
            companyId,
            employee,
            record: {
              ...updated,
              checkIn: existing.checkIn,
              checkOut: existing.checkOut,
            },
            action: status === "Approved" ? "approved" : "rejected",
            reviewedByName: actor.actorName || "Company Admin",
          });
        }

        void caFcmService.notifyEmployeeOfRegularizationStatus({
          companyId,
          employeeId: existing.employeeId,
          status,
          date: existing.date,
          reviewerName: actor.actorName || "Company Admin",
          adminReply: reply,
        });
      } catch (err) {
        console.error("Regularization post-review notification error:", err);
      }
    });

    return updated;
  },
};
