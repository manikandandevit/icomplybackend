import { AppError } from "../../core/errors/AppError.js";
import { success } from "../../core/utils/response.js";
import { caPayrollRunsService } from "./caPayrollRuns.service.js";
import { caPayrollRunsRepository } from "./caPayrollRuns.repository.js";

export const caPayrollRunsController = {
  async getPreChecks(req, res, next) {
    try {
      const { establishmentId, month, year } = req.query;
      const data = await caPayrollRunsService.getPreChecks(req.companyId, establishmentId, month, year);
      return success(res, { data, message: "Pre-checks fetched successfully" });
    } catch (err) {
      next(err);
    }
  },

  async getPreview(req, res, next) {
    try {
      const { establishmentId, month, year } = req.query;
      const data = await caPayrollRunsService.getPreview(req.companyId, establishmentId, month, year);
      return success(res, { data, message: "Preview calculated successfully" });
    } catch (err) {
      next(err);
    }
  },

  async runPayroll(req, res, next) {
    try {
      const payload = req.body;
      const data = await caPayrollRunsService.runPayroll(req.companyId, payload);
      return success(res, { data, message: "Payroll processed successfully" }, 201);
    } catch (err) {
      next(err);
    }
  },

  async getRunHistory(req, res, next) {
    try {
      const { establishmentId, month, year } = req.query;
      const data = await caPayrollRunsRepository.getRun(req.companyId, establishmentId, month, year);
      if (!data) return success(res, { data: null, message: "No history found" });

      const payslips = await caPayrollRunsRepository.getPayslipsByRun(req.companyId, data.id);
      return success(res, { data: { run: data, payslips }, message: "History fetched successfully" });
    } catch (err) {
      next(err);
    }
  }
};
