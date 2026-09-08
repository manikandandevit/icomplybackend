import { sendMail } from "./mailer.js";
import { companiesRepository } from "../../modules/Companies/companies.repository.js";
import { companiesStorage, LOGO_KEY_PATTERN } from "../../modules/Companies/companies.storage.js";
import { caCompaniesRepository } from "../../modules/CACompanies/caCompanies.repository.js";

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

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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
    console.warn("Unable to load company logo for attendance email", error?.message || error);
    return null;
  }
};

const copyFor = (action, record) => {
  const date = formatDate(record.date);
  const name = record.employeeName || "Employee";
  if (action === "submitted") {
    return {
      title: "Attendance Regularization Request",
      badge: "Pending",
      badgeBg: "#dbeafe",
      badgeColor: "#1d4ed8",
      intro: `<strong>${escapeHtml(name)}</strong> applied to regularize attendance on <strong>${escapeHtml(date)}</strong>. Please review this request.`,
      subject: `Regularization applied · ${name} · ${date}`,
    };
  }
  if (action === "approved") {
    return {
      title: "Regularization Request Approved",
      badge: "Approved",
      badgeBg: "#dcfce7",
      badgeColor: "#166534",
      intro: `Your attendance regularization for <strong>${escapeHtml(date)}</strong> has been approved. The requested check-in / check-out time is now updated.`,
      subject: `Regularization approved · ${date}`,
    };
  }
  return {
    title: "Regularization Request Rejected",
    badge: "Rejected",
    badgeBg: "#fee2e2",
    badgeColor: "#b91c1c",
    intro: `Your attendance regularization for <strong>${escapeHtml(date)}</strong> has been rejected. Your original punch times were not changed.`,
    subject: `Regularization rejected · ${date}`,
  };
};

const row = (label, value) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;width:38%;font-size:13px;color:#64748b;font-weight:600;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:13px;color:#0c2340;font-weight:600;">${value}</td>
  </tr>
`;

const buildHtml = ({ brand, copy, record, reviewedByName, hasLogo, greeting }) => {
  const accent = brand.accent || "#0c2340";
  const logoSrc = hasLogo ? "cid:company-logo" : brand.logoUrl || "";
  const logoBlock = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(brand.name)}" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:contain;border-radius:8px;background:#ffffff;padding:4px;" />`
    : `<div style="width:52px;height:52px;border-radius:8px;background:#ffffff;color:${accent};font-weight:800;font-size:16px;line-height:52px;text-align:center;">${escapeHtml(brand.initials)}</div>`;

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
                    <td valign="middle" style="padding-left:12px;color:#ffffff;">
                      <div style="font-size:16px;font-weight:800;">${escapeHtml(brand.name)}</div>
                      <div style="font-size:12px;opacity:0.85;margin-top:2px;">Attendance</div>
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
                Dear ${escapeHtml(greeting || "Team")},
                <p style="margin:10px 0 0;">${copy.intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e8edf2;border-radius:12px;padding:4px 16px;">
                  ${row("Employee", `${escapeHtml(record.employeeName || "—")}${record.employeeCode ? ` · ${escapeHtml(record.employeeCode)}` : ""}`)}
                  ${row("Establishment", escapeHtml(record.establishmentName || "—"))}
                  ${row("Date", escapeHtml(formatDate(record.date)))}
                  ${row("Current check-in", escapeHtml(formatTime(record.checkIn)))}
                  ${row("Current check-out", escapeHtml(formatTime(record.checkOut)))}
                  ${row("Requested check-in", escapeHtml(formatTime(record.requestedCheckIn)))}
                  ${row("Requested check-out", escapeHtml(formatTime(record.requestedCheckOut)))}
                  ${record.regularizationReason ? row("Reason", escapeHtml(record.regularizationReason)) : ""}
                  ${reviewedByName ? row(copy.badge === "Rejected" ? "Rejected by" : "Approved by", escapeHtml(reviewedByName)) : ""}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px;font-size:13px;line-height:1.6;color:#64748b;">
                If you have questions, please contact your company admin or HR.
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

const uniqueEmails = (values) =>
  [...new Set(values.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];

export const notifyRegularizationSubmitted = async ({ companyId, employee, record }) => {
  try {
    const company = await companiesRepository.findById(companyId);
    const to = uniqueEmails([company?.email]).filter(
      (email) => email !== String(employee?.email || "").trim().toLowerCase(),
    );
    if (!to.length) return;

    const brand = await resolveBrand(employee, companyId);
    const logo = await loadLogoAttachment(brand.logoKey);
    const copy = copyFor("submitted", record);
    const html = buildHtml({
      brand,
      copy,
      record,
      reviewedByName: "",
      hasLogo: Boolean(logo),
      greeting: "Company Admin",
    });
    const text = [
      copy.title,
      copy.intro.replace(/<[^>]+>/g, ""),
      `Employee: ${record.employeeName || employee?.name || ""} ${record.employeeCode ? `· ${record.employeeCode}` : ""}`,
      `Date: ${formatDate(record.date)}`,
      `Requested in: ${formatTime(record.requestedCheckIn)}`,
      `Requested out: ${formatTime(record.requestedCheckOut)}`,
      `Reason: ${record.regularizationReason || ""}`,
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
    console.error("Regularization apply email failed", error?.message || error);
  }
};

export const notifyRegularizationStatus = async ({ companyId, employee, record, action, reviewedByName = "" }) => {
  try {
    const to = String(employee?.email || "").trim();
    if (!to) return;
    const brand = await resolveBrand(employee, companyId);
    const logo = await loadLogoAttachment(brand.logoKey);
    const copy = copyFor(action, record);
    const html = buildHtml({
      brand,
      copy,
      record,
      reviewedByName,
      hasLogo: Boolean(logo),
      greeting: employee.name || "Employee",
    });
    const text = [
      copy.title,
      `Dear ${employee.name || "Employee"},`,
      copy.intro.replace(/<[^>]+>/g, ""),
      `Date: ${formatDate(record.date)}`,
      `Requested in: ${formatTime(record.requestedCheckIn)}`,
      `Requested out: ${formatTime(record.requestedCheckOut)}`,
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
    console.error("Regularization status email failed", error?.message || error);
  }
};
