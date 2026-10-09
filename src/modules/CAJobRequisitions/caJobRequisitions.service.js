import { AppError } from "../../core/errors/AppError.js";
import { caJobRequisitionsRepository } from "./caJobRequisitions.repository.js";

export const caJobRequisitionsService = {
  async list(companyId) {
    const list = await caJobRequisitionsRepository.list(companyId);
    if (!list.length) {
      // Seed initial mock data for demonstration
      await this.create(companyId, { position: "Senior Software Engineer", department: "Engineering", location: "Bangalore", type: "Full Time", positionsCount: 2, priority: "High", budget: "₹18-24 LPA", status: "Open", approvalStatus: "Approved", targetDate: "2026-09-30" });
      await this.create(companyId, { position: "Product Manager", department: "Product", location: "Mumbai", type: "Full Time", positionsCount: 1, priority: "High", budget: "₹22-28 LPA", status: "Open", approvalStatus: "Approved", targetDate: "2026-09-28" });
      await this.create(companyId, { position: "HR Business Partner", department: "HR", location: "Hyderabad", type: "Full Time", positionsCount: 1, priority: "Medium", budget: "₹12-16 LPA", status: "Pending Approval", approvalStatus: "Pending", targetDate: "2026-10-05" });
      await this.create(companyId, { position: "Data Analyst", department: "Analytics", location: "Pune", type: "Full Time", positionsCount: 3, priority: "Medium", budget: "₹8-12 LPA", status: "Open", approvalStatus: "Approved", targetDate: "2026-10-15" });
      await this.create(companyId, { position: "Sales Manager", department: "Sales", location: "Chennai", type: "Full Time", positionsCount: 2, priority: "Low", budget: "₹14-18 LPA", status: "Closed", approvalStatus: "Approved", targetDate: "2026-08-30" });
      await this.create(companyId, { position: "DevOps Engineer", department: "Engineering", location: "Bangalore", type: "Contract", positionsCount: 1, priority: "High", budget: "₹80-100K/mo", status: "Open", approvalStatus: "Approved", targetDate: "2026-09-25" });
      return await caJobRequisitionsRepository.list(companyId);
    }
    return list;
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

  async remove(id, companyId) {
    const isDeleted = await caJobRequisitionsRepository.remove(id, companyId);
    if (!isDeleted) {
      throw new AppError("Job requisition not found", 404);
    }
  },
};
