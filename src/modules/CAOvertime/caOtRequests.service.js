import { AppError } from "../../core/errors/AppError.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caFcmService } from "../CANotifications/caFcm.service.js";
import { caOtRequestsRepository } from "./caOtRequests.repository.js";

export const caOtRequestsService = {
  async list(companyId, filters = {}, actor = {}) {
    const activeFilters = { ...filters };
    if (actor.employeeId && !actor.isOwner) {
      if (filters.scope === "mine") {
        activeFilters.employeeId = actor.employeeId;
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

    const employee = await caEmployeesRepository.getById(employeeId, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }

    const date = payload.date || payload.workDate;
    if (!date) {
      throw new AppError("Working date is required", 400, "MISSING_DATE");
    }

    const hours = Number(payload.hours || payload.otHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new AppError("Valid OT hours are required", 400, "INVALID_HOURS");
    }

    let establishmentName = payload.establishmentName || employee.establishmentName;
    let establishmentId = payload.establishmentId || employee.establishmentId;
    if (!establishmentName && establishmentId) {
      const est = await caEstablishmentsRepository.getById(establishmentId, companyId);
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

    const otTypeName = payload.otTypeName || payload.type || existing.type || "Weekday Ot";

    // Check OT Type policy from Master to enforce maxHours cap
    const otTypes = await caHrMasterRepository.list(companyId, "ot-type").catch(() => []);
    const matchedType = otTypes.find(
      (t) => String(t.values?.name || "").trim().toLowerCase() === String(otTypeName).trim().toLowerCase()
    );

    const workedHours = Number(existing.workedOtHours || existing.hours || existing.otHours || 0);
    let payableHours = workedHours;

    if (matchedType) {
      const maxH = matchedType.values?.maxHours ? Number(matchedType.values.maxHours) : null;
      if (maxH && maxH > 0 && workedHours > maxH) {
        payableHours = maxH;
      }
    }

    if (payload.hours && Number(payload.hours) > 0) {
      payableHours = Number(payload.hours);
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
