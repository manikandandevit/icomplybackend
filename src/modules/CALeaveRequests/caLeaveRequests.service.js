import { AppError } from "../../core/errors/AppError.js";
import { countSessionDays, normalizeSession } from "../../core/leave/workingDays.js";
import { notifyLeaveStatus, notifyLeaveSubmitted } from "../../core/mail/leaveMail.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caLeaveRequestsRepository } from "./caLeaveRequests.repository.js";
import { leaveCalendarFor } from "./leaveCalendar.js";
import { caLeaveYearBalancesService } from "../CALeaveYearBalances/caLeaveYearBalances.service.js";

const leaveTypeName = (item) => {
  const name = item?.values?.name || "Leave";
  return item?.values?.code ? `${name} (${item.values.code})` : name;
};

export const leaveActorFromReq = (req) => ({
  employeeId: req.employeeId ? String(req.employeeId) : null,
  isOwner: Boolean(req.isCompanyOwner),
  isCaUser: Boolean(req.caUserId),
});

export const isCompanyPrivileged = (actor) => Boolean(actor?.isOwner || actor?.isCaUser || !actor?.employeeId);

const reportingIdOf = (request, employee) =>
  String(request?.reportingToId || employee?.details?.reportingToId || "").trim();

export const assertCanReviewLeave = (request, actor, employee) => {
  if (isCompanyPrivileged(actor)) return;
  if (!actor?.employeeId) {
    throw new AppError("You cannot review this leave request", 403, "FORBIDDEN");
  }
  if (String(request.employeeId) === String(actor.employeeId)) {
    throw new AppError("You cannot review your own leave request", 403, "FORBIDDEN");
  }
  if (reportingIdOf(request, employee) !== String(actor.employeeId)) {
    throw new AppError("You can only review your team's leave requests", 403, "FORBIDDEN");
  }
};

