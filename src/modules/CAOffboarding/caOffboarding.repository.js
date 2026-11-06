import { db } from "../../core/db/pool.js";
import {
  caOffboardingTableSql,
  caOffboardingIndexSql,
  caOffboardingTemplateTableSql,
} from "./caOffboarding.constants.js";

let ready = null;

const ensureTable = () => {
  if (!ready) {
    ready = (async () => {
      await db.query(caOffboardingTableSql);
      for (const statement of caOffboardingIndexSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await db.query(statement);
      }
      await db.query(caOffboardingTemplateTableSql);
    })();
  }
  return ready;
};

const parseRowId = (id) => {
  const n = Number.parseInt(String(id ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const parseDateToIso = (val) => {
  if (!val) return null;
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
};

export const caOffboardingRepository = {
  async syncFromEmployee(companyId, employee, details) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(employee.id);
    if (!cid || !empId) return null;

    const rawResignationDate = details?.resignationDate;
    const rawLwd = details?.lastWorkingDay;
    const reason = details?.resignationReason || "";

    if (!rawResignationDate && !rawLwd) return null;

    const rDate = parseDateToIso(rawResignationDate) || parseDateToIso(rawLwd) || new Date().toISOString().split("T")[0];
    const lwd = parseDateToIso(rawLwd) || rDate;

    const existing = await db.query(
      `SELECT id, status FROM public.ca_offboarding_exits WHERE created_by_company_id = $1 AND employee_id = $2 LIMIT 1`,
      [cid, empId]
    );

    if (!existing.rows[0]) {
      let countryCode = "IN";
      let countryName = "India";
      const cId = String(details?.countryId || employee?.country_id || "");
      const cName = String(details?.countryName || employee?.country_name || "").toLowerCase();
      if (cId === "2" || cName.includes("singapore") || cName === "sg") {
        countryCode = "SG";
        countryName = "Singapore";
      } else if (cId === "3" || cName.includes("malaysia") || cName === "my") {
        countryCode = "MY";
        countryName = "Malaysia";
      }

      const cStatus = String(details?.citizenshipStatus || "").toLowerCase();
      const isForeigner = cStatus === "foreigner" || (cStatus && !cStatus.includes("citizen") && !cStatus.includes("pr"));
      const isCitizen = cStatus.includes("citizen") || cStatus.includes("pr") || cStatus.includes("malaysian");

      let templateKey = countryName;
      if (countryCode === "SG") {
        templateKey = isForeigner ? "Singapore Foreigner" : "Singapore Citizen";
      }

      let templateSections = [];
      let tmplRes = await db.query(
        `SELECT sections FROM public.ca_offboarding_templates WHERE company_id = $1 AND template_key = $2 LIMIT 1`,
        [String(cid), templateKey]
      );
      if (!tmplRes.rows[0] && countryCode === "SG") {
        tmplRes = await db.query(
          `SELECT sections FROM public.ca_offboarding_templates WHERE company_id = $1 AND template_key = 'Singapore' LIMIT 1`,
          [String(cid)]
        );
      }
      if (!tmplRes.rows[0] && countryCode === "MY") {
        tmplRes = await db.query(
          `SELECT sections FROM public.ca_offboarding_templates WHERE company_id = $1 AND template_key = 'Malaysia' LIMIT 1`,
          [String(cid)]
        );
      }
      if (tmplRes.rows[0] && Array.isArray(tmplRes.rows[0].sections)) {
        const rawSecs = tmplRes.rows[0].sections;
        if (rawSecs.length > 0 && rawSecs[0].items) {
          templateSections = rawSecs.map((sec, secIdx) => {
            let filteredItems = (sec.items || []).filter((it) => it.required !== false);
            if (countryCode === "SG") {
              if (isForeigner) {
                // Foreigner: Exclude CPF (leaves 10 Foreigner items)
                filteredItems = filteredItems.filter((it) => !it.title.toLowerCase().includes("cpf"));
              } else {
                // Citizen / PR: Exclude Foreigner-only tasks (leaves 7 Citizen items)
                filteredItems = filteredItems.filter((it) => {
                  const title = it.title.toLowerCase();
                  return (
                    !title.includes("work pass") &&
                    !title.includes("ir21") &&
                    !title.includes("repatriation") &&
                    !title.includes("tax matters")
                  );
                });
              }
            } else if (countryCode === "MY") {
              if (isCitizen) {
                filteredItems = filteredItems.filter((it) => !it.title.toLowerCase().includes("foreigners only"));
              }
            }
            return {
              id: sec.id || `sec-${secIdx}`,
              title: sec.title,
              tasks: filteredItems.map((it, itIdx) => ({
                id: it.id || `task-${secIdx}-${itIdx}`,
                title: it.title,
                assignee: it.assignee || "Unassigned",
                daysOffsetLabel: it.daysOffsetLabel || "Last day",
                required: true,
                completed: false,
              })),
            };
          }).filter((s) => s.tasks.length > 0);
        } else {
          templateSections = rawSecs;
        }
      }

      if (!templateSections || templateSections.length === 0) {
        if (countryCode === "SG") {
          if (isForeigner) {
            templateSections = [
              {
                id: "tmpl-sg-foreigner-hr-checklist",
                title: "HR Checklist",
                tasks: [
                  { id: "sg-for-1", title: "Resignation / Termination Letter received", assignee: "Admin HR", daysOffsetLabel: "-28d", required: true, completed: false },
                  { id: "sg-for-2", title: "Notice period and last working day confirmed", assignee: "Admin HR", daysOffsetLabel: "-27d", required: true, completed: false },
                  { id: "sg-for-3", title: "Handover of duties and company property completed", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                  { id: "sg-for-4", title: "Final salary, overtime and unused annual leave calculated", assignee: "Finance Head", daysOffsetLabel: "Last day", required: true, completed: false },
                  { id: "sg-for-5", title: "IR21 tax clearance assessed, filed and monies withheld where required", assignee: "Finance Head", daysOffsetLabel: "-30d", required: true, completed: false },
                  { id: "sg-for-6", title: "Outstanding salary and tax matters settled", assignee: "Finance Head", daysOffsetLabel: "Last day", required: true, completed: false },
                  { id: "sg-for-7", title: "Work Pass (EP / S Pass / Work Permit) cancelled with MOM", assignee: "Admin HR", daysOffsetLabel: "+7d", required: true, completed: false },
                  { id: "sg-for-8", title: "Repatriation / air ticket arrangements completed where required", assignee: "Admin HR", daysOffsetLabel: "+5d", required: true, completed: false },
                  { id: "sg-for-9", title: "Final payslip issued and salary payment completed", assignee: "Finance Head", daysOffsetLabel: "+3d", required: true, completed: false },
                  { id: "sg-for-10", title: "Company system access deactivated and HR records updated", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                ],
              },
            ];
          } else {
            templateSections = [
              {
                id: "tmpl-sg-citizen-hr-checklist",
                title: "HR Checklist",
                tasks: [
                  { id: "sg-cit-1", title: "Resignation / Termination Letter received", assignee: "Admin HR", daysOffsetLabel: "-28d", required: true, completed: false },
                  { id: "sg-cit-2", title: "Notice period and last working day confirmed", assignee: "Admin HR", daysOffsetLabel: "-27d", required: true, completed: false },
                  { id: "sg-cit-3", title: "Handover of duties and company property completed", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                  { id: "sg-cit-4", title: "Final salary, overtime and unused annual leave calculated", assignee: "Finance Head", daysOffsetLabel: "Last day", required: true, completed: false },
                  { id: "sg-cit-5", title: "Final CPF contributions processed", assignee: "Finance Head", daysOffsetLabel: "+14d", required: true, completed: false },
                  { id: "sg-cit-6", title: "Final payslip issued and salary payment completed", assignee: "Finance Head", daysOffsetLabel: "+3d", required: true, completed: false },
                  { id: "sg-cit-7", title: "Company system access deactivated and HR records updated", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                ],
              },
            ];
          }
        } else if (countryCode === "MY") {
          const myFallbackTasks = [
            { id: "my-task-1", title: "Resignation / Termination Letter", assignee: "Admin HR", daysOffsetLabel: "-28d", required: true, completed: false },
            { id: "my-task-2", title: "Confirm Notice Period & Last Working Day", assignee: "Admin HR", daysOffsetLabel: "-27d", required: true, completed: false },
            { id: "my-task-3", title: "Handover of Duties & Company Assets", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
            { id: "my-task-4", title: "Final Salary & Unused Annual Leave Settlement", assignee: "Finance Head", daysOffsetLabel: "Last day", required: true, completed: false },
            { id: "my-task-5", title: "EPF, SOCSO & EIS Contributions (if applicable)", assignee: "Finance Head", daysOffsetLabel: "+15d", required: true, completed: false },
            { id: "my-task-6", title: "LHDN Tax Clearance (if required)", assignee: "Finance Head", daysOffsetLabel: "-30d", required: true, completed: false },
            { id: "my-task-7", title: "Work Permit / Employment Pass Cancellation (foreigners only)", assignee: "Admin HR", daysOffsetLabel: "+7d", required: true, completed: false },
            { id: "my-task-8", title: "Final Payslip & Employee Clearance", assignee: "Finance Head", daysOffsetLabel: "+3d", required: true, completed: false },
            { id: "my-task-9", title: "Deactivate System Access & Update HR Records", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
          ];
          templateSections = [
            {
              id: "tmpl-my-checklist",
              title: "HR Checklist",
              tasks: isCitizen
                ? myFallbackTasks.filter((t) => !t.title.toLowerCase().includes("foreigners only"))
                : myFallbackTasks,
            },
          ];
        } else {
          templateSections = [
            {
              id: "tmpl-in-offboarding-checklist",
              title: "Offboarding Clearance",
              tasks: [
                { id: "in-task-clearance-form", title: "Clearance Form", assignee: "Admin HR", daysOffsetLabel: "-3d", required: true, completed: false },
                { id: "in-task-exit-interview", title: "Exit Interview", assignee: "Admin HR", daysOffsetLabel: "-2d", required: true, completed: false },
                { id: "in-task-asset-id-return", title: "Asset and ID Card Return", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                { id: "in-task-email-backup", title: "Employee Email Backup", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                { id: "in-task-disable-email", title: "Disable Email ID", assignee: "IT Support", daysOffsetLabel: "Last day", required: true, completed: false },
                { id: "in-task-disable-hrms", title: "Disable HRMS Account", assignee: "Admin HR", daysOffsetLabel: "Last day", required: true, completed: false },
                { id: "in-task-remove-pf", title: "Remove from PF", assignee: "Finance Head", daysOffsetLabel: "+15d", required: true, completed: false },
                { id: "in-task-remove-esi", title: "Remove from ESI", assignee: "Finance Head", daysOffsetLabel: "+15d", required: true, completed: false },
              ],
            },
          ];
        }
      }

      const { rows } = await db.query(
        `INSERT INTO public.ca_offboarding_exits (
          employee_id, employee_code, employee_name, role, department,
          country_code, country_name, resignation_date, last_working_day,
          reason, status, sections, is_urgent, created_by_company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'In Progress', $11, FALSE, $12)
        RETURNING *`,
        [
          empId,
          employee.employeeCode || employee.employee_code || `EMP-${empId}`,
          employee.name,
          employee.designationName || employee.designation_name || "Employee",
          employee.departmentName || employee.department_name || "",
          countryCode,
          countryName,
          rDate,
          lwd,
          reason,
          JSON.stringify(templateSections),
          cid,
        ]
      );
      return rows[0];
    } else {
      const isEmployeeActive = employee.status === "Active";
      const { rows } = await db.query(
        `UPDATE public.ca_offboarding_exits
         SET resignation_date = COALESCE(NULLIF($1, '')::date, resignation_date),
             last_working_day = COALESCE(NULLIF($2, '')::date, last_working_day),
             reason = COALESCE(NULLIF($3, ''), reason),
             status = CASE WHEN $5 = TRUE THEN 'In Progress' ELSE status END,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [rDate, lwd, reason, existing.rows[0].id, isEmployeeActive]
      );
      return rows[0];
    }
    return null;
  },

  async list(companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    if (!cid) return [];

    // Auto-sync any resigning employees from ca_employees
    try {
      const empRes = await db.query(
        `SELECT e.id, e.employee_code, e.name, e.designation_name, e.department_name, e.details
         FROM public.ca_employees e
         WHERE e.created_by_company_id = $1
           AND e.status = 'Active'
           AND (
             (e.details->>'resignationDate' IS NOT NULL AND TRIM(e.details->>'resignationDate') <> '')
             OR (e.details->>'lastWorkingDay' IS NOT NULL AND TRIM(e.details->>'lastWorkingDay') <> '')
           )`,
        [cid]
      );

      for (const emp of empRes.rows) {
        const details = (emp.details && typeof emp.details === 'object') ? emp.details : {};
        await this.syncFromEmployee(cid, emp, details);
      }
    } catch (syncErr) {
      console.warn("Could not sync resigning employees to offboarding exits:", syncErr);
    }

    const { rows } = await db.query(
      `
      SELECT 
        id,
        employee_id,
        employee_code,
        employee_name,
        role,
        department,
        country_code,
        country_name,
        resignation_date,
        last_working_day,
        reason,
        status,
        sections,
        is_urgent,
        created_at,
        updated_at
      FROM public.ca_offboarding_exits
      WHERE created_by_company_id = $1
      ORDER BY id DESC
      `,
      [cid]
    );

    return rows.map((r) => ({
      id: `EXIT-${r.id}`,
      exitId: r.id,
      employeeId: String(r.employee_id),
      employeeCode: r.employee_code,
      name: r.employee_name,
      role: r.role || "Employee",
      department: r.department || "",
      countryCode: r.country_code || "IN",
      countryName: r.country_name || "India",
      resignationDate: r.resignation_date ? new Date(r.resignation_date).toISOString().split("T")[0] : "",
      lastDay: r.last_working_day ? new Date(r.last_working_day).toISOString().split("T")[0] : "",
      reason: r.reason || "",
      status: r.status,
      isUrgent: Boolean(r.is_urgent),
      sections: Array.isArray(r.sections) ? r.sections : [],
      initials: String(r.employee_name || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join(""),
      avatarBg: "bg-orange-100 text-[#ea580c]",
    }));
  },

  async create(companyId, payload) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const empId = parseRowId(payload.employeeId);
    if (!cid || !empId) return null;

    const { rows } = await db.query(
      `
      INSERT INTO public.ca_offboarding_exits (
        employee_id,
        employee_code,
        employee_name,
        role,
        department,
        country_code,
        country_name,
        resignation_date,
        last_working_day,
        reason,
        status,
        sections,
        is_urgent,
        created_by_company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
      RETURNING id
      `,
      [
        empId,
        payload.employeeCode || "",
        payload.employeeName || "",
        payload.role || "Employee",
        payload.department || "",
        payload.countryCode || "IN",
        payload.countryName || "India",
        payload.resignationDate || new Date(),
        payload.lastWorkingDay || payload.resignationDate || new Date(),
        payload.reason || "",
        "In Progress",
        JSON.stringify(payload.sections || []),
        Boolean(payload.isUrgent),
        cid,
      ]
    );

    return rows[0] || null;
  },

  async updateSections(id, companyId, sections) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const exitId = parseRowId(String(id).replace("EXIT-", ""));
    if (!cid || !exitId) return false;

    const { rowCount } = await db.query(
      `
      UPDATE public.ca_offboarding_exits
      SET sections = $3::jsonb, updated_at = NOW()
      WHERE (id = $1 OR employee_id = $1) AND created_by_company_id = $2
      `,
      [exitId, cid, JSON.stringify(sections)]
    );

    return rowCount > 0;
  },

  async completeExit(id, companyId) {
    await ensureTable();
    const cid = parseRowId(companyId);
    const exitId = parseRowId(String(id).replace("EXIT-", ""));
    if (!cid || !exitId) return null;

    const { rows } = await db.query(
      `
      UPDATE public.ca_offboarding_exits
      SET status = 'Completed', updated_at = NOW()
      WHERE (id = $1 OR employee_id = $1) AND created_by_company_id = $2
      RETURNING *
      `,
      [exitId, cid]
    );

    if (rows[0] && rows[0].employee_id) {
      try {
        const empRes = await db.query(
          `UPDATE public.ca_employees
           SET status = 'Inactive', updated_at = NOW()
           WHERE id = $1 AND created_by_company_id = $2
           RETURNING name, details`,
          [rows[0].employee_id, cid]
        );
        const empName = empRes.rows[0]?.name || rows[0].employee_name;
        const empEmail = empRes.rows[0]?.details?.officialEmail || empRes.rows[0]?.details?.personalEmail || "";

        // Also ensure any corresponding onboarding records, offers, and recruitment candidates are archived as Alumni
        if (empName) {
          await db.query(
            `UPDATE public.ca_onboarding
             SET status = 'Completed', employee_id = $1, updated_at = NOW()
             WHERE created_by_company_id = $2
               AND (employee_id = $1 OR LOWER(TRIM(candidate_name)) = LOWER(TRIM($3)) OR LOWER(TRIM(candidate_name)) LIKE LOWER(TRIM($3)) || '%')`,
            [rows[0].employee_id, cid, empName]
          );
          await db.query(
            `UPDATE public.ca_offers
             SET status = 'Completed', updated_at = NOW()
             WHERE created_by_company_id = $1
               AND (LOWER(TRIM(candidate_name)) = LOWER(TRIM($2)) OR LOWER(TRIM(candidate_name)) LIKE LOWER(TRIM($2)) || '%')`,
            [cid, empName]
          );
          await db.query(
            `UPDATE public.ca_candidates
             SET stage = 'Alumni', updated_at = NOW()
             WHERE created_by_company_id = $1
               AND (LOWER(TRIM(name)) = LOWER(TRIM($2)) OR LOWER(TRIM(name)) LIKE LOWER(TRIM($2)) || '%' OR (LENGTH($3) > 3 AND LOWER(TRIM(email)) = LOWER(TRIM($3))))`,
            [cid, empName, empEmail]
          );
        }
      } catch (e) {
        console.warn("Could not mark employee Inactive on exit completion:", e);
      }
    }

    return rows[0] || null;
  },

  async getTemplates(companyId) {
    await ensureTable();
    const cid = String(companyId || "");
    if (!cid) return {};

    const { rows } = await db.query(
      `SELECT template_key, sections FROM public.ca_offboarding_templates WHERE company_id = $1`,
      [cid]
    );

    const templates = {};
    rows.forEach((r) => {
      templates[r.template_key] = r.sections;
    });
    return templates;
  },

  async saveTemplates(companyId, { templates, templateKey, sections }) {
    await ensureTable();
    const cid = String(companyId || "");
    if (!cid) return false;

    if (templates && typeof templates === "object") {
      for (const [key, sec] of Object.entries(templates)) {
        await db.query(
          `INSERT INTO public.ca_offboarding_templates (company_id, template_key, sections, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (company_id, template_key)
           DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
          [cid, key, JSON.stringify(sec)]
        );
      }
      return true;
    } else if (templateKey && Array.isArray(sections)) {
      await db.query(
        `INSERT INTO public.ca_offboarding_templates (company_id, template_key, sections, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (company_id, template_key)
         DO UPDATE SET sections = EXCLUDED.sections, updated_at = CURRENT_TIMESTAMP`,
        [cid, templateKey, JSON.stringify(sections)]
      );
      return true;
    }
    return false;
  },
};
