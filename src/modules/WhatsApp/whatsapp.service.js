import crypto from "crypto";
import PDFDocument from "pdfkit";
import { db } from "../../core/db/pool.js";
import { prorateDays } from "../../core/leave/entitlement.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caLeaveRequestsRepository } from "../CALeaveRequests/caLeaveRequests.repository.js";
import { caLeaveYearBalancesService } from "../CALeaveYearBalances/caLeaveYearBalances.service.js";
import { caHolidaysRepository } from "../CAHolidays/caHolidays.repository.js";
import { caPayrollRunsService } from "../CAPayrollRuns/caPayrollRuns.service.js";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export const whatsappConfig = () => ({
  token: process.env.WHATSAPP_TOKEN || "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  appSecret: process.env.WHATSAPP_APP_SECRET || "",
});

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

/** Checks Meta's X-Hub-Signature-256 header when WHATSAPP_APP_SECRET is set. */
export const isValidSignature = (rawBody, signatureHeader) => {
  const { appSecret } = whatsappConfig();
  if (!appSecret) return true;
  if (!rawBody || !signatureHeader) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Finds the employee whose Employee Master mobile matches the WhatsApp number.
 * WhatsApp sends full international digits (e.g. 919876543210); the stored number
 * may or may not include the country code, so the stored digits are matched as a suffix.
 */
export const findEmployeeByWhatsApp = async (waNumber) => {
  const incoming = digitsOnly(waNumber);
  if (incoming.length < 8) return null;
  const { rows } = await db.query(
    `
    SELECT id, created_by_company_id
    FROM public.ca_employees
    WHERE length(regexp_replace(COALESCE(mobile, ''), '\\D', '', 'g')) >= 8
      AND (
        regexp_replace(mobile, '\\D', '', 'g') = $1
        OR $1 LIKE '%' || regexp_replace(mobile, '\\D', '', 'g')
      )
    ORDER BY (COALESCE(status, 'Active') = 'Active') DESC, id DESC
    LIMIT 1
    `,
    [incoming],
  );
  const row = rows[0];
  if (!row) return null;
  const employee = await caEmployeesRepository.findById(row.id, row.created_by_company_id);
  return employee ? { employee, companyId: String(row.created_by_company_id) } : null;
};

const isAll = (value) => {
  const v = String(value ?? "").trim().toLowerCase();
  return !v || v === "all";
};

const establishmentCountry = async (establishmentId) => {
  if (!establishmentId) return { countryId: "", countryName: "" };
  try {
    const { rows } = await db.query(
      `SELECT country_id, country_name FROM public.ca_establishments WHERE id::text = $1 LIMIT 1`,
      [String(establishmentId)],
    );
    return { countryId: rows[0]?.country_id != null ? String(rows[0].country_id) : "", countryName: rows[0]?.country_name || "" };
  } catch {
    return { countryId: "", countryName: "" };
  }
};

/**
 * Leave balance for one employee, using the same rules as the Leave Balance screen:
 * leave types eligible for the employee's establishment, country and gender;
 * remaining = entitled (incl. carry forward) − approved days this year.
 */
export const leaveBalanceFor = async (companyId, employee, year = new Date().getFullYear()) => {
  const [leaveTypes, country] = await Promise.all([
    caHrMasterRepository.list(companyId, "leave-types"),
    establishmentCountry(employee.establishmentId),
  ]);
  const empEstId = String(employee.establishmentId || "");
  const countryId = country.countryId || String(employee.details?.countryId || "");
  const isMalaysia = String(country.countryName || "").toLowerCase().includes("malaysia");

  const eligible = leaveTypes.filter((type) => {
    const v = type.values || {};
    if (!isAll(v.establishmentId) && String(v.establishmentId) !== empEstId) return false;
    if (countryId && !isAll(v.countryId) && String(v.countryId) !== countryId) return false;
    const genderId = String(v.eligibleGenderId || "").trim().toLowerCase();
    const genderName = String(v.eligibleGenderName || "").trim().toLowerCase();
    if (genderId && genderId !== "all" && genderName !== "all") {
      const sameId = employee.genderId && String(employee.genderId) === String(v.eligibleGenderId);
      const sameName = genderName && String(employee.genderName || "").trim().toLowerCase() === genderName;
      if (!sameId && !sameName) return false;
    }
    if (isMalaysia) {
      const name = String(v.name || "").toLowerCase();
      const code = String(v.code || "").toLowerCase();
      if (name.includes("infant") || code.includes("inf") || code === "icl") return false;
    }
    return true;
  });

  const balances = [];
  for (const type of eligible) {
    const snapshot = await caLeaveYearBalancesService.ensureEmployeeYear(companyId, employee, type, year).catch(() => null);
    const entitled = snapshot
      ? Number(snapshot.entitledDays) || 0
      : prorateDays(Number(type.values?.days) || 0, employee.joinDate, year, type.values?.prorate);
    const used = await caLeaveRequestsRepository.usedDays(companyId, employee.id, type.id, year, ["Approved"]);
    balances.push({
      name: type.values?.name || "Leave",
      entitled,
      used,
      remaining: Math.max(entitled - used, 0),
    });
  }
  return balances;
};

const fmt = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(1));
const firstNameOf = (employee) => String(employee?.name || "").trim().split(/\s+/)[0] || "there";
const MENU_HINT = "\n\n_Type *Hi* anytime to see the menu._";

