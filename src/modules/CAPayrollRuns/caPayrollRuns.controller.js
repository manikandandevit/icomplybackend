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

  // NEW: Save payroll results from frontend calculation
  async saveRun(req, res, next) {
    try {
      const {
        establishmentId,
        establishmentName,
        month,
        year,
        payslips // array of { employeeId, employeeName, employeeCode, grossPay, netPay, deductions, ctc, breakdown }
      } = req.body;

      if (!establishmentId || !month || !year || !Array.isArray(payslips)) {
        throw new AppError("Missing required fields: establishmentId, month, year, payslips", 400);
      }

      // Upsert run (delete old if exists)
      const run = await caPayrollRunsRepository.upsertRun(
        req.companyId, establishmentId, establishmentName || "", month, year
      );

      // Insert all payslips
      const savedPayslips = await Promise.all(
        payslips.map((p) =>
          caPayrollRunsRepository.createPayslip(
            req.companyId,
            run.id,
            p.employeeId,
            p.employeeName,
            p.employeeCode || "",
            p.grossPay || 0,
            p.netPay || 0,
            p.deductions || 0,
            p.ctc || 0,
            p.breakdown || {}
          )
        )
      );

      return success(res, { data: { run, payslips: savedPayslips }, message: "Payroll saved successfully" }, 201);
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
  },

  async sendPayslip(req, res, next) {
    try {
      const { runId, employeeId } = req.body;
      if (!runId) throw new AppError("runId is required", 400);

      const result = await caPayrollRunsService.sendPayslips(req.companyId, runId, employeeId);
      return success(res, { data: result, message: "Payslips sent successfully" });
    } catch (err) {
      next(err);
    }
  }
};
