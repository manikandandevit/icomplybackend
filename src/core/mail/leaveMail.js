import { sendMail } from "./mailer.js";
import { companiesRepository } from "../../modules/Companies/companies.repository.js";
import { companiesStorage, LOGO_KEY_PATTERN } from "../../modules/Companies/companies.storage.js";
import { caCompaniesRepository } from "../../modules/CACompanies/caCompanies.repository.js";
import { caEmployeesRepository } from "../../modules/CAEmployees/caEmployees.repository.js";
import { sessionLabel } from "../leave/workingDays.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value || "—";
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const storageKeyFrom = (stored) => {
  const value = String(stored || "");
  if (LOGO_KEY_PATTERN.test(value)) return value;
  const match = value.match(/(ca-companies|companies)\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|svg)/i);
  return match ? match[0] : null;
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const resolveBrand = async (employee, fallbackCompanyId) => {
  const source = employee?.companySource === "ca" ? "ca" : "parent";
  const companyId = employee?.companyId || fallbackCompanyId;
  const company =
    source === "ca"
      ? await caCompaniesRepository.findById(companyId)
      : await companiesRepository.findById(companyId);
  const stored =
    source === "ca"
      ? await caCompaniesRepository.findLogoKey(companyId)
      : await companiesRepository.findLogoKey(companyId);

  return {
    name: company?.name || employee?.companyName || "Your Company",
    initials: company?.initials || "CO",
    accent: company?.accent || "#0c2340",
    logoKey: storageKeyFrom(stored),
    logoUrl: /^https?:\/\//i.test(String(stored || "")) ? String(stored) : "",
  };
};

const loadLogoAttachment = async (logoKey) => {
  if (!logoKey) return null;
  try {
    const file = await companiesStorage.get(logoKey);
    const content = await streamToBuffer(file.body);
    const ext = String(logoKey).split(".").pop() || "png";
    return {
      filename: `logo.${ext}`,
      content,
      contentType: file.contentType || "image/png",
      cid: "company-logo",
    };
  } catch (error) {
    console.warn("Unable to load company logo for email", error?.message || error);
    return null;
  }
};

