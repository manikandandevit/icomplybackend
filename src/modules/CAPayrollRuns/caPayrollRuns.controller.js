import { AppError } from "../../core/errors/AppError.js";
import { success } from "../../core/utils/response.js";
import { caPayrollRunsService } from "./caPayrollRuns.service.js";
import { caPayrollRunsRepository } from "./caPayrollRuns.repository.js";
import { db } from "../../core/db/pool.js";

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

  async getRunsByYear(req, res, next) {
    try {
      const { establishmentId, year } = req.query;
      const runs = await caPayrollRunsRepository.getRunsByYear(req.companyId, establishmentId, year);
      
      // Fetch ESI statutory config to recalculate ESI properly (matching frontend ESIC statement tab)
      const { rows: esiConfigs } = await db.query(
        `SELECT rules FROM public.ca_statutory_configs 
         WHERE created_by_company_id = $1 AND establishment_id = $2 AND statutory_name = 'ESI' LIMIT 1`,
        [req.companyId, establishmentId]
      );
      const esiRules = esiConfigs.length > 0 ? (esiConfigs[0].rules || []) : [];

      // Fetch LWF statutory config to calculate employer contribution properly
      const { rows: lwfConfigs } = await db.query(
        `SELECT rules FROM public.ca_statutory_configs 
         WHERE created_by_company_id = $1 AND establishment_id = $2 AND statutory_name = 'LWF' LIMIT 1`,
        [req.companyId, establishmentId]
      );
      const lwfRules = lwfConfigs.length > 0 ? (lwfConfigs[0].rules || []) : [];
      let lwfConfigEmr = 0;
      if (lwfRules.length > 0) {
        lwfConfigEmr = Number(lwfRules[0].employerAmount || 0);
      }

      const runsWithTotals = await Promise.all(runs.map(async (run) => {
        const payslips = await caPayrollRunsRepository.getPayslipsByRun(req.companyId, run.id);
        let totalEPF = 0;
        let totalEPS = 0;
        let totalEmployerEPF = 0;
        let totalEPFWages = 0;
        
        let totalEmployeeESI = 0;
        let totalEmployerESI = 0;
        let totalESI = 0;
        let totalPT = 0;
        
        let totalEmployeeLWF = 0;
        let totalEmployerLWF = 0;
        let totalLWF = 0;

        payslips.forEach(p => {
           const statutory = p.breakdown?.statutory || {};
           const components = p.breakdown?.components || {};
           
           const employerEPF = Math.round(statutory["Employer Contribution-EPF"] || 0);
           const employerEPS = Math.round(statutory["Employer Contribution-EPS"] || 0);
           const employeePF = Math.round(statutory["PF"] || (employerEPF + employerEPS));
           
           const grossWages = Math.round(components["Basic"] || p.grossPay || 0);
           const epfWages = employeePF > 0 ? Math.round(employeePF / 0.12) : grossWages;

           totalEPF += employeePF;
           totalEPS += employerEPS;
           totalEmployerEPF += employerEPF;
           totalEPFWages += epfWages;

           // Recalculate ESI using ESI rules (same logic as ESIC statement tab on frontend)
           let empESI = 0;
           let emrESI = 0;
           const baseWage = p.grossPay || 0;
           if (esiRules.length > 0) {
             const rule = esiRules.find(r => baseWage >= Number(r.minAmount || 0) && (r.maxAmount === null || r.maxAmount === undefined || baseWage <= Number(r.maxAmount)));
             if (rule) {
               empESI = Math.ceil((baseWage * Number(rule.employeePercentage || 0)) / 100);
               emrESI = Math.ceil((baseWage * Number(rule.employerPercentage || 0)) / 100);
             }
           } else if (statutory["ESI"] > 0) {
             // Fallback: use stored ESI and derive employer from ratio
             empESI = Math.round(statutory["ESI"]);
             emrESI = Math.round(empESI * (3.25 / 0.75));
           }
           totalEmployeeESI += empESI;
           totalEmployerESI += emrESI;
           totalESI += (empESI + emrESI);

           // PT
           totalPT += Number(statutory["Profession Tax"] || 0);

           // LWF
           const empLWF = Number(statutory["LWF"] || 0);
           let emrLWF = Number(statutory["Employer Contribution-LWF"] || 0);
           if (empLWF > 0 && emrLWF === 0 && lwfConfigEmr > 0) {
             emrLWF = lwfConfigEmr;
           }
           totalEmployeeLWF += empLWF;
           totalEmployerLWF += emrLWF;
           totalLWF += (empLWF + emrLWF);
        });
        return {
           ...run,
           totalEPF,
           totalEPS,
           totalEmployerEPF,
           totalEPFWages,
           totalEmployeeESI,
           totalEmployerESI,
           totalESI,
           totalPT,
           totalEmployeeLWF,
           totalEmployerLWF,
           totalLWF,
           hasPayslips: payslips.length > 0
        };
      }));

      const filteredRuns = runsWithTotals.filter(run => run.hasPayslips);

      return success(res, { data: filteredRuns, message: "Year history fetched successfully" });
    } catch (err) {
      next(err);
    }
  },

  async uploadChallan(req, res, next) {
    try {
      const { runId, complianceType } = req.body;
      if (!runId) throw new AppError("runId is required", 400);
      if (!req.file) throw new AppError("PDF file is required", 400);

      const { challanStorage } = await import("./caPayrollRuns.storage.js");
      const uploaded = await challanStorage.upload(req.file);

      await caPayrollRunsRepository.updateChallanUrl(req.companyId, runId, uploaded.url, complianceType || "EPF");

      return success(res, { data: uploaded, message: "Challan uploaded successfully" });
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
