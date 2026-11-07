import { db } from "../../core/db/pool.js";
import { AppError } from "../../core/errors/AppError.js";
import { caSeparationRepository } from "./caSeparation.repository.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caOffboardingService } from "../CAOffboarding/caOffboarding.service.js";

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeDate = (val) => {
  if (!val) return null;
  const s = String(val).trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const date = new Date(s);
  if (!isNaN(date.getTime())) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return s;
};

export const caSeparationService = {
  async applyResignation(companyId, employeeId, payload) {
    const cId = parseRowId(companyId);
    const empId = parseRowId(employeeId);
    if (!cId || !empId) {
      throw new AppError("Invalid company or employee ID", 400);
    }

    const { reasonCategory, primaryReason, proposedLastWorkingDay, attachmentUrl } = payload;
    if (!reasonCategory || !primaryReason) {
      throw new AppError("Please provide reason category and primary reason", 400);
    }

    // Check if active resignation already exists
    const existing = await caSeparationRepository.findActiveByEmployee(cId, empId);
    if (existing && existing.status !== "Retained" && existing.status !== "Withdrawn") {
      throw new AppError("A resignation request is already in progress for this employee", 400);
    }

    const employee = await caEmployeesRepository.findById(empId, cId);
    if (!employee) {
      throw new AppError("Employee profile not found", 404);
    }

    // Resolve reporting manager
    let reportingManagerId = employee.details?.reportingToId || null;
    let reportingManagerName = employee.details?.reportingToName || null;
    let reportingManagerDept = null;

    if (reportingManagerId) {
      const mgr = await caEmployeesRepository.findById(reportingManagerId, cId);
      if (mgr) {
        reportingManagerName = mgr.name;
        reportingManagerDept =
          mgr.departmentName ||
          mgr.department_name ||
          mgr.details?.department ||
          mgr.details?.departmentName ||
          null;
      }
    }

    if (!reportingManagerName) {
      reportingManagerName = "Management / HR";
    }

    const empDept =
      employee.departmentName ||
      employee.department_name ||
      employee.details?.department ||
      employee.details?.departmentName ||
      "General";
    const empDesig =
      employee.designationName ||
      employee.designation_name ||
      employee.details?.designation ||
      employee.details?.designationName ||
      "Employee";
    const empEstName =
      employee.establishmentName ||
      employee.establishment_name ||
      employee.details?.establishmentName ||
      null;
    const empEstId =
      employee.establishmentId ||
      employee.establishment_id ||
      null;
    const empCode =
      employee.employeeCode ||
      employee.employee_code ||
      null;

    const nowIso = new Date().toISOString();
    const initialHistory = [
      {
        step: 1,
        title: "Resignation Submitted",
        actor_id: empId,
        actor_name: employee.name,
        role: empDesig,
        department: empDept,
        action: "Submitted",
        date: nowIso,
        proposed_lwd: proposedLastWorkingDay,
        reason: `${reasonCategory}: ${primaryReason}`,
        status: "completed",
      },
      {
        step: 2,
        title: "Level 1 Review (Reporting Manager)",
        actor_id: reportingManagerId ? parseRowId(reportingManagerId) : null,
        actor_name: reportingManagerName,
        role: "Reporting Manager",
        department: reportingManagerDept || "Management",
        action: "Awaiting Review",
        status: "current",
      },
    ];

    const normalizedLwd = normalizeDate(proposedLastWorkingDay);

    const record = await caSeparationRepository.create({
      companyId: cId,
      employeeId: empId,
      employeeCode: empCode,
      employeeName: employee.name,
      department: empDept,
      designation: empDesig,
      establishmentId: empEstId,
      establishmentName: empEstName,
      reportingManagerId: reportingManagerId ? parseRowId(reportingManagerId) : null,
      reportingManagerName,
      currentReviewerId: reportingManagerId ? parseRowId(reportingManagerId) : null,
      currentReviewerName: reportingManagerName,
      currentReviewerDept: reportingManagerDept || "Management",
      reasonCategory,
      primaryReason,
      proposedLastWorkingDay: normalizedLwd,
      confirmedLastWorkingDay: normalizedLwd,
      status: "Pending Review",
      reviewHistory: initialHistory,
      attachmentUrl: attachmentUrl || null,
    });

    return record;
  },

  async getMyRequest(companyId, employeeId, userName = "", userEmail = "") {
    const cId = parseRowId(companyId);
    let empId = parseRowId(employeeId);
    if (!cId) return { request: null, canReapply: true, isReportingManager: false };

    const cleanName = String(userName || "").trim().toLowerCase();
    const cleanEmail = String(userEmail || "").trim().toLowerCase();

    // If empId is not found or could be a ca_user ID, try to resolve exact employee ID from ca_employees
    if (!empId || empId < 50) {
      try {
        const { rows: matchedEmp } = await db.query(
          `SELECT id FROM public.ca_employees
           WHERE created_by_company_id = $1
             AND (
               ($2 <> '' AND lower(email) = $2)
               OR ($3 <> '' AND lower(name) = $3)
             )
           LIMIT 1`,
          [cId, cleanEmail, cleanName]
        );
        if (matchedEmp[0]?.id) {
          empId = parseRowId(matchedEmp[0].id);
        }
      } catch (matchErr) {
        console.warn("Could not match employee profile:", matchErr);
      }
    }

    let isReportingManager = false;
    try {
      const { rows: mgrRows } = await db.query(
        `SELECT 1 FROM public.ca_employees
         WHERE created_by_company_id = $1
           AND (
             ($2::text IS NOT NULL AND details->>'reportingToId' = $2::text)
             OR ($3 <> '' AND lower(COALESCE(details->>'reportingToName', '')) = $3)
           )
         LIMIT 1`,
        [cId, empId ? String(empId) : null, cleanName]
      );
      if (mgrRows.length > 0) {
        isReportingManager = true;
      } else {
        const { rows: sepRows } = await db.query(
          `SELECT 1 FROM public.ca_separation_requests
           WHERE company_id = $1
             AND (
               ($2::int IS NOT NULL AND (reporting_manager_id = $2::int OR current_reviewer_id = $2::int))
               OR ($3 <> '' AND (lower(COALESCE(reporting_manager_name, '')) = $3 OR lower(COALESCE(current_reviewer_name, '')) = $3))
             )
           LIMIT 1`,
          [cId, empId, cleanName]
        );
        isReportingManager = sepRows.length > 0;
      }
    } catch (mgrErr) {
      console.warn("Could not check isReportingManager:", mgrErr);
    }

    const request = await caSeparationRepository.findActiveByEmployee(cId, empId, cleanName, cleanEmail);
    if (!request) {
      return { request: null, canReapply: true, isReportingManager };
    }

    if (request.status === "Retained" || request.status === "Withdrawn") {
      return { request, canReapply: true, isReportingManager };
    }

    return { request, canReapply: false, isReportingManager };
  },

  async listRequests(companyId, filter = {}) {
    const cId = parseRowId(companyId);
    if (!cId) return [];
    return caSeparationRepository.listRequests(cId, filter);
  },

  async approveAndForward(companyId, requestId, actor, payload) {
    const cId = parseRowId(companyId);
    const reqId = parseRowId(requestId);
    const request = await caSeparationRepository.findById(reqId, cId);
    if (!request) {
      throw new AppError("Separation request not found", 404);
    }

    if (request.status === "Approved") {
      throw new AppError("Separation request is already approved", 400);
    }
    if (request.status === "Offboarding") {
      throw new AppError("Separation request is already under offboarding", 400);
    }
    if (request.status === "Retained" || request.status === "Withdrawn") {
      throw new AppError("Separation request is closed", 400);
    }

    const {
      confirmedLwd,
      targetDepartmentId,
      targetDepartmentName,
      targetEmployeeId,
      targetEmployeeName,
      comments,
    } = payload;

    const effectiveLwd = normalizeDate(confirmedLwd) || request.confirmed_last_working_day || request.proposed_last_working_day;
    const history = Array.isArray(request.review_history) ? [...request.review_history] : [];
    const nowIso = new Date().toISOString();
    const currentStepIdx = history.findIndex((s) => s.status === "current");

    // If no target employee selected, this is a final approval (sets status to 'Offboarding' and initiates exit)
    if (!targetEmployeeId || !targetEmployeeName) {
      if (currentStepIdx !== -1) {
        history[currentStepIdx] = {
          ...history[currentStepIdx],
          status: "completed",
          action: "Approved",
          action_by: actor.name || "Reviewer",
          action_date: nowIso,
          comments: comments || "Separation request approved",
          confirmed_lwd: effectiveLwd,
        };
      } else {
        history.push({
          step: history.length + 1,
          title: "Separation Approved",
          actor_id: parseRowId(actor.id || actor.employeeId),
          actor_name: actor.name || "HR / Management",
          role: actor.role || "HR",
          department: actor.department || "Human Resources",
          action: "Approved",
          date: nowIso,
          confirmed_lwd: effectiveLwd,
          status: "completed",
        });
      }

      history.push({
        step: history.length + 1,
        title: "Moved to Offboarding",
        actor_id: parseRowId(actor.id || actor.employeeId),
        actor_name: actor.name || "HR / Company Admin",
        role: actor.role || "HR / Admin",
        department: actor.department || "Human Resources",
        action: "Moved to Offboarding",
        date: nowIso,
        confirmed_lwd: effectiveLwd,
        status: "completed",
      });

      const updated = await caSeparationRepository.update(reqId, cId, {
        confirmedLastWorkingDay: effectiveLwd,
        status: "Offboarding",
        reviewHistory: history,
      });

      // 1. Update Employee status to 'Inactive' in ca_employees table
      try {
        await db.query(
          `UPDATE public.ca_employees SET status = 'Inactive', updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2`,
          [request.employee_id, cId]
        );
      } catch (empErr) {
        console.warn("Could not set employee status to Inactive:", empErr);
      }

      // 2. Initiate record in ca_offboarding_exits so it shows on Offboarding Dashboard
      try {
        await caOffboardingService.initiate(cId, {
          employeeId: String(request.employee_id),
          reason: `${request.reason_category || "Resignation"}: ${request.primary_reason || "Resignation approved"}`,
          lastWorkingDay: effectiveLwd,
        });
      } catch (offErr) {
        console.warn("Could not initiate exit in caOffboardingService:", offErr);
      }

      return updated;
    }
    if (currentStepIdx !== -1) {
      history[currentStepIdx] = {
        ...history[currentStepIdx],
        status: "completed",
        action: "Approved & Forwarded",
        action_by: actor.name || "Reviewer",
        action_date: nowIso,
        comments: comments || "Approved and forwarded to next reviewer",
        confirmed_lwd: effectiveLwd,
        forwarded_to_name: targetEmployeeName,
        forwarded_to_dept: targetDepartmentName || "Department",
      };
    }

    // Add next forwarded step
    const nextStepNum = history.length + 1;
    history.push({
      step: nextStepNum,
      title: `Forwarded Review (${targetDepartmentName || "Department"})`,
      actor_id: parseRowId(targetEmployeeId),
      actor_name: targetEmployeeName,
      role: "Reviewer",
      department: targetDepartmentName || "Department",
      action: "Awaiting Review",
      confirmed_lwd: effectiveLwd,
      date_forwarded: nowIso,
      status: "current",
    });

    const updated = await caSeparationRepository.update(reqId, cId, {
      confirmedLastWorkingDay: effectiveLwd,
      currentReviewerId: targetEmployeeId,
      currentReviewerName: targetEmployeeName,
      currentReviewerDept: targetDepartmentName || "Department",
      status: "Forwarded",
      reviewHistory: history,
    });

    return updated;
  },

  async retainEmployee(companyId, requestId, actor, payload = {}) {
    const cId = parseRowId(companyId);
    const reqId = parseRowId(requestId);
    const request = await caSeparationRepository.findById(reqId, cId);
    if (!request) {
      throw new AppError("Separation request not found", 404);
    }

    if (request.status === "Offboarding") {
      throw new AppError("Separation request is already under offboarding", 400);
    }
    if (request.status === "Retained" || request.status === "Withdrawn") {
      throw new AppError("Separation request is closed", 400);
    }

    const { comments } = payload;
    const history = Array.isArray(request.review_history) ? [...request.review_history] : [];
    const nowIso = new Date().toISOString();

    // Mark current step as resolved/closed
    const currentStepIdx = history.findIndex((s) => s.status === "current");
    if (currentStepIdx !== -1) {
      history[currentStepIdx] = {
        ...history[currentStepIdx],
        status: "completed",
        action: "Retained",
        action_by: actor.name || "Reviewer",
        action_date: nowIso,
        comments: comments || "Resignation discussed and resolved. Employee retained in company.",
      };
    }

    history.push({
      step: history.length + 1,
      title: "Employee Retained (Request Closed)",
      actor_id: parseRowId(actor.id || actor.employeeId),
      actor_name: actor.name || "Management",
      role: actor.role || "Management",
      department: actor.department || "Management",
      action: "Retained",
      date: nowIso,
      comments: comments || "Employee agreed to stay with the company.",
      status: "completed",
    });

    const updated = await caSeparationRepository.update(reqId, cId, {
      status: "Retained",
      reviewHistory: history,
    });

    // Clean up any linked exit in ca_offboarding_exits and remove resignation details from ca_employees
    try {
      if (request.employee_id) {
        await caOffboardingService.withdrawExit(request.employee_id, cId);
        await db.query(
          `UPDATE public.ca_employees
           SET status = 'Active',
               details = details - 'lastWorkingDay' - 'resignationDate' - 'resignationReason',
               last_working_day = NULL,
               resignation_date = NULL,
               resignation_reason = NULL,
               updated_at = NOW()
           WHERE (id::text = $1) ${cId ? "AND created_by_company_id = $2" : ""}`,
          cId ? [String(request.employee_id), cId] : [String(request.employee_id)]
        );
      }
    } catch (cleanErr) {
      console.warn("Could not cancel offboarding exit on retain:", cleanErr);
    }

    return updated;
  },

  async offboardEmployee(companyId, requestId, actor, payload = {}) {
    const cId = parseRowId(companyId);
    const reqId = parseRowId(requestId);
    const request = await caSeparationRepository.findById(reqId, cId);
    if (!request) {
      throw new AppError("Separation request not found", 404);
    }

    if (request.status === "Offboarding") {
      throw new AppError("Separation request is already under offboarding", 400);
    }
    if (request.status === "Retained" || request.status === "Withdrawn") {
      throw new AppError("Separation request is closed", 400);
    }

    const { confirmedLwd, comments } = payload;
    const effectiveLwd = normalizeDate(confirmedLwd) || request.confirmed_last_working_day || request.proposed_last_working_day;
    const history = Array.isArray(request.review_history) ? [...request.review_history] : [];
    const nowIso = new Date().toISOString();

    // Mark current step as completed
    const currentStepIdx = history.findIndex((s) => s.status === "current");
    if (currentStepIdx !== -1) {
      history[currentStepIdx] = {
        ...history[currentStepIdx],
        status: "completed",
        action: "Approved for Offboarding",
        action_by: actor.name || "Reviewer",
        action_date: nowIso,
        comments: comments || "Separation approved. Moved to offboarding.",
        confirmed_lwd: effectiveLwd,
      };
    }

    history.push({
      step: history.length + 1,
      title: "Moved to Offboarding",
      actor_id: parseRowId(actor.id || actor.employeeId),
      actor_name: actor.name || "HR / Company Admin",
      role: "HR / Admin",
      department: "Human Resources",
      action: "Moved to Offboarding",
      date: nowIso,
      confirmed_lwd: effectiveLwd,
      status: "completed",
    });

    const updated = await caSeparationRepository.update(reqId, cId, {
      confirmedLastWorkingDay: effectiveLwd,
      status: "Offboarding",
      reviewHistory: history,
    });

    // 1. Update Employee status to 'Inactive' in ca_employees table
    try {
      await db.query(
        `UPDATE public.ca_employees SET status = 'Inactive', updated_at = NOW() WHERE id = $1 AND created_by_company_id = $2`,
        [request.employee_id, cId]
      );
    } catch (empErr) {
      console.warn("Could not set employee status to Inactive:", empErr);
    }

    // 2. Initiate record in ca_offboarding_exits so it shows on Offboarding Dashboard
    try {
      await caOffboardingService.initiate(cId, {
        employeeId: String(request.employee_id),
        reason: `${request.reason_category}: ${request.primary_reason}`,
        lastWorkingDay: effectiveLwd,
      });
    } catch (offErr) {
      console.warn("Could not initiate exit in caOffboardingService:", offErr);
    }

    return updated;
  },

  async withdrawRequest(companyId, requestId, actor) {
    const cId = parseRowId(companyId);
    let reqId = parseRowId(requestId);
    let request = reqId ? await caSeparationRepository.findById(reqId, cId) : null;
    if (!request) {
      const empId = parseRowId(actor?.id || actor?.employeeId || requestId);
      if (empId) {
        request = await caSeparationRepository.findActiveByEmployee(cId, empId);
        if (request) reqId = request.id;
      }
    }
    if (!request) {
      throw new AppError("Separation request not found", 404);
    }

    if (request.status !== "Pending Review") {
      throw new AppError(
        `Cannot withdraw separation request once it has been ${request.status.toLowerCase()}. Please contact your reporting manager or HR to retain.`,
        400
      );
    }

    const history = Array.isArray(request.review_history) ? [...request.review_history] : [];
    const nowIso = new Date().toISOString();

    history.push({
      step: history.length + 1,
      title: "Resignation Request Withdrawn",
      actor_id: parseRowId(actor?.id || actor?.employeeId),
      actor_name: actor?.name || "Employee",
      role: actor?.role || "Employee",
      department: actor?.department || "General",
      action: "Withdrawn",
      date: nowIso,
      comments: "Request withdrawn by employee.",
      status: "completed",
    });

    const updated = await caSeparationRepository.update(reqId, cId, {
      status: "Withdrawn",
      reviewHistory: history,
    });

    // Clean up any linked exit in ca_offboarding_exits and remove resignation details from ca_employees
    try {
      if (request.employee_id) {
        await caOffboardingService.withdrawExit(request.employee_id, cId);
        await db.query(
          `UPDATE public.ca_employees
           SET status = 'Active',
               details = details - 'lastWorkingDay' - 'resignationDate' - 'resignationReason',
               last_working_day = NULL,
               resignation_date = NULL,
               resignation_reason = NULL,
               updated_at = NOW()
           WHERE (id::text = $1) ${cId ? "AND created_by_company_id = $2" : ""}`,
          cId ? [String(request.employee_id), cId] : [String(request.employee_id)]
        );
      }
    } catch (cleanErr) {
      console.warn("Could not cancel offboarding exit on withdraw:", cleanErr);
    }

    return updated;
  },
};

