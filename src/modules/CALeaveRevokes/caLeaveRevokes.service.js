import { AppError } from "../../core/errors/AppError.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caLeaveRequestsRepository } from "../CALeaveRequests/caLeaveRequests.repository.js";
import { caLeaveRevokesRepository } from "./caLeaveRevokes.repository.js";

export const caLeaveRevokesService = {
  list: (companyId) => caLeaveRevokesRepository.list(companyId),

  async create(companyId, payload) {
    const leave = await caLeaveRequestsRepository.findById(payload.leaveRequestId, companyId);
    if (!leave) {
      throw new AppError("Approved leave not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (leave.status !== "Approved") {
      throw new AppError("Only approved leave can be revoked", 422, "LEAVE_NOT_APPROVED");
    }

    const pending = await caLeaveRevokesRepository.findPendingForLeave(leave.id, companyId);
    if (pending) {
      throw new AppError("A revoke request is already pending for this leave", 422, "REVOKE_ALREADY_PENDING");
    }

    const employee = await caEmployeesRepository.findById(leave.employeeId, companyId);
    const created = await caLeaveRevokesRepository.create(companyId, {
      leaveRequestId: leave.id,
      establishmentId: leave.establishmentId,
      establishmentName: leave.establishmentName,
      employeeId: leave.employeeId,
      employeeName: leave.employeeName,
      employeeCode: leave.employeeCode,
      leaveTypeId: leave.leaveTypeId,
      leaveTypeName: leave.leaveTypeName,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.days,
      reason: payload.reason,
      approverName: employee?.details?.reportingToName || leave.approverName || "",
    });
    if (!created) {
      throw new AppError("Unable to create revoke request", 500, "REVOKE_CREATE_FAILED");
    }
    return created;
  },

  async approve(id, companyId, reviewedByName = "") {
    const request = await caLeaveRevokesRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Revoke request not found", 404, "REVOKE_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending revoke requests can be approved", 422, "REVOKE_NOT_PENDING");
    }

    const leave = await caLeaveRequestsRepository.findById(request.leaveRequestId, companyId);
    if (!leave || leave.status !== "Approved") {
      throw new AppError("Approved leave not found", 422, "LEAVE_NOT_APPROVED");
    }

    const revokedLeave = await caLeaveRequestsRepository.updateStatus(leave.id, companyId, {
      status: "Revoked",
      reviewedByName,
    });
    if (!revokedLeave) {
      throw new AppError("Unable to revoke leave", 500, "LEAVE_REVOKE_FAILED");
    }

    const updated = await caLeaveRevokesRepository.updateStatus(id, companyId, {
      status: "Approved",
      reviewedByName,
    });
    if (!updated) {
      throw new AppError("Unable to approve revoke request", 500, "REVOKE_UPDATE_FAILED");
    }
    return updated;
  },

  async reject(id, companyId, rejectReason, reviewedByName = "") {
    const request = await caLeaveRevokesRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Revoke request not found", 404, "REVOKE_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending revoke requests can be rejected", 422, "REVOKE_NOT_PENDING");
    }
    const reason = String(rejectReason || "").trim();
    if (!reason) {
      throw new AppError("Enter reject reason", 422, "REJECT_REASON_REQUIRED");
    }

    const updated = await caLeaveRevokesRepository.updateStatus(id, companyId, {
      status: "Rejected",
      rejectReason: reason,
      reviewedByName,
    });
    if (!updated) {
      throw new AppError("Unable to reject revoke request", 500, "REVOKE_UPDATE_FAILED");
    }
    return updated;
  },

  async cancel(id, companyId) {
    const request = await caLeaveRevokesRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Revoke request not found", 404, "REVOKE_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending revoke can be cancelled", 422, "REVOKE_NOT_PENDING");
    }
    const removed = await caLeaveRevokesRepository.removePending(id, companyId);
    if (!removed) {
      throw new AppError("Unable to cancel revoke request", 500, "REVOKE_CANCEL_FAILED");
    }
    return request;
  },
};