export const caLeaveRequestsService = {
  list: (companyId, actor, scope) => caLeaveRequestsRepository.list(companyId, { scope, actor }),

  balances: (companyId, year) => caLeaveYearBalancesService.listYear(companyId, year),

  async create(companyId, payload, actor = {}) {
    const next = { ...payload };
    if (!isCompanyPrivileged(actor) && actor.employeeId) {
      next.employeeId = String(actor.employeeId);
    }

    const employee = await caEmployeesRepository.findById(next.employeeId, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (String(employee.establishmentId) !== String(next.establishmentId)) {
      throw new AppError("Employee does not belong to this establishment", 422, "EMPLOYEE_ESTABLISHMENT_MISMATCH");
    }

    const establishment = await caEstablishmentsRepository.findById(next.establishmentId);
    if (!establishment) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    const leaveType = await caHrMasterRepository.findById(next.leaveTypeId, companyId, "leave-types");
    if (!leaveType) {
      throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
    }

    const calendar = await leaveCalendarFor(companyId, employee, establishment);
    next.session = normalizeSession(next.session);
    next.days = countSessionDays(next.startDate, next.endDate, next.session, calendar);
    if (next.days <= 0) {
      throw new AppError("Selected dates are week off or holidays. Choose working days.", 422, "LEAVE_NO_WORKING_DAYS");
    }

    const overlap = await caLeaveRequestsRepository.findOverlapping(
      companyId,
      employee.id,
      next.startDate,
      next.endDate,
      ["Pending", "Approved"],
      null,
      next.session,
    );
    if (overlap) {
      throw new AppError("Leave already applied for these dates", 422, "LEAVE_DATES_OVERLAP");
    }

    const year = Number(String(next.startDate).slice(0, 4)) || new Date().getFullYear();
    const entitled = await caLeaveYearBalancesService.entitledFor(companyId, employee, leaveType, year);
    const used = await caLeaveRequestsRepository.usedDays(companyId, employee.id, leaveType.id, year);
    const remaining = Math.max(entitled - used, 0);

    if (next.days > remaining) {
      throw new AppError(`Only ${remaining} days available`, 422, "LEAVE_BALANCE_EXCEEDED");
    }

    const created = await caLeaveRequestsRepository.create(companyId, {
      ...next,
      establishmentName: establishment.name,
      employeeName: employee.name,
      employeeCode: employee.employeeCode,
      leaveTypeName: leaveTypeName(leaveType),
      approverName: employee.details?.reportingToName || "",
      reportingToId: employee.details?.reportingToId || "",
    });
    if (!created) {
      throw new AppError("Unable to create leave request", 500, "LEAVE_REQUEST_CREATE_FAILED");
    }
    void notifyLeaveSubmitted({ companyId, employee, request: created, kind: "leave" });
    return created;
  },

  async approve(id, companyId, reviewedByName = "", actor = {}) {
    const request = await caLeaveRequestsRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Leave request not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending requests can be approved", 422, "LEAVE_REQUEST_NOT_PENDING");
    }

    const employee = await caEmployeesRepository.findById(request.employeeId, companyId);
    assertCanReviewLeave(request, actor, employee);

    const leaveType = await caHrMasterRepository.findById(request.leaveTypeId, companyId, "leave-types");
    if (!employee || !leaveType) {
      throw new AppError("Leave request data is incomplete", 422, "LEAVE_REQUEST_INVALID");
    }

    const overlap = await caLeaveRequestsRepository.findOverlapping(
      companyId,
      request.employeeId,
      request.startDate,
      request.endDate,
      ["Pending", "Approved"],
      request.id,
      request.session,
    );
    if (overlap) {
      throw new AppError("Leave already applied for these dates", 422, "LEAVE_DATES_OVERLAP");
    }

    const year = Number(String(request.startDate).slice(0, 4)) || new Date().getFullYear();
    const entitled = await caLeaveYearBalancesService.entitledFor(companyId, employee, leaveType, year);
    const used = await caLeaveRequestsRepository.usedDays(
      companyId,
      employee.id,
      leaveType.id,
      year,
      ["Approved"],
    );
    const remaining = Math.max(entitled - used, 0);
    if (request.days > remaining) {
      throw new AppError(`Only ${remaining} days available`, 422, "LEAVE_BALANCE_EXCEEDED");
    }

    const updated = await caLeaveRequestsRepository.updateStatus(id, companyId, {
      status: "Approved",
      reviewedByName,
    });
    if (!updated) {
      throw new AppError("Unable to approve leave request", 500, "LEAVE_REQUEST_UPDATE_FAILED");
    }
    void notifyLeaveStatus({
      companyId,
      employee,
      request: updated,
      action: "approved",
      reviewedByName,
    });
    return updated;
  },

  async reject(id, companyId, rejectReason, reviewedByName = "", actor = {}) {
    const request = await caLeaveRequestsRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Leave request not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending requests can be rejected", 422, "LEAVE_REQUEST_NOT_PENDING");
    }

    const employee = await caEmployeesRepository.findById(request.employeeId, companyId);
    assertCanReviewLeave(request, actor, employee);

    const reason = String(rejectReason || "").trim();
    if (!reason) {
      throw new AppError("Enter reject reason", 422, "REJECT_REASON_REQUIRED");
    }

    const updated = await caLeaveRequestsRepository.updateStatus(id, companyId, {
      status: "Rejected",
      rejectReason: reason,
      reviewedByName,
    });
    if (!updated) {
      throw new AppError("Unable to reject leave request", 500, "LEAVE_REQUEST_UPDATE_FAILED");
    }
    void notifyLeaveStatus({
      companyId,
      employee,
      request: updated,
      action: "rejected",
      reviewedByName,
    });
    return updated;
  },

  async cancel(id, companyId, actor = {}) {
    const request = await caLeaveRequestsRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Leave request not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending leave can be cancelled", 422, "LEAVE_REQUEST_NOT_PENDING");
    }
    if (!isCompanyPrivileged(actor) && String(request.employeeId) !== String(actor.employeeId)) {
      throw new AppError("You can only cancel your own leave request", 403, "FORBIDDEN");
    }
    const removed = await caLeaveRequestsRepository.removePending(id, companyId);
    if (!removed) {
      throw new AppError("Unable to cancel leave request", 500, "LEAVE_REQUEST_CANCEL_FAILED");
    }
    return request;
  },
};
