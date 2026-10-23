import { sendMail } from "../../core/mail/mailer.js";
import { brandingService } from "../Branding/branding.service.js";

const escapeHtml = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const streamToBuffer = async (stream) => {
  if (!stream) return null;
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const buildRequisitionApprovalHtml = ({
  requisition,
  approveUrl,
  rejectUrl,
  hasLogo = false,
}) => {
  const reqId = escapeHtml(requisition.reqId || `REQ-${requisition.id}`);
  const position = escapeHtml(requisition.position || "Untitled Position");
  const department = escapeHtml(requisition.department || "General");
  const location = escapeHtml(requisition.location || "Not specified");
  const type = escapeHtml(requisition.type || "Full Time");
  const openings = escapeHtml(requisition.positionsCount || 1);
  const priority = escapeHtml(requisition.priority || "Medium");
  const budget = escapeHtml(requisition.budget || "Not specified");
  const targetDate = escapeHtml(requisition.targetDate || "Not specified");
  const hiringManager = escapeHtml(requisition.hiringManager || "Hiring Team");
  const hiringManagerEmail = escapeHtml(requisition.hiringManagerEmail || "");
  const approverName = escapeHtml(requisition.approverName || "Approver");
  const establishment = escapeHtml(requisition.establishmentName || requisition.companyName || "Corporate");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>iComply - Requisition Approval Request</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.07),0 2px 4px -2px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
          
          <!-- Header Banner (Only iComply Brand Logo) -->
          <tr>
            <td style="background:#0c2340;padding:24px 32px;border-bottom:3px solid #16a34a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        ${
                          hasLogo
                            ? `<td valign="middle" style="padding-right:10px;">
                            <img src="cid:icomply-logo" alt="iComply" width="30" height="30" style="display:block;border-radius:6px;width:30px;height:30px;object-fit:contain;" />
                          </td>`
                            : ""
                        }
                        <td valign="middle">
                          <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;line-height:1;"><span style="color:#22c55e;">i</span>Comply</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.3);color:#fbbf24;font-size:10px;font-weight:700;padding:4px 10px;border-radius:9999px;letter-spacing:0.5px;text-transform:uppercase;">
                      Pending Approval
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <h2 style="margin:0 0 8px 0;font-size:19px;font-weight:700;color:#0f172a;">Action Required: Approve Job Requisition</h2>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#475569;">
                Hello <strong>${approverName}</strong>,<br>
                A new job requisition has been initiated and requires your review and approval. Please inspect the requisition details below:
              </p>

              <!-- Requisition Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Requisition ID</div>
                          <div style="font-size:16px;font-weight:800;color:#0f172a;margin-top:2px;">${reqId}</div>
                        </td>
                        <td align="right">
                          <span style="display:inline-block;background:#e0f2fe;color:#0284c7;font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;">
                            ${priority} Priority
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;">
                      <tr>
                        <td width="38%" style="color:#64748b;padding:5px 0;">Position / Title:</td>
                        <td width="62%" style="color:#0f172a;font-weight:700;padding:5px 0;">${position}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Department:</td>
                        <td style="color:#0f172a;font-weight:600;padding:5px 0;">${department}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Location:</td>
                        <td style="color:#0f172a;font-weight:600;padding:5px 0;">${location}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Establishment / Entity:</td>
                        <td style="color:#0f172a;padding:5px 0;">${establishment}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Employment Type:</td>
                        <td style="color:#0f172a;padding:5px 0;">${type}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Openings:</td>
                        <td style="color:#0f172a;font-weight:700;padding:5px 0;">${openings} ${Number(openings) > 1 ? 'positions' : 'position'}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Budget / CTC:</td>
                        <td style="color:#0f172a;font-weight:700;padding:5px 0;">${budget}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Target Date:</td>
                        <td style="color:#0f172a;padding:5px 0;">${targetDate}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;padding:5px 0;">Hiring Manager:</td>
                        <td style="color:#0f172a;font-weight:600;padding:5px 0;">
                          ${hiringManager} ${hiringManagerEmail ? `<span style="font-weight:400;color:#64748b;font-size:12px;">(${hiringManagerEmail})</span>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Buttons -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 20px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius:8px;background:#16a34a;">
                          <a href="${approveUrl}" target="_blank" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;padding:14px 34px;text-decoration:none;border-radius:8px;border:1px solid #15803d;letter-spacing:0.2px;">
                            ✓ Approve Requisition
                          </a>
                        </td>
                        <td width="16"></td>
                        <td align="center" style="border-radius:8px;background:#fef2f2;">
                          <a href="${rejectUrl}" target="_blank" style="display:inline-block;background:#fef2f2;color:#dc2626;font-size:13px;font-weight:600;padding:14px 22px;text-decoration:none;border-radius:8px;border:1px solid #fecaca;">
                            ✕ Reject
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
                Clicking <strong>Approve</strong> will immediately mark this requisition as <strong>Approved</strong> in iComply and open it for candidate hiring.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
              This link is secure and valid for 7 days.<br>
              © ${new Date().getFullYear()} iComply. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const sendRequisitionApprovalEmail = async ({
  requisition,
  approverEmail,
  approverName,
  approveUrl,
  rejectUrl,
}) => {
  const reqId = requisition.reqId || `REQ-${requisition.id}`;
  const position = requisition.position || "Position";

  const attachments = [];
  let hasLogo = false;

  try {
    const file = await brandingService.getLogo();
    if (file?.body) {
      const buffer = await streamToBuffer(file.body);
      if (buffer && buffer.length > 0) {
        attachments.push({
          filename: "logo.png",
          content: buffer,
          contentType: file.contentType || "image/png",
          cid: "icomply-logo",
        });
        hasLogo = true;
      }
    }
  } catch (err) {
    console.warn("Could not attach branding logo to requisition email:", err?.message);
  }

  const subject = `iComply · Requisition Approval Request - ${position} (${reqId})`;
  const html = buildRequisitionApprovalHtml({
    requisition,
    approveUrl,
    rejectUrl,
    hasLogo,
  });

  const text = [
    `iComply - Job Requisition Approval Request`,
    `Requisition ID: ${reqId}`,
    `Position: ${position}`,
    `Department: ${requisition.department}`,
    `Location: ${requisition.location}`,
    `Budget: ${requisition.budget}`,
    `Openings: ${requisition.positionsCount}`,
    `Hiring Manager: ${requisition.hiringManager || "N/A"}`,
    ``,
    `To approve this requisition, click:`,
    approveUrl,
    ``,
    `To reject:`,
    rejectUrl,
  ].join("\n");

  return await sendMail({
    to: approverEmail,
    subject,
    html,
    text,
    attachments,
    fromName: "iComply",
  });
};