const copyFor = (action, request) => {
  const days = `${request.days} day${Number(request.days) === 1 ? "" : "s"}`;
  const dates = `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;
  const session = sessionLabel(request.session);
  if (action === "submitted") {
    return {
      title: "Leave Request Submitted",
      badge: "Pending",
      badgeBg: "#dbeafe",
      badgeColor: "#1d4ed8",
      intro: `<strong>${escapeHtml(request.employeeName)}</strong> applied for <strong>${escapeHtml(request.leaveTypeName)}</strong> (${escapeHtml(days)}, ${escapeHtml(session)}) from <strong>${escapeHtml(dates)}</strong>. Please review this request.`,
      subject: `Leave applied · ${request.employeeName} · ${request.leaveTypeName}`,
    };
  }
  if (action === "revoke-submitted") {
    return {
      title: "Revoke Request Submitted",
      badge: "Pending",
      badgeBg: "#fef3c7",
      badgeColor: "#b45309",
      intro: `<strong>${escapeHtml(request.employeeName)}</strong> applied to revoke <strong>${escapeHtml(request.leaveTypeName)}</strong> (${escapeHtml(days)}, ${escapeHtml(session)}) from <strong>${escapeHtml(dates)}</strong>. Please review this request.`,
      subject: `Revoke applied · ${request.employeeName} · ${request.leaveTypeName}`,
    };
  }
  if (action === "approved") {
    return {
      title: "Leave Request Approved",
      badge: "Approved",
      badgeBg: "#dcfce7",
      badgeColor: "#166534",
      intro: `Your leave request for <strong>${escapeHtml(request.leaveTypeName)}</strong> (${escapeHtml(days)}, ${escapeHtml(session)}) from <strong>${escapeHtml(dates)}</strong> has been approved.`,
      subject: `Leave approved · ${request.leaveTypeName} · ${dates}`,
    };
  }
  if (action === "rejected") {
    return {
      title: "Leave Request Rejected",
      badge: "Rejected",
      badgeBg: "#fee2e2",
      badgeColor: "#b91c1c",
      intro: `Your leave request for <strong>${escapeHtml(request.leaveTypeName)}</strong> (${escapeHtml(days)}, ${escapeHtml(session)}) from <strong>${escapeHtml(dates)}</strong> has been rejected.`,
      subject: `Leave rejected · ${request.leaveTypeName} · ${dates}`,
    };
  }
  return {
    title: "Leave Revoked",
    badge: "Revoked",
    badgeBg: "#e2e8f0",
    badgeColor: "#334155",
    intro: `Your approved leave for <strong>${escapeHtml(request.leaveTypeName)}</strong> (${escapeHtml(days)}, ${escapeHtml(session)}) from <strong>${escapeHtml(dates)}</strong> has been revoked. These days have been added back to your leave balance.`,
    subject: `Leave revoked · ${request.leaveTypeName} · ${dates}`,
  };
};

const row = (label, value) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;width:38%;font-size:13px;color:#64748b;font-weight:600;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#0c2340;font-weight:600;">${value}</td>
  </tr>
`;

const buildHtml = ({ brand, copy, employee, request, reviewedByName, hasLogo, greeting }) => {
  const accent = brand.accent || "#0c2340";
  const logoSrc = hasLogo ? "cid:company-logo" : brand.logoUrl || "";
  const logoBlock = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(brand.name)}" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:contain;border-radius:8px;background:#ffffff;padding:4px;" />`
    : `<div style="width:52px;height:52px;border-radius:8px;background:#ffffff;color:${accent};font-weight:800;font-size:16px;line-height:52px;text-align:center;">${escapeHtml(brand.initials)}</div>`;

  const rejectRow =
    copy.badge === "Rejected" && request.rejectReason
      ? row("Reject reason", escapeHtml(request.rejectReason))
      : "";
  const revokeReason =
    copy.badge === "Revoked" && request.reason ? row("Revoke reason", escapeHtml(request.reason)) : "";

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(12,35,64,0.08);">
            <tr>
              <td style="background:${accent};padding:20px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="64" valign="middle">${logoBlock}</td>
    if (copy.badge === "Pending") return "Leave Management";
    return "Leave Management";
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">
                <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${copy.badgeBg};color:${copy.badgeColor};font-size:11px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;">${copy.badge}</span>
                <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#0c2340;">${escapeHtml(copy.title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0;font-size:14px;line-height:1.6;color:#334155;">
                Dear ${escapeHtml(greeting || employee.name || "Team")},
                <p style="margin:10px 0 0;">${copy.intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e8edf2;border-radius:12px;padding:4px 16px;">
                  ${row("Employee", `${escapeHtml(employee.name || request.employeeName)} ${employee.employeeCode || request.employeeCode ? `· ${escapeHtml(employee.employeeCode || request.employeeCode)}` : ""}`)}
                  ${row("Leave type", escapeHtml(request.leaveTypeName))}
                  ${row("Dates", `${escapeHtml(formatDate(request.startDate))} – ${escapeHtml(formatDate(request.endDate))}`)}
                  ${row("Session", escapeHtml(sessionLabel(request.session)))}
                  ${row("Days", `${escapeHtml(String(request.days))} day${Number(request.days) === 1 ? "" : "s"}`)}
                  ${request.reason && copy.badge !== "Revoked" ? row("Reason", escapeHtml(request.reason)) : ""}
                  ${rejectRow}
                  ${revokeReason}
                  ${reviewedByName ? row(copy.badge === "Rejected" ? "Rejected by" : copy.badge === "Revoked" ? "Revoked by" : "Approved by", escapeHtml(reviewedByName)) : ""}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px;font-size:13px;line-height:1.6;color:#64748b;">
                If you have questions, please contact your reporting manager or HR.
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e8edf2;font-size:11px;color:#94a3b8;">
                This is an automated message from ${escapeHtml(brand.name)}. Please do not reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const notifyLeaveStatus = async ({ companyId, employee, request, action, reviewedByName = "" }) => {
  try {
    const to = String(employee?.email || "").trim();
    if (!to) return;
    const brand = await resolveBrand(employee, companyId);
    const logo = await loadLogoAttachment(brand.logoKey);
    const copy = copyFor(action, request);
    const html = buildHtml({
      brand,
      copy,
      employee,
      request,
      reviewedByName,
      hasLogo: Boolean(logo),
      greeting: employee.name || "Employee",
    });
    const text = [
      copy.title,
      `Dear ${employee.name || "Employee"},`,
      copy.intro.replace(/<[^>]+>/g, ""),
      `Leave type: ${request.leaveTypeName}`,
      `Dates: ${formatDate(request.startDate)} – ${formatDate(request.endDate)}`,
      `Days: ${request.days}`,
    ].join("\n");

    await sendMail({
      to,
      fromName: brand.name,
      subject: `${brand.name} · ${copy.subject}`,
      html,
      text,
      attachments: logo ? [logo] : [],
    });
  } catch (error) {
    console.error("Leave status email failed", error?.message || error);
  }
};

const uniqueEmails = (values) =>
  [...new Set(values.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];

export const notifyLeaveSubmitted = async ({ companyId, employee, request, kind = "leave" }) => {
  try {
    const recipients = [];
    const managerId = employee?.details?.reportingToId || request?.reportingToId;
    if (managerId) {
      const manager = await caEmployeesRepository.findById(managerId, companyId);
      if (manager?.email) recipients.push(manager.email);
    }
    const company = await companiesRepository.findById(companyId);
    if (company?.email) recipients.push(company.email);
    const to = uniqueEmails(recipients).filter((email) => email !== String(employee?.email || "").trim().toLowerCase());
    if (!to.length) return;

    const brand = await resolveBrand(employee, companyId);
    const logo = await loadLogoAttachment(brand.logoKey);
    const copy = copyFor(kind === "revoke" ? "revoke-submitted" : "submitted", request);
    const html = buildHtml({
      brand,
      copy,
      employee,
      request,
      reviewedByName: "",
      hasLogo: Boolean(logo),
      greeting: "Team",
    });
    const text = [
      copy.title,
      copy.intro.replace(/<[^>]+>/g, ""),
      `Employee: ${employee?.name || request.employeeName}`,
      `Leave type: ${request.leaveTypeName}`,
      `Dates: ${formatDate(request.startDate)} – ${formatDate(request.endDate)}`,
      `Session: ${sessionLabel(request.session)}`,
      `Days: ${request.days}`,
    ].join("\n");

    await sendMail({
      to,
      fromName: brand.name,
      subject: `${brand.name} · ${copy.subject}`,
      html,
      text,
      attachments: logo ? [logo] : [],
    });
  } catch (error) {
    console.error("Leave apply email failed", error?.message || error);
  }
};
