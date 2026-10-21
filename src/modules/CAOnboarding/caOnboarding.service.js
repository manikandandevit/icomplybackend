import { sendMail } from "../../core/mail/mailer.js";
import { config } from "../../config/index.js";
import { caOnboardingRepository } from "./caOnboarding.repository.js";

// Helper to send a consolidated email grouped cleanly by Candidate
async function sendConsolidatedTasksEmail({
  assigneeName,
  assigneeEmail,
  tasks,
  country = "India",
}) {
  const taskCount = tasks.length;
  const subject = `[iComply Onboarding] You have ${taskCount} assigned onboarding task${taskCount > 1 ? "s" : ""} - ${country}`;

  // Group tasks by Candidate Name
  const candidateMap = new Map();
  tasks.forEach((t) => {
    const cName = t.candidateName || `${country} Joiners`;
    if (!candidateMap.has(cName)) {
      candidateMap.set(cName, {
        candidateName: cName,
        candidateRole: t.candidateRole || "New Joinee",
        candidateJoiningDate: t.candidateJoiningDate || "Upcoming",
        tasks: [],
      });
    }
    candidateMap.get(cName).tasks.push(t);
  });

  // Build clean candidate card blocks with child task rows
  let candidateCardsHtml = "";
  candidateMap.forEach((cData) => {
    const taskRows = cData.tasks
      .map(
        (task, idx) => `
        <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 0 ? "background-color: #ffffff;" : "background-color: #f8fafc;"}">
          <td style="padding: 10px 14px; font-weight: 600; color: #1e293b; font-size: 13px;">
            ${task.taskTitle}
          </td>
          <td style="padding: 10px 14px; font-size: 12px;">
            <span style="background-color: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 6px; font-weight: 600; border: 1px solid #e2e8f0;">
              ${task.sectionTitle || "Onboarding"}
            </span>
          </td>
          <td style="padding: 10px 14px; text-align: right; font-weight: bold; font-size: 12px; color: #ea580c; white-space: nowrap;">
            ⏰ ${task.dueDate || "Day 1"}
          </td>
        </tr>
      `
      )
      .join("");

    candidateCardsHtml += `
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 20px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <span style="font-size: 15px; font-weight: bold; color: #0f172a;">👤 ${cData.candidateName}</span>
                <span style="font-size: 13px; color: #64748b; margin-left: 8px;">— ${cData.candidateRole}</span>
              </td>
              <td style="text-align: right;">
                <span style="background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 12px; border: 1px solid #bbf7d0;">
                  📅 Joining: ${cData.candidateJoiningDate}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 8px 14px; font-weight: 700;">Assigned Task</th>
              <th style="padding: 8px 14px; font-weight: 700;">Phase / Section</th>
              <th style="padding: 8px 14px; font-weight: 700; text-align: right;">Target Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>
      </div>
    `;
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);">
      <div style="background-color: #0c2340; padding: 24px; border-bottom: 3px solid #f97316;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">iComply Statutory & Onboarding</h1>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Onboarding Task Assignment Notification</p>
      </div>
      
      <div style="padding: 24px; color: #334155; line-height: 1.5;">
        <p style="font-size: 16px; margin: 0 0 8px 0; color: #0f172a;">Hi <strong>${assigneeName}</strong>,</p>
        <p style="font-size: 14px; margin: 0 0 20px 0; color: #64748b;">
          You have been assigned <strong style="color: #0f172a;">${taskCount} task${taskCount > 1 ? "s" : ""}</strong> for incoming team members in <strong style="color: #0f172a;">${country}</strong>. Tasks are grouped below by candidate:
        </p>

        ${candidateCardsHtml}

        <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; border-radius: 6px; margin-top: 15px; font-size: 13px; color: #9a3412;">
          <strong>Next Action:</strong> Please sign in to your iComply workspace to track and mark tasks complete before their target deadlines.
        </div>
      </div>

      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        This automated notification was generated by the iComply Employee Lifecycle Module.
      </div>
    </div>
  `;

  return await sendMail({
    to: assigneeEmail,
    subject,
    html,
    text: `You have ${taskCount} onboarding tasks assigned for ${country} Joiners. Check your iComply portal for details.`,
  });
}

export const caOnboardingService = {
  async notifyTask(companyId, payload) {
    const {
      candidateName,
      candidateRole,
      candidateCountry,
      candidateJoiningDate,
      taskTitle,
      sectionTitle,
      assigneeName,
      dueDate,
    } = payload;

    // 1. Look up assignee email in DB
    let assigneeEmail = await caOnboardingRepository.findAssigneeEmail(companyId, assigneeName);

    // Default fallback email pattern if no explicit DB email found
    if (!assigneeEmail) {
      assigneeEmail = `${assigneeName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@icomply.com`;
    }

    // 2. Compose professional HTML Email Notification
    const subject = `[iComply Onboarding] New Task Assigned: ${taskTitle} for ${candidateName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #081525; padding: 24px; text-align: left; border-bottom: 4px solid #f97316;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">iComply Statutory & Onboarding</h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">New Onboarding Task Notification</p>
        </div>
        
        <div style="padding: 24px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Hi <strong>${assigneeName}</strong>,</p>
          <p style="font-size: 14px;">A new onboarding task has been assigned to you for upcoming candidate <strong>${candidateName}</strong>.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">Task Overview</h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Task Description:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${taskTitle}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Phase / Section:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0284c7;">${sectionTitle || "ONBOARDING"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Target Due Date:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #ea580c;">${dueDate || "As scheduled"}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a;">Candidate Details</h3>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Candidate Name:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${candidateName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Designation / Role:</td>
                <td style="padding: 6px 0; color: #334155;">${candidateRole || "New Joiner"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Country Location:</td>
                <td style="padding: 6px 0; color: #334155;">${candidateCountry || "India"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Expected Joining Date:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #16a34a;">${candidateJoiningDate || "Upcoming"}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b;">Please login to the iComply Company Admin portal to complete and mark this task done.</p>
        </div>

        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          This is an automated notification from iComply Lifecycle & Onboarding Module.
        </div>
      </div>
    `;

    await sendMail({
      to: assigneeEmail,
      subject,
      html,
      text: `New Task Assigned: ${taskTitle} for ${candidateName}. Section: ${sectionTitle}. Due: ${dueDate}`,
    });

    return { assigneeEmail, sent: true };
  },

  async notifyBatch(companyId, { tasks, country = "India" }) {
    // Group tasks by assigneeName
    const grouped = {};
    for (const t of tasks) {
      const name = (t.assigneeName || "").trim();
      if (!name) continue;
      if (!grouped[name]) {
        grouped[name] = [];
      }
      grouped[name].push(t);
    }

    const assigneeEntries = Object.entries(grouped);
    const results = await Promise.all(
      assigneeEntries.map(async ([assigneeName, userTasks]) => {
        let assigneeEmail = await caOnboardingRepository.findAssigneeEmail(companyId, assigneeName);

        const isDummyDomain =
          !assigneeEmail ||
          assigneeEmail.includes("@test.com") ||
          assigneeEmail.includes("@example.com") ||
          assigneeEmail.includes("@icomply.com");

        if (isDummyDomain && config.smtp?.email) {
          assigneeEmail = config.smtp.email;
        } else if (!assigneeEmail) {
          assigneeEmail = `${assigneeName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@icomply.com`;
        }

        const sent = await sendConsolidatedTasksEmail({
          assigneeName,
          assigneeEmail,
          tasks: userTasks,
          country,
        });

        return {
          assigneeName,
          assigneeEmail,
          tasksCount: userTasks.length,
          sent,
        };
      })
    );

    return results;
  },

  async getTemplates(companyId) {
    if (!companyId) return {};
    return caOnboardingRepository.getTemplates(companyId);
  },

  async saveTemplates(companyId, payload) {
    return caOnboardingRepository.saveTemplates(companyId, payload);
  },

  async getProgress(companyId) {
    if (!companyId) return { progress: {}, joiners: [] };
    return caOnboardingRepository.getProgress(companyId);
  },

  async saveProgress(companyId, payload) {
    return caOnboardingRepository.saveProgress(companyId, payload);
  },
};
