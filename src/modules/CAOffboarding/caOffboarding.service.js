import { caOffboardingRepository } from "./caOffboarding.repository.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caOnboardingRepository } from "../CAOnboarding/caOnboarding.repository.js";
import { sendMail } from "../../core/mail/mailer.js";
import { db } from "../../core/db/pool.js";

export const caOffboardingService = {
  async listExits(companyId) {
    return caOffboardingRepository.list(companyId);
  },

  async initiate(companyId, payload) {
    const { employeeId, reason, lastWorkingDay, sections } = payload;

    const employee = await caEmployeesRepository.findById(employeeId, companyId);
    if (!employee) {
      const err = new Error("Employee not found");
      err.statusCode = 404;
      throw err;
    }

    let countryCode = "IN";
    let countryName = "India";
    const cId = String(employee.details?.countryId || employee.country_id || "");
    const cName = String(employee.details?.countryName || employee.country_name || "").toLowerCase();
    if (cId === "2" || cName.includes("singapore") || cName === "sg") {
      countryCode = "SG";
      countryName = "Singapore";
    } else if (cId === "3" || cName.includes("malaysia") || cName === "my") {
      countryCode = "MY";
      countryName = "Malaysia";
    }

    const cStatus = String(employee.details?.citizenshipStatus || "").toLowerCase();
    const isForeigner = cStatus === "foreigner" || (cStatus && !cStatus.includes("citizen") && !cStatus.includes("pr"));
    const isCitizen = cStatus.includes("citizen") || cStatus.includes("pr") || cStatus.includes("malaysian");

    let exitSections = sections || [];
    if (!exitSections || exitSections.length === 0) {
      const templateKey = countryCode === "SG"
        ? (isForeigner ? "Singapore Foreigner" : "Singapore Citizen")
        : countryName;

      const templates = await caOffboardingRepository.getTemplates(companyId);
      const rawSecs = templates[templateKey] || (countryCode === "SG" ? templates["Singapore"] : countryCode === "MY" ? templates["Malaysia"] : templates["India"]);

      if (Array.isArray(rawSecs) && rawSecs.length > 0) {
        if (rawSecs[0].items) {
          exitSections = rawSecs.map((sec, secIdx) => {
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
          exitSections = rawSecs;
        }
      }

      if (!exitSections || exitSections.length === 0) {
        if (countryCode === "SG") {
          exitSections = isForeigner
            ? [
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
              ]
            : [
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
          exitSections = [
            {
              id: "tmpl-my-checklist",
              title: "HR Checklist",
              tasks: isCitizen
                ? myFallbackTasks.filter((t) => !t.title.toLowerCase().includes("foreigners only"))
                : myFallbackTasks,
            },
          ];
        } else {
          exitSections = [
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
    }

    // 1. Create Exit record in ca_offboarding_exits (status = 'In Progress')
    const rDate = new Date().toISOString().split("T")[0];
    const lwd = lastWorkingDay || rDate;
    const exit = await caOffboardingRepository.create(companyId, {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      role: employee.designationName || "Employee",
      department: employee.departmentName || "",
      countryCode,
      countryName,
      resignationDate: rDate,
      lastWorkingDay: lwd,
      reason: reason || "",
      sections: exitSections,
      isUrgent: false,
    });

    // 2. Also keep ca_employees details synchronized
    try {
      await db.query(
        `UPDATE public.ca_employees
         SET details = jsonb_set(
               jsonb_set(
                 COALESCE(details, '{}'::jsonb),
                 '{resignationDate}',
                 $1::jsonb
               ),
               '{lastWorkingDay}',
               $2::jsonb
             ),
             updated_at = NOW()
         WHERE id = $3 AND created_by_company_id = $4`,
        [
          JSON.stringify(rDate),
          JSON.stringify(lwd),
          employee.id,
          companyId,
        ]
      );
    } catch (empSyncErr) {
      console.warn("Could not sync resignation info to employee details:", empSyncErr);
    }

    return exit;
  },

  async updateSections(id, companyId, sections) {
    return caOffboardingRepository.updateSections(id, companyId, sections);
  },

  async completeExit(id, companyId) {
    const completed = await caOffboardingRepository.completeExit(id, companyId);
    if (!completed) {
      const err = new Error("Exit record not found or already completed");
      err.statusCode = 404;
      throw err;
    }

    // Update employee status in ca_employees to Inactive
    if (completed.employee_id) {
      await caEmployeesRepository.updateStatus(completed.employee_id, companyId, "Inactive");
    }

    return completed;
  },

  async withdrawExit(exitId, companyId) {
    return caOffboardingRepository.withdrawExit(exitId, companyId);
  },

  async getTemplates(companyId) {
    return caOffboardingRepository.getTemplates(companyId);
  },

  async saveTemplates(companyId, payload) {
    return caOffboardingRepository.saveTemplates(companyId, payload);
  },

  async notifyTask(companyId, payload) {
    const {
      employeeName,
      employeeRole,
      employeeCountry,
      lastWorkingDay,
      taskTitle,
      sectionTitle,
      assigneeName,
      dueDate,
    } = payload;

    const assigneeDetails = await caOnboardingRepository.findAssigneeDetails(companyId, assigneeName);
    let assigneeEmail = assigneeDetails?.email;

    if (!assigneeEmail) {
      assigneeEmail = `${(assigneeName || "assignee").toLowerCase().replace(/[^a-z0-9]/g, ".")}@icomply.com`;
    }

    const subject = `[iComply Offboarding] New Clearance Task Assigned: ${taskTitle} for ${employeeName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #081525; padding: 24px; text-align: left; border-bottom: 4px solid #f97316;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">iComply Statutory & Offboarding</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Employee Offboarding Clearance Notification</p>
        </div>
        
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Hi <strong>${assigneeName}</strong>,</p>
          <p style="font-size: 14px;">An employee offboarding clearance task has been assigned to you for exiting employee <strong>${employeeName}</strong>.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">Clearance Task Overview</h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Task Description:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${taskTitle}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Clearance Phase:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0284c7;">${sectionTitle || "Offboarding Clearance"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Target Timeline:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #ea580c;">${dueDate || "Last day"}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">Exiting Employee Details</h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Employee Name:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Designation / Role:</td>
                <td style="padding: 6px 0; color: #334155;">${employeeRole || "Employee"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Location / Country:</td>
                <td style="padding: 6px 0; color: #334155;">${employeeCountry || "India"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Last Working Day:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #e11d48;">${lastWorkingDay || "As scheduled"}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b;">Please login to your iComply Employee Self-Service (ESS) portal or Company Admin portal to sign off and mark this task complete.</p>
        </div>

        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          This is an automated notification from iComply Lifecycle & Offboarding Module.
        </div>
      </div>
    `;

    let emailSent = false;
    try {
      emailSent = await sendMail({
        to: assigneeEmail,
        subject,
        html,
        text: `New Offboarding Clearance Task Assigned: ${taskTitle} for ${employeeName}. Section: ${sectionTitle}. Due: ${dueDate}`,
      });
    } catch (mailErr) {
      console.warn("sendMail error in offboarding notifyTask:", mailErr?.message || mailErr);
    }

    return { assigneeEmail, sent: emailSent };
  },

  async notifyBatch(companyId, { tasks, country = "India" }) {
    const grouped = {};
    for (const t of tasks || []) {
      const name = (t.assigneeName || "").trim();
      if (!name) continue;
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(t);
    }

    const assigneeEntries = Object.entries(grouped);
    const results = await Promise.all(
      assigneeEntries.map(async ([assigneeName, userTasks]) => {
        let assigneeEmail = await caOnboardingRepository.findAssigneeEmail(companyId, assigneeName);
        if (!assigneeEmail) {
          assigneeEmail = `${assigneeName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@icomply.com`;
        }

        const taskCount = userTasks.length;
        const subject = `[iComply Offboarding] You have ${taskCount} assigned exit clearance task${taskCount > 1 ? "s" : ""} - ${country}`;
        const taskRows = userTasks.map(
          (t) => `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${t.taskTitle}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #0284c7;">${t.sectionTitle || "Offboarding Clearance"}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #334155;">${t.employeeName}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #ea580c;">${t.dueDate || "Last day"}</td>
            </tr>
          `
        ).join("");

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #081525; padding: 24px; text-align: left; border-bottom: 4px solid #f97316;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">iComply Offboarding Tasks Summary</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Assigned Exit Clearance Action Items</p>
            </div>
            <div style="padding: 24px; color: #334155; line-height: 1.6;">
              <p style="font-size: 15px; margin-top: 0;">Hi <strong>${assigneeName}</strong>,</p>
              <p style="font-size: 14px;">You have <strong>${taskCount}</strong> clearance task${taskCount > 1 ? "s" : ""} assigned to you across offboarding employees:</p>
              <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 8px;">
                <thead>
                  <tr style="background-color: #f8fafc; text-align: left; font-size: 11.5px; text-transform: uppercase; color: #64748b;">
                    <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Task</th>
                    <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Phase</th>
                    <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Exiting Employee</th>
                    <th style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">Due</th>
                  </tr>
                </thead>
                <tbody>${taskRows}</tbody>
              </table>
              <p style="font-size: 13px; color: #64748b;">Please login to your portal to review and sign off.</p>
            </div>
          </div>
        `;

        let sent = false;
        try {
          sent = await sendMail({ to: assigneeEmail, subject, html, text: `You have ${taskCount} offboarding tasks assigned.` });
        } catch (e) {
          console.warn("sendMail error in batch offboarding:", e?.message);
        }
        return { assigneeName, assigneeEmail, taskCount, sent };
      })
    );
    return results;
  },
};