export const leaveBalanceMessage = (employee, balances, year) => {
  if (balances.length === 0) {
    return `No leave types are set up for you yet. Please contact HR.${MENU_HINT}`;
  }
  const lines = balances.map((b) => `• ${b.name}: *${fmt(b.remaining)}* / ${fmt(b.entitled)} days`);
  return `🗓️ *Your leave balance (${year})*\n${lines.join("\n")}\n\n_Available / Total entitled_${MENU_HINT}`;
};

/* ─── WhatsApp Cloud API senders ─── */

const graphUrl = (path) => `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;

const postMessage = async (payload) => {
  const { token, phoneNumberId } = whatsappConfig();
  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set; reply not sent");
    return;
  }
  const response = await fetch(graphUrl(`${phoneNumberId}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[whatsapp] send failed (${response.status}):`, detail.slice(0, 500));
  }
};

export const sendWhatsAppText = (to, body) =>
  postMessage({ to: digitsOnly(to), type: "text", text: { preview_url: false, body } });

/** List message: a "Menu" button that opens the options (WhatsApp has no grid layout). */
const sendList = (to, { header, body, button, rows }) =>
  postMessage({
    to: digitsOnly(to),
    type: "interactive",
    interactive: {
      type: "list",
      ...(header ? { header: { type: "text", text: header.slice(0, 60) } } : {}),
      body: { text: body.slice(0, 1024) },
      action: {
        button: button.slice(0, 20),
        sections: [
          {
            title: "Options",
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id.slice(0, 200),
              title: r.title.slice(0, 24),
              ...(r.description ? { description: r.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });

/** Uploads a PDF to WhatsApp and sends it as a document. */
const sendPdf = async (to, buffer, filename, caption) => {
  const { token, phoneNumberId } = whatsappConfig();
  if (!token || !phoneNumberId) return;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  const upload = await fetch(graphUrl(`${phoneNumberId}/media`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploaded = await upload.json().catch(() => ({}));
  if (!upload.ok || !uploaded?.id) {
    console.error(`[whatsapp] media upload failed (${upload.status}):`, JSON.stringify(uploaded).slice(0, 500));
    await sendWhatsAppText(to, "Sorry, the document could not be sent right now. Please try again later.");
    return;
  }
  await postMessage({
    to: digitsOnly(to),
    type: "document",
    document: { id: uploaded.id, filename, caption },
  });
};

/* ─── Menu ─── */

const MENU_ROWS = [
  { id: "menu:profile", title: "👤 My Profile", description: "Get your profile as a PDF" },
  { id: "menu:leave", title: "🗓️ Leave", description: "See your leave balance" },
  { id: "menu:payslip", title: "💰 Payslip", description: "Download your payslips" },
  { id: "menu:holidays", title: "🎉 Holidays", description: "Next 5 upcoming holidays" },
];

const sendMenu = (to, employee) =>
  sendList(to, {
    header: "iHRConnectz",
    body:
      `Hi ${firstNameOf(employee)} 👋\nWelcome to iHRConnectz HR Assistant.` +
      (employee.establishmentName ? `\n🏢 ${employee.establishmentName}` : "") +
      `\n\nTap *Menu* and choose what you need.`,
    button: "Menu",
    rows: MENU_ROWS,
  });

/* ─── Holidays ─── */

const formatDay = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};

const sendHolidays = async (to, companyId, employee) => {
  const all = await caHolidaysRepository.list(companyId, {
    isEmployee: true,
    establishmentId: employee.establishmentId,
    establishmentName: employee.establishmentName,
  });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = all
    .filter((h) => String(h.endDate || h.startDate || "") >= today)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    .slice(0, 5);

  if (upcoming.length === 0) {
    await sendWhatsAppText(to, `🎉 No upcoming holidays found.${MENU_HINT}`);
    return;
  }
  const lines = upcoming.map((h) => {
    const range = h.endDate && h.endDate !== h.startDate ? `${formatDay(h.startDate)} – ${formatDay(h.endDate)}` : formatDay(h.startDate);
    return `• *${h.name}*\n   ${range}`;
  });
  await sendWhatsAppText(to, `🎉 *Upcoming holidays*\n\n${lines.join("\n\n")}${MENU_HINT}`);
};

/* ─── My Profile PDF ─── */

const pdfToBuffer = (build) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });

const profileFields = (employee) => {
  const d = employee.details || {};
  return [
    ["Section", "Employment"],
    ["Employee Code", employee.employeeCode],
    ["Name", employee.name],
    ["Designation", employee.designationName],
    ["Department", employee.departmentName],
    ["Establishment", employee.establishmentName],
    ["Company", employee.companyName],
    ["Employment Type", employee.employmentTypeName],
    ["Date of Joining", employee.joinDate ? formatDay(employee.joinDate) : ""],
    ["Reporting Manager", employee.reportingToName || d.reportingToName],
    ["Status", employee.status],
    ["Section", "Personal"],
    ["Email", employee.email],
    ["Mobile", employee.mobile],
    ["Gender", employee.genderName],
    ["Date of Birth", d.dateOfBirth ? formatDay(d.dateOfBirth) : ""],
    ["Marital Status", employee.maritalStatusName],
  ];
};

const buildProfilePdf = (employee) =>
  pdfToBuffer((doc) => {
    doc.rect(0, 0, doc.page.width, 90).fill("#0c2340");
    doc.fillColor("#ffffff").fontSize(20).font("Helvetica-Bold").text("Employee Profile", 50, 30);
    doc.fontSize(10).font("Helvetica").text(`Generated on ${formatDay(new Date().toISOString())}`, 50, 58);
    doc.fillColor("#0c2340");
    let y = 115;
    for (const [label, value] of profileFields(employee)) {
      if (label === "Section") {
        y += 8;
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#ea580c").text(value, 50, y);
        y += 20;
        doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor("#e2e8f0").stroke();
        continue;
      }
      doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(label, 50, y, { width: 170 });
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0c2340").text(String(value || "—"), 230, y, { width: 315 });
      y += 22;
    }
    doc.font("Helvetica").fontSize(8).fillColor("#94a3b8").text("This document is confidential and generated by iHRConnectz.", 50, 780, { width: 495, align: "center" });
  });

const sendProfile = async (to, employee) => {
  const pdf = await buildProfilePdf(employee);
  const code = String(employee.employeeCode || employee.id).replace(/[^A-Za-z0-9-]/g, "_");
  await sendPdf(to, pdf, `My_Profile_${code}.pdf`, "👤 Your profile");
};

/* ─── Payslips ─── */

const recentPayslips = async (companyId, employeeId) => {
  const now = new Date();
  const fy = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const [current, previous] = await Promise.all([
    caPayrollRunsService.getMyPayslips(companyId, employeeId, fy).catch(() => null),
    caPayrollRunsService.getMyPayslips(companyId, employeeId, fy - 1).catch(() => null),
  ]);
  return [...(current?.payslips || []), ...(previous?.payslips || [])].slice(0, 6);
};

const sendPayslipList = async (to, companyId, employee) => {
  const payslips = await recentPayslips(companyId, employee.id);
  if (payslips.length === 0) {
    await sendWhatsAppText(to, `💰 No payslips are available yet.${MENU_HINT}`);
    return;
  }
  await sendList(to, {
    header: "Payslips",
    body: "Choose the month to download your payslip.",
    button: "Select month",
    rows: payslips.map((p) => ({ id: `payslip:${p.id}`, title: p.monthLabel, description: `Net pay ${Number(p.netPay || 0).toLocaleString("en-US")}` })),
  });
};

const sendPayslipPdf = async (to, companyId, employee, payslipId) => {
  try {
    const { pdfBuffer, filename } = await caPayrollRunsService.getMyPayslipPdf(companyId, employee.id, payslipId);
    await sendPdf(to, Buffer.from(pdfBuffer), filename || "Payslip.pdf", "💰 Your payslip");
  } catch (error) {
    console.error("[whatsapp] payslip PDF failed:", error?.message || error);
    await sendWhatsAppText(to, `Sorry, that payslip could not be found.${MENU_HINT}`);
  }
};

/* ─── Incoming message routing ─── */

// Meta can deliver the same webhook more than once; remember recent message ids.
const seenMessageIds = new Map();
const alreadyHandled = (id) => {
  const now = Date.now();
  for (const [key, at] of seenMessageIds) {
    if (now - at > 10 * 60 * 1000) seenMessageIds.delete(key);
  }
  if (!id) return false;
  if (seenMessageIds.has(id)) return true;
  seenMessageIds.set(id, now);
  return false;
};

/** What the user picked: a list/button id, or a typed keyword. */
const actionOf = (message) => {
  const reply = message.interactive?.list_reply || message.interactive?.button_reply;
  if (reply?.id) return reply.id;
  const text = String(message.text?.body || "").trim().toLowerCase();
  if (/^(1|profile|my profile)$/.test(text)) return "menu:profile";
  if (/^(2|leave|leaves|leave balance)$/.test(text)) return "menu:leave";
  if (/^(3|payslip|payslips|salary)$/.test(text)) return "menu:payslip";
  if (/^(4|holiday|holidays)$/.test(text)) return "menu:holidays";
  return "menu";
};

/** Handles one incoming WhatsApp message from an employee. */
export const handleIncomingMessage = async (message) => {
  if (!message?.from || alreadyHandled(message.id)) return;
  const from = message.from;

  const match = await findEmployeeByWhatsApp(from);
  if (!match) {
    await sendWhatsAppText(from, "This number is not registered in iComply. Please contact your HR.");
    return;
  }
  const { employee, companyId } = match;
  if (String(employee.status || "Active") !== "Active") {
    await sendWhatsAppText(from, "Your account is not active. Please contact your HR.");
    return;
  }

  const action = actionOf(message);
  if (action === "menu:leave") {
    const year = new Date().getFullYear();
    const balances = await leaveBalanceFor(companyId, employee, year);
    await sendWhatsAppText(from, leaveBalanceMessage(employee, balances, year));
  } else if (action === "menu:holidays") {
    await sendHolidays(from, companyId, employee);
  } else if (action === "menu:profile") {
    await sendProfile(from, employee);
  } else if (action === "menu:payslip") {
    await sendPayslipList(from, companyId, employee);
  } else if (action.startsWith("payslip:")) {
    await sendPayslipPdf(from, companyId, employee, action.slice("payslip:".length));
  } else {
    await sendMenu(from, employee);
  }
};
