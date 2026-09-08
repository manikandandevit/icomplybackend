import { AppError } from "../../core/errors/AppError.js";
import { db } from "../../core/db/pool.js";
import { countSessionDays, remainingLeaveSlices, SESSION_FULL, normalizeSession } from "../../core/leave/workingDays.js";
import { notifyLeaveStatus, notifyLeaveSubmitted } from "../../core/mail/leaveMail.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caLeaveRequestsRepository } from "../CALeaveRequests/caLeaveRequests.repository.js";
import { leaveCalendarFor } from "../CALeaveRequests/leaveCalendar.js";
import {
  assertCanReviewLeave,
  isCompanyPrivileged,
  leaveActorFromReq,
} from "../CALeaveRequests/caLeaveRequests.service.js";
import { caLeaveRevokesRepository } from "./caLeaveRevokes.repository.js";

export { leaveActorFromReq };

const applyApprovedRevoke = async (companyId, leave, revoke, reviewedByName, calendar) => {
  const slices = remainingLeaveSlices(leave, revoke, calendar);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (slices.length === 0) {
      const revokedLeave = await caLeaveRequestsRepository.updateStatus(
        leave.id,
        companyId,
        { status: "Revoked", reviewedByName },
        client,
      );
      if (!revokedLeave) {
        throw new AppError("Unable to revoke leave", 500, "LEAVE_REVOKE_FAILED");
      }
    } else {
      const first = slices[0];
      const updatedLeave = await caLeaveRequestsRepository.updateRange(
        leave.id,
        companyId,
        {
          startDate: first.startDate,
          endDate: first.endDate,
          days: first.days,
          session: first.session,
          status: "Approved",
        },
        client,
      );
      if (!updatedLeave) {
        throw new AppError("Unable to update remaining leave", 500, "LEAVE_REVOKE_FAILED");
      }
      for (const extra of slices.slice(1)) {
        const copied = await caLeaveRequestsRepository.insertApprovedCopy(companyId, leave, extra, client);
        if (!copied) {
          throw new AppError("Unable to split remaining leave", 500, "LEAVE_REVOKE_FAILED");
        }
        await caLeaveRevokesRepository.retargetPending(leave.id, copied.id, companyId, extra.startDate, client);
      }
    }

    const updated = await caLeaveRevokesRepository.updateStatus(
      revoke.id,
      companyId,
      { status: "Approved", reviewedByName },
      client,
    );
    if (!updated) {
      throw new AppError("Unable to approve revoke request", 500, "REVOKE_UPDATE_FAILED");
    }
    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const caLeaveRevokesService = {
  list: (companyId, actor, scope) => caLeaveRevokesRepository.list(companyId, { scope, actor }),

  async create(companyId, payload, actor = {}) {
    const leave = await caLeaveRequestsRepository.findById(payload.leaveRequestId, companyId);
    if (!leave) {
      throw new AppError("Approved leave not found", 404, "LEAVE_REQUEST_NOT_FOUND");
    }
    if (leave.status !== "Approved") {
      throw new AppError("Only approved leave can be revoked", 422, "LEAVE_NOT_APPROVED");
    }
    if (!isCompanyPrivileged(actor) && actor.employeeId && String(leave.employeeId) !== String(actor.employeeId)) {
      throw new AppError("You can only revoke your own leave", 403, "FORBIDDEN");
    }
    if (payload.startDate < leave.startDate || payload.endDate > leave.endDate) {
      throw new AppError("Revoke dates must be within the approved leave", 422, "REVOKE_DATES_OUT_OF_RANGE");
    }

    const session = normalizeSession(payload.session);
    const leaveSession = normalizeSession(leave.session);
    if (leaveSession !== SESSION_FULL && session !== SESSION_FULL && session !== leaveSession) {
      throw new AppError("Revoke session does not match the approved leave", 422, "REVOKE_SESSION_MISMATCH");
    }

    const employee = await caEmployeesRepository.findById(leave.employeeId, companyId);
    const calendar = await leaveCalendarFor(companyId, employee);
    const days = countSessionDays(payload.startDate, payload.endDate, session, calendar);
    if (days <= 0) {
      throw new AppError("Selected dates are week off or holidays. Choose working days.", 422, "LEAVE_NO_WORKING_DAYS");
    }

    const pending = await caLeaveRevokesRepository.findOverlappingPending(
      leave.id,
      companyId,
      payload.startDate,
      payload.endDate,
      null,
      session,
    );
    if (pending) {
      throw new AppError("A revoke request is already pending for these dates", 422, "REVOKE_ALREADY_PENDING");
    }

    const created = await caLeaveRevokesRepository.create(companyId, {
      leaveRequestId: leave.id,
      establishmentId: leave.establishmentId,
      establishmentName: leave.establishmentName,
      employeeId: leave.employeeId,
      employeeName: leave.employeeName,
      employeeCode: leave.employeeCode,
      leaveTypeId: leave.leaveTypeId,
      leaveTypeName: leave.leaveTypeName,
      startDate: payload.startDate,
      endDate: payload.endDate,
      days,
      session,
      reason: payload.reason,
      attachmentKey: payload.attachmentKey,
      attachmentUrl: payload.attachmentUrl,
      attachmentName: payload.attachmentName,
      attachmentMime: payload.attachmentMime,
      approverName: employee?.details?.reportingToName || leave.approverName || "",
      reportingToId: leave.reportingToId || employee?.details?.reportingToId || "",
    });
    if (!created) {
      throw new AppError("Unable to create revoke request", 500, "REVOKE_CREATE_FAILED");
    }
    void notifyLeaveSubmitted({ companyId, employee, request: created, kind: "revoke" });
    return created;
  },

  async approve(id, companyId, reviewedByName = "", actor = {}) {
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

    const employee = await caEmployeesRepository.findById(request.employeeId, companyId);
    assertCanReviewLeave({ ...request, employeeId: request.employeeId, reportingToId: request.reportingToId || leave.reportingToId }, actor, employee);

    if (request.startDate < leave.startDate || request.endDate > leave.endDate) {
      throw new AppError("Leave dates have changed. Cancel and apply revoke again", 422, "REVOKE_DATES_OUT_OF_RANGE");
    }

    const calendar = await leaveCalendarFor(companyId, employee);
    return applyApprovedRevoke(companyId, leave, request, reviewedByName, calendar).then((updated) => {
      void notifyLeaveStatus({
        companyId,
        employee,
        request: updated,
        action: "revoked",
        reviewedByName,
      });
      return updated;
    });
  },

  async reject(id, companyId, rejectReason, reviewedByName = "", actor = {}) {
    const request = await caLeaveRevokesRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Revoke request not found", 404, "REVOKE_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending revoke requests can be rejected", 422, "REVOKE_NOT_PENDING");
    }

    const employee = await caEmployeesRepository.findById(request.employeeId, companyId);
    assertCanReviewLeave(request, actor, employee);

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

  async cancel(id, companyId, actor = {}) {
    const request = await caLeaveRevokesRepository.findById(id, companyId);
    if (!request) {
      throw new AppError("Revoke request not found", 404, "REVOKE_NOT_FOUND");
    }
    if (request.status !== "Pending") {
      throw new AppError("Only pending revoke can be cancelled", 422, "REVOKE_NOT_PENDING");
    }
    if (!isCompanyPrivileged(actor) && String(request.employeeId) !== String(actor.employeeId)) {
      throw new AppError("You can only cancel your own revoke request", 403, "FORBIDDEN");
    }
    const removed = await caLeaveRevokesRepository.removePending(id, companyId);
    if (!removed) {
      throw new AppError("Unable to cancel revoke request", 500, "REVOKE_CANCEL_FAILED");
    }
    return request;
  },
};
