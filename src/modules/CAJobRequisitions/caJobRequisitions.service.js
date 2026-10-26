import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { caJobRequisitionsRepository } from "./caJobRequisitions.repository.js";
import { sendRequisitionApprovalEmail } from "./caJobRequisitions.email.js";

export const caJobRequisitionsService = {
  async list(companyId) {
    return await caJobRequisitionsRepository.list(companyId);
  },

  async create(companyId, payload) {
    const requisition = await caJobRequisitionsRepository.create(companyId, payload);
    if (!requisition) {
      throw new AppError("Failed to create job requisition", 400);
    }
    return requisition;
  },

  async update(id, companyId, payload) {
    const requisition = await caJobRequisitionsRepository.update(id, companyId, payload);
    if (!requisition) {
      throw new AppError("Job requisition not found", 404);
    }
    return requisition;
  },

  async approve(id, companyId) {
    const requisition = await caJobRequisitionsRepository.updateStatus(id, companyId, "Open", "Approved");
    if (!requisition) {
      throw new AppError("Job requisition not found", 404);
    }
    return requisition;
  },

  async sendApprovalRequest(id, companyId, host, protocol = "http") {
    const requisition = await caJobRequisitionsRepository.findById(id, companyId)
      || await caJobRequisitionsRepository.findByIdDirect(id);
    if (!requisition) {
      throw new AppError("Job requisition not found", 404);
    }

    const approverEmail = String(requisition.approverEmail || "").trim();
    if (!approverEmail) {
      throw new AppError("Approver email is missing for this requisition. Please edit the requisition to specify an approver email.", 400);
    }

    const approveToken = jwt.sign(
      {
        requisitionId: requisition.id,
        companyId: requisition.companyId,
        action: "approve",
        type: "job_requisition_approval",
      },
      config.jwt.secret,
      { expiresIn: "7d" }
    );

    const rejectToken = jwt.sign(
      {
        requisitionId: requisition.id,
        companyId: requisition.companyId,
        action: "reject",
        type: "job_requisition_approval",
      },
      config.jwt.secret,
      { expiresIn: "7d" }
    );

    const scheme = protocol === "https" ? "https" : "http";
    const backendBaseUrl = process.env.BACKEND_URL || (host ? `${scheme}://${host}` : `http://localhost:${config.port}`);

    const approveUrl = `${backendBaseUrl}/api/ca-job-requisitions/public-approve?token=${encodeURIComponent(approveToken)}`;
    const rejectUrl = `${backendBaseUrl}/api/ca-job-requisitions/public-reject?token=${encodeURIComponent(rejectToken)}`;

    const sent = await sendRequisitionApprovalEmail({
      requisition,
      approverEmail,
      approverName: requisition.approverName || "Approver",
      approveUrl,
      rejectUrl,
    });

    if (!sent) {
      throw new AppError("Failed to send approval email. Please check mail server settings.", 500);
    }

    return {
      requisition,
      approverEmail,
      approverName: requisition.approverName || "Approver",
    };
  },

  async publicApprove(token) {
    if (!token) {
      throw new AppError("Approval token is missing", 400);
    }
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Approval link is invalid or has expired", 400);
    }

    if (decoded?.type !== "job_requisition_approval" || decoded?.action !== "approve") {
      throw new AppError("Invalid approval token", 400);
    }

    const requisition = await caJobRequisitionsRepository.findByIdDirect(decoded.requisitionId);
    if (!requisition) {
      throw new AppError("Job requisition was not found", 404);
    }

    if (requisition.approvalStatus === "Approved") {
      return { status: "already_approved", requisition };
    }

    const updated = await caJobRequisitionsRepository.updateStatus(
      requisition.id,
      requisition.companyId,
      "Open",
      "Approved"
    );

    return { status: "approved", requisition: updated || requisition };
  },

  async publicReject(token) {
    if (!token) {
      throw new AppError("Rejection token is missing", 400);
    }
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      throw new AppError("Rejection link is invalid or has expired", 400);
    }

    if (decoded?.type !== "job_requisition_approval" || decoded?.action !== "reject") {
      throw new AppError("Invalid rejection token", 400);
    }

    const requisition = await caJobRequisitionsRepository.findByIdDirect(decoded.requisitionId);
    if (!requisition) {
      throw new AppError("Job requisition was not found", 404);
    }

    if (requisition.approvalStatus === "Rejected") {
      return { status: "already_rejected", requisition };
    }

    const updated = await caJobRequisitionsRepository.updateStatus(
      requisition.id,
      requisition.companyId,
      "Closed",
      "Rejected"
    );

    return { status: "rejected", requisition: updated || requisition };
  },

  async remove(id, companyId) {
    const isDeleted = await caJobRequisitionsRepository.remove(id, companyId);
    if (!isDeleted) {
      throw new AppError("Job requisition not found", 404);
    }
  },
};
