import { success } from "../../core/utils/response.js";
import { caSeparationService } from "./caSeparation.service.js";

export const caSeparationController = {
  async apply(req, res, next) {
    try {
      const companyId = req.companyId;
      const employeeId = req.employeeId || req.body.employeeId || req.user?.employeeId || req.user?.id;
      const result = await caSeparationService.applyResignation(companyId, employeeId, req.body);
      return success(res, {
        message: "Resignation request submitted successfully",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },

  async myRequest(req, res, next) {
    try {
      const companyId = req.companyId;
      const employeeId = req.query.employeeId || req.employeeId || req.user?.employeeId || req.user?.id;
      const userName = req.user?.name || req.actorName || "";
      const userEmail = req.user?.email || "";
      const result = await caSeparationService.getMyRequest(companyId, employeeId, userName, userEmail);
      return success(res, {
        message: "Fetched active separation request status",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },

  async list(req, res, next) {
    try {
      const companyId = req.companyId;
      const isCompanyAdmin =
        Boolean(req.isCompanyOwner) ||
        req.user?.role === "CompanyAdmin" ||
        req.user?.type === "company" ||
        req.user?.type === "ca_user" ||
        (req.allowedModules || []).includes("all") ||
        (req.allowedModules || []).includes("organisation") ||
        (req.allowedModules || []).includes("separation") ||
        (req.allowedModules || []).includes("separation-request");
      const reviewerId = req.employeeId || req.user?.employeeId || req.user?.id;
      const reviewerName = req.actorName || req.user?.name || "";
      const reviewerEmail = req.user?.email || "";

      const filter = {
        isCompanyAdmin,
        reviewerId,
        reviewerName,
        reviewerEmail,
        status: req.query.status,
        search: req.query.search,
        reason: req.query.reason,
        department: req.query.department,
        lwdFrom: req.query.lwdFrom,
        lwdTo: req.query.lwdTo,
      };

      const results = await caSeparationService.listRequests(companyId, filter);

      return success(res, {
        message: "Separation requests retrieved successfully",
        data: results,
      });
    } catch (err) {
      return next(err);
    }
  },

  async approveAndForward(req, res, next) {
    try {
      const companyId = req.companyId;
      const requestId = req.params.id;
      const actor = {
        id: req.employeeId || req.user?.id,
        name: req.actorName || req.user?.name || "Reviewer",
        role: req.designationName || req.user?.role || "Reviewer",
        department: req.departmentName || "General",
      };

      const result = await caSeparationService.approveAndForward(companyId, requestId, actor, req.body);
      return success(res, {
        message: "Separation request approved and forwarded successfully",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },

  async retain(req, res, next) {
    try {
      const companyId = req.companyId;
      const requestId = req.params.id;
      const actor = {
        id: req.employeeId || req.user?.id,
        name: req.actorName || req.user?.name || "Management",
        role: req.designationName || req.user?.role || "Management",
        department: req.departmentName || "Management",
      };

      const result = await caSeparationService.retainEmployee(companyId, requestId, actor, req.body);
      return success(res, {
        message: "Employee retained and separation request closed",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },

  async offboard(req, res, next) {
    try {
      const companyId = req.companyId;
      const requestId = req.params.id;
      const actor = {
        id: req.employeeId || req.user?.id,
        name: req.actorName || req.user?.name || "HR / Company Admin",
        role: req.designationName || req.user?.role || "HR",
        department: req.departmentName || "Human Resources",
      };

      const result = await caSeparationService.offboardEmployee(companyId, requestId, actor, req.body);
      return success(res, {
        message: "Employee offboarded and status marked as Inactive",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },

  async withdraw(req, res, next) {
    try {
      const companyId = req.companyId;
      const requestId = req.params.id;
      const actor = {
        id: req.employeeId || req.user?.id,
        name: req.actorName || req.user?.name || "Employee",
        role: req.designationName || req.user?.role || "Employee",
        department: req.departmentName || "General",
      };

      const result = await caSeparationService.withdrawRequest(companyId, requestId, actor);
      return success(res, {
        message: "Separation request withdrawn successfully",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  },
};

