import crypto from "crypto";
import { db } from "../../core/db/pool.js";
import { prorateDays } from "../../core/leave/entitlement.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caLeaveRequestsRepository } from "../CALeaveRequests/caLeaveRequests.repository.js";
import { caLeaveYearBalancesService } from "../CALeaveYearBalances/caLeaveYearBalances.service.js";

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

export const leaveBalanceMessage = (employee, balances, year) => {
  const firstName = String(employee.name || "").trim().split(/\s+/)[0] || "there";
  if (balances.length === 0) {
    return `Hi ${firstName} 👋\n\nNo leave types are set up for you yet. Please contact HR.`;
  }
  const lines = balances.map((b) => `• ${b.name}: *${fmt(b.remaining)}* / ${fmt(b.entitled)} days`);
  return `Hi ${firstName} 👋\n\nYour leave balance (${year}):\n${lines.join("\n")}\n\n_Available / Total entitled_`;
};

export const sendWhatsAppText = async (to, body) => {
  const { token, phoneNumberId } = whatsappConfig();
  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set; reply not sent");
    return;
  }
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digitsOnly(to),
      type: "text",
      text: { preview_url: false, body },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[whatsapp] send failed (${response.status}):`, detail.slice(0, 500));
  }
};

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

/** Handles one incoming WhatsApp message: identify the employee and reply with leave balance. */
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

  const year = new Date().getFullYear();
  const balances = await leaveBalanceFor(companyId, employee, year);
  await sendWhatsAppText(from, leaveBalanceMessage(employee, balances, year));
};
