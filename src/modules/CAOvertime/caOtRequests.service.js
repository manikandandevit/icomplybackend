import { AppError } from "../../core/errors/AppError.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caFcmService } from "../CANotifications/caFcm.service.js";
import { caPermissionsService } from "../CAPermissions/caPermissions.service.js";
import { caOtRequestsRepository } from "./caOtRequests.repository.js";

export const caOtRequestsService = {
  async list(companyId, filters = {}, actor = {}) {
    const activeFilters = { ...filters };
    const isCompanyAdmin = Boolean(actor.isOwner || !actor.employeeId);
    if (!isCompanyAdmin) {
      if (filters.scope === "mine") {
        // Employee Apply OT tab: only the logged-in employee's own requests
        activeFilters.employeeId = actor.employeeId;
      } else {
        // Approver screen: Manager sees requests where they are the reporting manager
        activeFilters.reportingToId = actor.employeeId;
      }
    }
    return caOtRequestsRepository.list(companyId, activeFilters);
  },

  async getById(id, companyId) {
    const row = await caOtRequestsRepository.getById(id, companyId);
    if (!row) throw new AppError("Overtime request not found", 404, "NOT_FOUND");
    return row;
  },

  async create(companyId, payload, actor = {}) {
    const employeeId = payload.employeeId || actor.employeeId;
    if (!employeeId) {
      throw new AppError("Employee is required", 400, "MISSING_EMPLOYEE");
    }

    const employee = await caEmployeesRepository.findById(employeeId, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    if (actor.employeeId && !actor.isOwner && String(employee.id) !== String(actor.employeeId)) {
      const isReportingManager = String(employee.reportingToId || employee.details?.reportingToId) === String(actor.employeeId);
      if (!isReportingManager) {
        throw new AppError("You can only apply OT for yourself or your reportees", 403, "FORBIDDEN");
      }
    }

    const date = payload.date || payload.workDate;
    if (!date) {
      throw new AppError("Working date is required", 400, "MISSING_DATE");
    }

    // Duplicate check: Prevent multiple OT requests on the same date for the employee
    const dateStr = String(date).slice(0, 10);
    const existingList = await caOtRequestsRepository.list(companyId, {
      employeeId: employee.id,
    });
    const existingOnDate = existingList.find(
      (r) => String(r.workDate || r.date).slice(0, 10) === dateStr
    );
    if (existingOnDate) {
      if (existingOnDate.status === "Pending") {
        throw new AppError(
          "An overtime request is already pending review for this date",
          409,
          "ALREADY_PENDING"
        );
      }
      if (existingOnDate.status === "Approved") {
        throw new AppError(
          "Overtime for this date is already approved",
          409,
          "ALREADY_APPROVED"
        );
      }
    }

    const hours = Number(payload.hours || payload.otHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new AppError("Valid OT hours are required", 400, "INVALID_HOURS");
    }

    let establishmentName = payload.establishmentName || employee.establishmentName;
    let establishmentId = payload.establishmentId || employee.establishmentId;
    if (!establishmentName && establishmentId) {
      const est = await caEstablishmentsRepository.findById(establishmentId);
      if (est) establishmentName = est.name;
    }

    const requestData = {
      establishmentId,
      establishmentName: establishmentName || "",
      employeeId: employee.id,
      employeeName: employee.name,
      employeeCode: employee.employeeCode,
      date,
      workDate: date,
      hours,
      workedOtHours: hours,
      otHours: String(hours),
      otMinutes: Math.round(hours * 60),
      totalWorkingHours: payload.totalWorkingHours || String((8 + hours).toFixed(1)),
      workHours: Number(payload.workHours) || 8.0,
      reason: payload.reason || "Manual Overtime request",
      type: payload.type || payload.otTypeName || "Weekday Ot",
      status: "Pending",
      reportingToId: employee.reportingToId || employee.details?.reportingToId || null,
      approverName: employee.reportingToName || employee.details?.reportingToName || "Company Admin",
      attendanceId: payload.attendanceId || null,
      source: "manual",
    };

    const created = await caOtRequestsRepository.create(companyId, requestData);

    if (created) {
      void caFcmService.notifyApproversOfOtRequest({
        companyId,
        employee,
        otRequest: created,
      });
    }

    return created;
  },

  async approve(id, companyId, payload = {}, actor = {}) {
    const existing = await this.getById(id, companyId);
    if (existing.status !== "Pending") {
      throw new AppError(`Cannot approve an OT request that is already ${existing.status}`, 400, "INVALID_STATUS");
    }

    // 1. SOX Maker-Checker: Self-approval check
    if (actor.employeeId && String(existing.employeeId) === String(actor.employeeId)) {
      throw new AppError("You cannot review or approve your own overtime request", 403, "SELF_APPROVAL_FORBIDDEN");
    }

    // 2. Permission check: Admin, Reporting Manager, or OT Edit permission
    const employee = await caEmployeesRepository.findById(existing.employeeId, companyId);
    const isReportingManager = Boolean(
      actor.employeeId && (
        String(existing.reportingToId || employee?.reportingToId || employee?.details?.reportingToId) === String(actor.employeeId)
      )
    );

    const isPrivileged = Boolean(actor.isOwner || !actor.employeeId);
    if (!isPrivileged && !isReportingManager) {
      const canReview = await caPermissionsService.can(companyId, actor, "ot-requests", "edit") ||
                        await caPermissionsService.can(companyId, actor, "ot", "edit");
      if (!canReview) {
        throw new AppError("You do not have permission to review overtime requests", 403, "FORBIDDEN");
      }

      const scope = await caPermissionsService.getScope(companyId, actor, "ot-requests");
      if (scope === "self") {
        throw new AppError("You can only review overtime requests for your direct reportees", 403, "FORBIDDEN");
      }
      if (scope === "department") {
        const reqDept = String(employee?.departmentId || employee?.department_id || "");
        const actorDept = String(actor?.departmentId || "");
        if (reqDept && actorDept && reqDept !== actorDept) {
          throw new AppError("You can only review overtime in your own department", 403, "DEPARTMENT_MISMATCH");
        }
      }
    }

    const otTypeName = payload.otTypeName || payload.type || existing.type || "Weekday Ot";

    // Check OT Type policy from Master to enforce maxHours cap
    const otTypes = await caHrMasterRepository.list(companyId, "ot-type").catch(() => []);
    const matchedType = otTypes.find(
      (t) => String(t.values?.name || "").trim().toLowerCase() === String(otTypeName).trim().toLowerCase()
    );

    const workedHours = Number(existing.workedOtHours || existing.hours || existing.otHours || 0);
    let payableHours = workedHours;

    if (matchedType) {
      const minH = matchedType.values?.minHours ? Number(matchedType.values.minHours) : null;
      if (minH && minH > 0 && workedHours < minH) {
        throw new AppError(
          `Worked OT hours (${workedHours}h) is less than the minimum required (${minH}h) for ${otTypeName}`,
          400,
          "MIN_HOURS_NOT_MET"
        );
      }
      const maxH = matchedType.values?.maxHours ? Number(matchedType.values.maxHours) : null;
      if (maxH && maxH > 0 && workedHours > maxH) {
        payableHours = maxH;
      }
    }

    if (payload.hours && Number(payload.hours) > 0) {
      const candidateH = Number(payload.hours);
      const maxH = matchedType?.values?.maxHours ? Number(matchedType.values.maxHours) : null;
      payableHours = (maxH && maxH > 0 && candidateH > maxH) ? maxH : candidateH;
    }

    const updated = await caOtRequestsRepository.update(id, companyId, {
      status: "Approved",
      type: otTypeName,
      hours: payableHours,
      workedOtHours: workedHours,
      reviewedByName: actor.name || "Company Admin",
      reviewedAt: new Date().toISOString(),
    });

    void caFcmService.notifyEmployeeOfOtStatus({
      companyId,
      employeeId: existing.employeeId,
      status: "Approved",
      date: existing.date,
      hours: payableHours,
      otTypeName,
      reviewedByName: actor.name || "Company Admin",
    });

    return updated;
  },

  async reject(id, companyId, payload = {}, actor = {}) {
    const existing = await this.getById(id, companyId);
    if (existing.status !== "Pending") {
      throw new AppError(`Cannot reject an OT request that is already ${existing.status}`, 400, "INVALID_STATUS");
    }

    // 1. SOX Maker-Checker: Self-approval check
    if (actor.employeeId && String(existing.employeeId) === String(actor.employeeId)) {
      throw new AppError("You cannot review or reject your own overtime request", 403, "SELF_APPROVAL_FORBIDDEN");
    }

    // 2. Permission check: Admin, Reporting Manager, or OT Edit permission
    const employee = await caEmployeesRepository.findById(existing.employeeId, companyId);
    const isReportingManager = Boolean(
      actor.employeeId && (
        String(existing.reportingToId || employee?.reportingToId || employee?.details?.reportingToId) === String(actor.employeeId)
      )
    );

    const isPrivileged = Boolean(actor.isOwner || !actor.employeeId);
    if (!isPrivileged && !isReportingManager) {
      const canReview = await caPermissionsService.can(companyId, actor, "ot-requests", "edit") ||
                        await caPermissionsService.can(companyId, actor, "ot", "edit");
      if (!canReview) {
        throw new AppError("You do not have permission to review overtime requests", 403, "FORBIDDEN");
      }

      const scope = await caPermissionsService.getScope(companyId, actor, "ot-requests");
      if (scope === "self") {
        throw new AppError("You can only review overtime requests for your direct reportees", 403, "FORBIDDEN");
      }
      if (scope === "department") {
        const reqDept = String(employee?.departmentId || employee?.department_id || "");
        const actorDept = String(actor?.departmentId || "");
        if (reqDept && actorDept && reqDept !== actorDept) {
          throw new AppError("You can only review overtime in your own department", 403, "DEPARTMENT_MISMATCH");
        }
      }
    }

    const rejectReason = String(payload.rejectReason || payload.reason || "").trim();
    if (!rejectReason) {
      throw new AppError("Reject reason is required", 400, "MISSING_REJECT_REASON");
    }

    const updated = await caOtRequestsRepository.update(id, companyId, {
      status: "Rejected",
      rejectReason,
      reviewedByName: actor.name || "Company Admin",
      reviewedAt: new Date().toISOString(),
    });

    void caFcmService.notifyEmployeeOfOtStatus({
      companyId,
      employeeId: existing.employeeId,
      status: "Rejected",
      date: existing.date,
      hours: existing.hours,
      rejectReason,
      reviewedByName: actor.name || "Company Admin",
    });

    return updated;
  },
};
