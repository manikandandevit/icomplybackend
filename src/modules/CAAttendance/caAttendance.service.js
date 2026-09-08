import { AppError } from "../../core/errors/AppError.js";
import { notifyRegularizationStatus, notifyRegularizationSubmitted } from "../../core/mail/attendanceMail.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caAttendanceRepository } from "./caAttendance.repository.js";

const todayIso = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isPrivileged = (actor) => Boolean(actor?.isOwner || actor?.isCaUser || !actor?.employeeId);

const stampFrom = (date, time) => {
  const raw = String(time || "").trim();
  if (!raw) return null;
  if (/^\d{2}:\d{2}$/.test(raw)) {
    const [hour, minute] = raw.split(":").map(Number);
    const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, hour, minute, 0).toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const attendanceActorFromReq = (req) => ({
  employeeId: req.employeeId ? String(req.employeeId) : null,
  isOwner: Boolean(req.isCompanyOwner),
  isCaUser: Boolean(req.caUserId),
  actorName: req.actorName || "",
});

export const caAttendanceService = {
  list(companyId, actor = {}) {
    const selfOnly = !isPrivileged(actor) && actor.employeeId;
    return caAttendanceRepository.list(companyId, selfOnly ? actor.employeeId : null);
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

    const date = todayIso();
    const existing = await caAttendanceRepository.findByEmployeeDate(companyId, employee.id, date);
    const now = new Date().toISOString();

    if (kind === "in") {
      if (existing?.checkIn) {
        throw new AppError("Already checked in today", 422, "ALREADY_CHECKED_IN");
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
    return caAttendanceRepository.update(existing.id, companyId, { checkOut: now });
  },

  async create(companyId, data, actor = {}) {
    if (!isPrivileged(actor)) {
      throw new AppError("Only company admin can create attendance records", 403, "FORBIDDEN");
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
    if (!isPrivileged(actor)) {
      throw new AppError("Only company admin can edit attendance time", 403, "FORBIDDEN");
    }
    const existing = await caAttendanceRepository.getById(id, companyId);
    if (!existing) {
      throw new AppError("Attendance record not found", 404, "ATTENDANCE_NOT_FOUND");
    }
    const date = String(existing.date || "").slice(0, 10);
    const checkIn = stampFrom(date, payload.checkIn);
    const checkOut = stampFrom(date, payload.checkOut);
    if (!checkIn) {
      throw new AppError("Check-in time is required", 422, "CHECK_IN_REQUIRED");
    }
    if (checkOut && checkOut <= checkIn) {
      throw new AppError("Check-out must be after check-in", 422, "CHECK_OUT_INVALID");
    }
    return caAttendanceRepository.update(id, companyId, {
      checkIn,
      checkOut,
      status: "Present",
    });
  },

  async update(id, companyId, data, actor = {}) {
    if (!isPrivileged(actor)) {
      throw new AppError("Only company admin can edit attendance", 403, "FORBIDDEN");
    }
    const existing = await caAttendanceRepository.getById(id, companyId);
    if (!existing) {
      throw new AppError("Attendance record not found", 404, "ATTENDANCE_NOT_FOUND");
    }
    return caAttendanceRepository.update(id, companyId, data);
  },

  async applyRegularization(companyId, payload = {}, actor = {}) {
    if (isPrivileged(actor) || !actor.employeeId) {
      throw new AppError("Only employees can apply regularization", 403, "FORBIDDEN");
    }

    const employee = await caEmployeesRepository.findById(actor.employeeId, companyId);
    if (!employee || employee.status === "Inactive") {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const date = String(payload.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError("Select a date", 422, "DATE_REQUIRED");
    }
    if (date > todayIso()) {
      throw new AppError("Cannot regularize a future date", 422, "FUTURE_DATE");
    }

    const reason = String(payload.reason || "").trim();
    if (!reason) {
      throw new AppError("Reason is required", 422, "REASON_REQUIRED");
    }

    const requestedCheckIn = stampFrom(date, payload.checkIn);
    const requestedCheckOut = stampFrom(date, payload.checkOut);
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

    const patch = {
      requestedCheckIn,
      requestedCheckOut,
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

    void notifyRegularizationSubmitted({ companyId, employee, record: saved });
    return saved;
  },

  async regularize(id, companyId, { status }, actor = {}) {
    if (!isPrivileged(actor)) {
      throw new AppError("Only company admin can review regularization", 403, "FORBIDDEN");
    }
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

    const patch = {
      regularizationStatus: status,
      regularizationReviewedBy: actor.actorName || "Company Admin",
    };

    if (status === "Approved") {
      if (!existing.requestedCheckIn) {
        throw new AppError("Requested check-in time is missing", 422, "CHECK_IN_REQUIRED");
      }
      patch.checkIn = existing.requestedCheckIn;
      patch.checkOut = existing.requestedCheckOut || null;
      patch.status = "Present";
    }

    const updated = await caAttendanceRepository.update(id, companyId, patch);
    if (!updated) {
      throw new AppError("Unable to update regularization", 500, "REGULARIZE_FAILED");
    }

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

    return updated;
  },
};
