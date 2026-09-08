import { AppError } from "../../core/errors/AppError.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caLeaveRequestsRepository } from "./caLeaveRequests.repository.js";
import { prorateDays } from "./caLeaveRequests.validator.js";

const leaveTypeName = (item) => {
  const name = item?.values?.name || "Leave";
  return item?.values?.code ? `${name} (${item.values.code})` : name;
};

export const caLeaveRequestsService = {
  list: (companyId) => caLeaveRequestsRepository.list(companyId),

  async create(companyId, payload) {
    const employee = await caEmployeesRepository.findById(payload.employeeId, companyId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (String(employee.establishmentId) !== String(payload.establishmentId)) {
      throw new AppError("Employee does not belong to this establishment", 422, "EMPLOYEE_ESTABLISHMENT_MISMATCH");
    }

    const establishment = await caEstablishmentsRepository.findById(payload.establishmentId);
    if (!establishment) {
      throw new AppError("Establishment not found", 404, "ESTABLISHMENT_NOT_FOUND");
    }

    const leaveType = await caHrMasterRepository.findById(payload.leaveTypeId, companyId, "leave-types");
    if (!leaveType) {
      throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
    }

    const year = Number(String(payload.startDate).slice(0, 4)) || new Date().getFullYear();
    const entitled = prorateDays(leaveType.values?.days, employee.joinDate, year);
    const used = await caLeaveRequestsRepository.usedDays(companyId, employee.id, leaveType.id, year);
    const remaining = Math.max(entitled - used, 0);

    if (payload.days > remaining) {
      throw new AppError(`Only ${remaining} days available`, 422, "LEAVE_BALANCE_EXCEEDED");
    }

    const created = await caLeaveRequestsRepository.create(companyId, {
      ...payload,
      establishmentName: establishment.name,
      employeeName: employee.name,
      employeeCode: employee.employeeCode,
      leaveTypeName: leaveTypeName(leaveType),
      approverName: employee.details?.reportingToName || "",
    });
    if (!created) {
      throw new AppError("Unable to create leave request", 500, "LEAVE_REQUEST_CREATE_FAILED");
    }
    return created;
  },

  async approve(id, companyId, reviewedByName = "") {
    const request = await caLeaveRequestsRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Leave request not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending requests can be approved", 422, "LEAVE_REQUEST_NOT_PENDING");
    }

    const employee = await caEmployeesRepository.findById(request.employeeId, companyId);
    const leaveType = await caHrMasterRepository.findById(request.leaveTypeId, companyId, "leave-types");
    if (!employee || !leaveType) {
      throw new AppError("Leave request data is incomplete", 422, "LEAVE_REQUEST_INVALID");
    }

    const year = Number(String(request.startDate).slice(0, 4)) || new Date().getFullYear();
    const entitled = prorateDays(leaveType.values?.days, employee.joinDate, year);
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
    return updated;
  },

  async reject(id, companyId, rejectReason, reviewedByName = "") {
    const request = await caLeaveRequestsRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Leave request not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending requests can be rejected", 422, "LEAVE_REQUEST_NOT_PENDING");
    }
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
    return updated;
  },
};
