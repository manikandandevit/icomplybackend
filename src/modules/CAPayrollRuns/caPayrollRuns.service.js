import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit-table";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import { AppError } from "../../core/errors/AppError.js";
import { config } from "../../config/index.js";
import { caPayrollRunsRepository } from "./caPayrollRuns.repository.js";
import { db } from "../../core/db/pool.js";
import { companiesRepository } from "../Companies/companies.repository.js";
import { companiesStorage, LOGO_KEY_PATTERN } from "../Companies/companies.storage.js";
import { caCompaniesRepository } from "../CACompanies/caCompanies.repository.js";
import { brandingService } from "../Branding/branding.service.js";
import { fileURLToPath } from "url";
import { caPayrollMasterRepository } from "../CAPayrollMaster/caPayrollMaster.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";

const numberToWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; 
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + " Only";
};

// Basic nodemailer transporter setup
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465, 
  auth: {
    user: config.smtp.email,
    pass: config.smtp.password,
  },
});

/** Short statutory names (same as the web payroll screen). */
const formatDeductionDisplayName = (name) => {
  const lower = String(name || "").toLowerCase().trim();
  if (lower === "cpf" || lower.includes("central provident") || lower.startsWith("cpf")) return "CPF";
  if (lower === "epf" || lower === "pf" || lower.includes("provident fund")) return "EPF";
  if (lower === "esi" || lower.includes("state insurance")) return "ESI";
  if (lower === "pt" || lower.includes("professional tax")) return "PT";
  if (lower === "tds" || lower.includes("tax deducted") || lower.includes("income tax")) return "TDS";
  if (lower === "lwf" || lower.includes("labour welfare") || lower.includes("labor welfare")) return "LWF";
  if (lower === "shg" || lower.includes("self-help") || lower.startsWith("shg")) return "SHG";
  if (lower === "hrdf" || lower.includes("human resources development") || lower.startsWith("hrdf")) return "HRDF";
  if (lower === "pcb" || lower === "mtd" || lower.includes("monthly tax") || lower.startsWith("pcb")) return "PCB";
  if (lower === "socso" || lower.includes("perkeso") || lower.startsWith("socso")) return "SOCSO";
  if (lower === "eis" || lower === "sip" || lower.includes("employment insurance") || lower.startsWith("eis")) return "EIS";
  return name;
};

/** Employer statutory shares added as earnings by the web payroll screen. */
const EMPLOYER_EARNING_NAMES = {
  stat_er_epf: "Employer EPF",
  stat_er_esi: "Employer ESI",
  stat_er_lwf: "Employer LWF",
  stat_er_cpf: "Employer CPF",
  stat_er_socso: "Employer SOCSO",
  stat_er_eis: "Employer EIS",
};

/**
 * The saved breakdown keys earnings / deductions by id only
 * (earnings: payroll component id or "stat_er_epf"; deductions:
 * "stat_<statutory config id>" or "comp_<component id>"). Adds the real
 * names (Basic, HRA, EPF, ...) so the payslip shows proper rows.
 */
export const withBreakdownNames = async (companyId, breakdown) => {
  const raw = breakdown && typeof breakdown === "object" ? breakdown : {};
  const earnings = raw.earnings && typeof raw.earnings === "object" ? raw.earnings : null;
  const deductions = raw.deductions && typeof raw.deductions === "object" ? raw.deductions : null;

  // LOP row: saved since the LOP fix; for older payslips with LOP days,
  // use the pro-rata cut (full earnings - earned earnings).
  let bd = raw;
  if (!(Number(raw.lopDeductionAmount) > 0) && Number(raw.lopDays || raw.totalUnpaidDays) > 0 && earnings) {
    let full = 0;
    let earned = 0;
    Object.values(earnings).forEach((info) => {
      // Only pro-rated components (they carry both full and earned amounts).
      if (info?.fullAmount == null || info?.earnedAmount == null) return;
      full += Number(info.fullAmount) || 0;
      earned += Number(info.earnedAmount) || 0;
    });
    const lop = Math.round(full - earned);
    if (lop > 0) bd = { ...raw, lopDeductionAmount: lop };
  }
  if (!earnings && !deductions) return bd;

  const toId = (value) => {
    const n = Number.parseInt(String(value), 10);
    return Number.isInteger(n) && n > 0 && String(n) === String(value) ? n : null;
  };

  const componentIds = new Set();
  const statutoryIds = new Set();
  Object.keys(earnings || {}).forEach((key) => {
    const id = toId(key);
    if (id) componentIds.add(id);
  });
  Object.keys(deductions || {}).forEach((key) => {
    const comp = key.startsWith("comp_") ? toId(key.slice(5)) : null;
    const stat = key.startsWith("stat_") ? toId(key.slice(5)) : null;
    if (comp) componentIds.add(comp);
    if (stat) statutoryIds.add(stat);
  });

  const componentNames = {};
  const statutoryNames = {};
  try {
    if (componentIds.size) {
      const { rows } = await db.query(
        `SELECT id, name FROM public.ca_payroll_components WHERE created_by_company_id = $1 AND id = ANY($2::int[])`,
        [companyId, [...componentIds]]
      );
      rows.forEach((r) => (componentNames[String(r.id)] = r.name));
    }
    if (statutoryIds.size) {
      const { rows } = await db.query(
        `SELECT id, statutory_name FROM public.ca_statutory_configs WHERE created_by_company_id = $1 AND id = ANY($2::int[])`,
        [companyId, [...statutoryIds]]
      );
      rows.forEach((r) => (statutoryNames[String(r.id)] = r.statutory_name));
    }
  } catch (error) {
    console.error("[Payslip] component name lookup failed:", error?.message || error);
  }

  const named = (map, nameFor) =>
    Object.fromEntries(
      Object.entries(map).map(([key, info]) => {
        const value = info && typeof info === "object" ? info : { amount: Number(info) || 0 };
        return [key, value.name ? value : { ...value, name: nameFor(key) }];
      })
    );

  return {
    ...bd,
    ...(earnings && {
      earnings: named(earnings, (key) => EMPLOYER_EARNING_NAMES[key] || componentNames[key] || "Earning"),
    }),
    ...(deductions && {
      deductions: named(deductions, (key) => {
        if (key.startsWith("stat_") && statutoryNames[key.slice(5)]) {
          return formatDeductionDisplayName(statutoryNames[key.slice(5)]);
        }
        if (key.startsWith("comp_") && componentNames[key.slice(5)]) {
          return formatDeductionDisplayName(componentNames[key.slice(5)]);
        }
        return "Deduction";
      }),
    }),
  };
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const toDataUri = (buffer, contentType) =>
  buffer && buffer.length ? `data:${contentType || "image/png"};base64,${Buffer.from(buffer).toString("base64")}` : "";

const fetchAsDataUri = async (url) => {
  if (!url) return "";
  try {
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const type = resp.headers.get("content-type") || "image/png";
    if (!type.startsWith("image/")) return "";
    return toDataUri(Buffer.from(await resp.arrayBuffer()), type);
  } catch {
    return "";
  }
};

/** Logo stored on a company row (S3 key or URL) → data URI, "" if none. */
const storedLogoToDataUri = async (stored) => {
  const value = String(stored || "");
  if (!value) return "";
  const key = LOGO_KEY_PATTERN.test(value)
    ? value
    : value.match(/(ca-companies|companies)\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|svg)/i)?.[0];
  if (key) {
    try {
      const file = await companiesStorage.get(key);
      const uri = toDataUri(await streamToBuffer(file.body), file.contentType);
      if (uri) return uri;
    } catch (error) {
      console.warn("[Payslip] logo download failed:", key, error?.message || error);
    }
  }
  if (/^https?:\/\//i.test(value)) return fetchAsDataUri(value);
  return "";
};

/**
 * Payslip logo as an embedded data URI (always renders, no network wait):
 * 1. the employee's own company (ca / parent), 2. the main company (the
 * logo shown on the web after login), 3. the iComply logo.
 */
const payslipLogoDataUri = async (companyId, emp) => {
  const tries = [];
  if (emp?.companyId) {
    tries.push([
      `employee company (${emp.companySource || "parent"} #${emp.companyId})`,
      () =>
        emp.companySource === "ca"
          ? caCompaniesRepository.findLogoKey(emp.companyId)
          : companiesRepository.findLogoKey(emp.companyId),
    ]);
  }
  tries.push([`main company #${companyId}`, () => companiesRepository.findLogoKey(companyId)]);

  for (const [label, find] of tries) {
    try {
      const uri = await storedLogoToDataUri(await find());
      if (uri) {
        console.info(`[Payslip] logo: ${label}`);
        return uri;
      }
    } catch (error) {
      console.warn(`[Payslip] logo lookup failed (${label}):`, error?.message || error);
    }
  }

  try {
    const file = await brandingService.getLogo();
    const uri = toDataUri(await streamToBuffer(file.body), file.contentType);
    if (uri) {
      console.info("[Payslip] logo: iComply (no company logo uploaded)");
      return uri;
    }
  } catch (error) {
    console.warn("[Payslip] iComply logo not available:", error?.message || error);
  }
  console.warn("[Payslip] no logo available");
  return "";
};

/**
 * Outfit font embedded in the payslip (@font-face with base64 data), so the
 * PDF always uses Outfit. Files are kept in src/assets/fonts; downloaded once
 * from Google Fonts if missing.
 */
const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/fonts");
const OUTFIT_WEIGHTS = [400, 500, 600, 700, 800];
let outfitCssCache = null;

const outfitFontCss = async () => {
  if (outfitCssCache) return outfitCssCache;
  const faces = [];
  try {
    const missing = OUTFIT_WEIGHTS.filter((w) => !fs.existsSync(path.join(FONT_DIR, `Outfit-${w}.ttf`)));
    if (missing.length) {
      // Plain user agent → Google Fonts answers with TTF files.
      const css = await (
        await fetch(`https://fonts.googleapis.com/css2?family=Outfit:wght@${OUTFIT_WEIGHTS.join(";")}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        })
      ).text();
      fs.mkdirSync(FONT_DIR, { recursive: true });
      for (const block of css.split("@font-face").slice(1)) {
        const weight = Number(block.match(/font-weight:\s*(\d+)/)?.[1]);
        const url = block.match(/url\(([^)]+)\)/)?.[1];
        if (!missing.includes(weight) || !url) continue;
        const resp = await fetch(url);
        if (resp.ok) fs.writeFileSync(path.join(FONT_DIR, `Outfit-${weight}.ttf`), Buffer.from(await resp.arrayBuffer()));
      }
    }
    for (const w of OUTFIT_WEIGHTS) {
      const file = path.join(FONT_DIR, `Outfit-${w}.ttf`);
      if (!fs.existsSync(file)) continue;
      const data = fs.readFileSync(file).toString("base64");
      faces.push(
        `@font-face { font-family: 'Outfit'; font-style: normal; font-weight: ${w}; src: url(data:font/ttf;base64,${data}) format('truetype'); }`
      );
    }
  } catch (error) {
    console.warn("[Payslip] Outfit font not available:", error?.message || error);
  }
  if (faces.length) {
    outfitCssCache = faces.join("\n");
    return outfitCssCache;
  }
  return "";
};

/** Public URL of the company logo used in payslips ("" when not configured). */
const payslipLogoUrl = () => {
  try {
    if (config.s3 && config.s3.endpoint && config.s3.logoKey) {
      const baseUrl = config.s3.endpoint.replace('/s3', `/object/public/${config.s3.bucket}/`);
      return baseUrl + config.s3.logoKey;
    }
  } catch {
    // no logo
  }
  return "";
};

/**
 * Builds the payslip PDF (same template as the emailed one).
 * p: payslip (mapPayslip), emp: employee record, estName, monthYear, logoUrlForHtml.
 */
export const buildPayslipPdf = async ({ p, emp, estName, monthYear, logoUrlForHtml = "", format = "pdf" }) => {
  // Extract earnings list
  const earningsList = [];
  if (p.breakdown && p.breakdown.earnings && typeof p.breakdown.earnings === "object") {
    Object.values(p.breakdown.earnings).forEach((info) => {
      const amt = info.earnedAmount ?? info.amount ?? 0;
      if (amt > 0) earningsList.push({ name: info.name || "Earning", amount: amt });
    });
  } else if (p.breakdown && p.breakdown.components) {
    Object.entries(p.breakdown.components).forEach(([name, amount]) => {
      if (amount > 0) earningsList.push({ name, amount });
    });
  }
  if (p.breakdown && Number(p.breakdown.otPayAmount) > 0) {
    earningsList.push({
      name: `Overtime (${p.breakdown.otHours || "OT"})`,
      amount: Number(p.breakdown.otPayAmount),
    });
  }

  // Extract deductions list
  const deductionsList = [];
  if (p.breakdown && p.breakdown.deductions && typeof p.breakdown.deductions === "object") {
    Object.values(p.breakdown.deductions).forEach((info) => {
      const amt = info.amount ?? 0;
      if (amt > 0) deductionsList.push({ name: info.name || "Deduction", amount: amt });
    });
  } else if (p.breakdown && p.breakdown.statutory) {
    Object.entries(p.breakdown.statutory).forEach(([name, amount]) => {
      if (amount > 0) deductionsList.push({ name, amount });
    });
  }
  if (p.breakdown && Number(p.breakdown.lopDeductionAmount) > 0) {
    deductionsList.push({
      name: "Loss of Pay (LOP)",
      amount: Number(p.breakdown.lopDeductionAmount),
    });
  }

  // ---- Corporate payslip (navy, Outfit, soft raised panels) ----
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const inr = (value) => `&#8377;&nbsp;${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
  const bd = p.breakdown || {};
  const gross = Math.round(Number(p.grossPay) || 0);
  const totalDeductions = Math.round(Number(p.deductions) || 0);
  const net = Math.round(Number(p.netPay) || 0);
  const fontCss = await outfitFontCss();
  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const rows = (list, sign) =>
    list.length
      ? list
          .map(
            (item) => `
          <div class="line">
            <span class="line-name">${esc(item.name)}</span>
            <span class="line-amt">${sign}${inr(item.amount)}</span>
          </div>`
          )
          .join("")
      : `<div class="line empty"><span class="line-name">None</span><span class="line-amt">${inr(0)}</span></div>`;

  const detail = (label, value) => `
      <div class="detail">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${value}</div>
      </div>`;

  const pdfHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      ${fontCss ? "" : `<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=block" rel="stylesheet" />`}
      <style>
        ${fontCss}
        @page { size: A4; margin: 0; }
        html { background: #eef2f7; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          margin: 0; padding: 34px 36px 28px;
          font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
          color: #0f172a; font-weight: 500; background: #eef2f7;
        }
        .sheet {
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
          border: 1px solid #d9e0ea; border-radius: 6px; overflow: hidden;
          box-shadow: 0 1px 0 #ffffff inset, 0 10px 28px rgba(16, 36, 80, 0.10), 0 2px 6px rgba(16, 36, 80, 0.06);
        }

        /* Header band */
        .band {
          display: flex; align-items: center; justify-content: space-between; gap: 18px;
          padding: 22px 26px;
          background: linear-gradient(180deg, #2a4683 0%, #1E3463 55%, #172a52 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(0, 0, 0, 0.25);
          color: #ffffff;
        }
        .brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .logo-tile {
          width: 58px; height: 58px; flex-shrink: 0; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(180deg, #ffffff 0%, #eef2f8 100%);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: inset 0 1px 0 #ffffff, 0 3px 8px rgba(0, 0, 0, 0.28);
        }
        .logo-tile img { max-width: 46px; max-height: 46px; object-fit: contain; }
        .logo-tile span { font-size: 20px; font-weight: 800; color: #1E3463; }
        .brand-name { font-size: 19px; font-weight: 800; letter-spacing: 0.2px; line-height: 1.2; }
        .brand-sub { margin-top: 3px; font-size: 11.5px; font-weight: 500; color: rgba(255, 255, 255, 0.72); }
        .doc { text-align: right; flex-shrink: 0; }
        .doc-title { font-size: 22px; font-weight: 800; letter-spacing: 0.3px; }
        .period {
          display: inline-block; margin-top: 6px; padding: 4px 12px; border-radius: 4px;
          font-size: 12px; font-weight: 700; color: #ffffff;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.20), rgba(255, 255, 255, 0.08));
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }

        .content { padding: 20px 24px 22px; }

        /* Raised panel */
        .panel {
          background: linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%);
          border: 1px solid #dde4ee; border-radius: 6px;
          box-shadow: inset 0 1px 0 #ffffff, 0 2px 6px rgba(16, 36, 80, 0.07);
        }
        .panel-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 14px; border-bottom: 1px solid #dde4ee; border-radius: 6px 6px 0 0;
          background: linear-gradient(180deg, #f4f7fb 0%, #e8edf5 100%);
          box-shadow: inset 0 1px 0 #ffffff;
        }
        .panel-title { font-size: 12.5px; font-weight: 800; color: #1E3463; letter-spacing: 0.2px; }
        .panel-hint { font-size: 11px; font-weight: 600; color: #64748b; }

        /* Employee details */
        .details { display: grid; grid-template-columns: repeat(4, 1fr); }
        .detail { padding: 10px 14px; border-right: 1px solid #e6ebf2; border-bottom: 1px solid #e6ebf2; }
        .detail:nth-child(4n) { border-right: none; }
        .detail:nth-last-child(-n + 4) { border-bottom: none; }
        .detail-label { font-size: 10.5px; font-weight: 600; color: #64748b; }
        .detail-value { margin-top: 3px; font-size: 13px; font-weight: 700; color: #0f172a; }

        /* Summary tiles */
        .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
        .tile { padding: 13px 15px; }
        .tile-label { font-size: 11px; font-weight: 600; color: #64748b; }
        .tile-value { margin-top: 4px; font-size: 19px; font-weight: 800; color: #1E3463; }
        .tile.net {
          background: linear-gradient(180deg, #2a4683 0%, #1E3463 60%, #172a52 100%);
          border-color: #142546;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 4px 10px rgba(16, 36, 80, 0.22);
        }
        .tile.net .tile-label { color: rgba(255, 255, 255, 0.72); }
        .tile.net .tile-value { color: #ffffff; }

        /* Earnings / deductions */
        .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: stretch; }
        .split > .panel { display: flex; flex-direction: column; }
        .lines { padding: 4px 14px; flex: 1; }
        .line { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #e1e7ef; }
        .line:last-child { border-bottom: none; }
        .line-name { font-size: 12px; font-weight: 600; color: #1e293b; }
        .line-amt { font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap; }
        .line.empty .line-name, .line.empty .line-amt { color: #94a3b8; font-weight: 500; }
        .total {
          display: flex; justify-content: space-between; padding: 10px 14px;
          border-top: 1px solid #dde4ee; border-radius: 0 0 6px 6px;
          background: linear-gradient(180deg, #eef2f8 0%, #e5ebf4 100%);
          box-shadow: inset 0 1px 0 #ffffff;
          font-size: 12.5px; font-weight: 800; color: #1E3463;
        }

        /* Net pay bar */
        .netbar {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          margin-top: 16px; padding: 16px 20px; border-radius: 6px; color: #ffffff;
          background: linear-gradient(180deg, #2a4683 0%, #1E3463 55%, #172a52 100%);
          border: 1px solid #142546;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 6px 14px rgba(16, 36, 80, 0.20);
        }
        .netbar-label { font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.78); }
        .netbar-words { margin-top: 4px; font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.86); }
        .netbar-amt { font-size: 26px; font-weight: 800; letter-spacing: 0.3px; white-space: nowrap; }

        .foot {
          display: flex; justify-content: space-between; gap: 12px;
          margin-top: 16px; padding-top: 12px; border-top: 1px solid #e6ebf2;
          font-size: 10.5px; font-weight: 500; color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="band">
          <div class="brand">
            <div class="logo-tile">
              ${logoUrlForHtml ? `<img src="${logoUrlForHtml}" alt="Logo" />` : `<span>${esc(String(estName || "C").trim().charAt(0).toUpperCase())}</span>`}
            </div>
            <div style="min-width: 0;">
              <div class="brand-name">${esc(estName)}</div>
              <div class="brand-sub">Salary statement</div>
            </div>
          </div>
          <div class="doc">
            <div class="doc-title">Payslip</div>
            <div class="period">${esc(monthYear)}</div>
          </div>
        </div>

        <div class="content">
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">Employee details</span>
              <span class="panel-hint">Pay period: ${esc(monthYear)}</span>
            </div>
            <div class="details">
              ${detail("Employee name", esc(p.employeeName || emp.name || "-"))}
              ${detail("Employee code", esc(p.employeeCode || emp.employeeCode || "-"))}
              ${detail("Designation", esc(emp.designationName || "-"))}
              ${detail("Department", esc(emp.departmentName || "-"))}
              ${detail("Monthly CTC", inr(p.ctc))}
              ${detail("Working days", esc(bd.workingDays ?? 30))}
              ${detail("Days present", esc(bd.daysPresent ?? 0))}
              ${detail("Payable days", esc(bd.payableDays ?? bd.daysPresent ?? 0))}
            </div>
          </div>

          <div class="tiles">
            <div class="panel tile">
              <div class="tile-label">Gross earnings</div>
              <div class="tile-value">${inr(gross)}</div>
            </div>
            <div class="panel tile">
              <div class="tile-label">Total deductions</div>
              <div class="tile-value">${inr(totalDeductions)}</div>
            </div>
            <div class="panel tile net">
              <div class="tile-label">Net pay</div>
              <div class="tile-value">${inr(net)}</div>
            </div>
          </div>

          <div class="split">
            <div class="panel">
              <div class="panel-head"><span class="panel-title">Earnings</span><span class="panel-hint">Amount</span></div>
              <div class="lines">${rows(earningsList, "")}</div>
              <div class="total"><span>Gross earnings</span><span>${inr(gross)}</span></div>
            </div>
            <div class="panel">
              <div class="panel-head"><span class="panel-title">Deductions</span><span class="panel-hint">Amount</span></div>
              <div class="lines">${rows(deductionsList, "&minus;")}</div>
              <div class="total"><span>Total deductions</span><span>&minus;${inr(totalDeductions)}</span></div>
            </div>
          </div>

          <div class="netbar">
            <div>
              <div class="netbar-label">Net salary payable</div>
              <div class="netbar-words">Rupees ${esc(numberToWords(net) || "Zero Only")}</div>
            </div>
            <div class="netbar-amt">${inr(net)}</div>
          </div>

          <div class="foot">
            <span>This is a system-generated payslip and does not require a signature.</span>
            <span>Generated on ${generatedOn}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  let pdfBuffer;
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    if (format === "png") {
      // Same payslip as a sharp image (A4 width, 2x) for the mobile viewer.
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      await page.setContent(pdfHtml, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      pdfBuffer = await page.screenshot({ type: "png", fullPage: true });
    } else {
      await page.setContent(pdfHtml, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    }
    await browser.close();
  } catch (err) {
    console.error("Puppeteer PDF generation failed:", err);
    throw new Error("PDF generation failed");
  }

  return pdfBuffer;
};

export const caPayrollRunsService = {
  async getPreChecks(companyId, establishmentId, month, year) {
    if (!establishmentId || !month || !year) {
      throw new AppError("Establishment, month, and year are required", 400, "BAD_REQUEST");
    }
    
    // Check pending leave and OT for this establishment and month
    const pendingLeaves = await caPayrollRunsRepository.getPendingLeaves(companyId, establishmentId, month, year);
    const pendingOT = await caPayrollRunsRepository.getPendingOT(companyId, establishmentId, month, year);

    // Normally we would also check attendance here if attendance tracking was fully implemented.
    // For now we'll return leaves and OT.
    return {
      pendingLeaves,
      pendingOT,
      readyToProcess: pendingLeaves === 0 && pendingOT === 0
    };
  },

  async getPreview(companyId, establishmentId, month, year) {
    if (!establishmentId || !month || !year) {
      throw new AppError("Establishment, month, and year are required", 400, "BAD_REQUEST");
    }

    // Ensure prechecks are clear
    const prechecks = await this.getPreChecks(companyId, establishmentId, month, year);
    if (!prechecks.readyToProcess) {
      throw new AppError("Pending requests exist. Resolve Leave/OT requests first.", 400, "PENDING_REQUESTS");
    }

    // Fetch active employees for establishment with OT hours
    const employees = await caPayrollRunsRepository.getEmployeesForPayroll(companyId, establishmentId, month, year);
    
    // Fetch the establishment details to get its country
    const establishment = await caEstablishmentsRepository.findById(establishmentId, companyId);
    if (!establishment) {
      throw new AppError("Establishment not found", 404, "NOT_FOUND");
    }

    // Fetch components for this company
    const allComponents = await caPayrollMasterRepository.list(companyId);
    
    // Filter components strictly by the Establishment
    const components = allComponents.filter(comp => {
      return String(comp.establishmentId) === String(establishmentId);
    });

    // Calculate for each employee
    const preview = employees.map(emp => {
      const annualCTC = Number(emp.base_salary) || 0;
      const monthlyCTC = annualCTC / 12;
      
      const totalDays = 30; // Assuming standard 30 day month for simplicity
      const absentDays = emp.absent || 0;
      const lopDays = emp.lop || 0;
      // Note: Paid leaves (emp.leave) should NOT be deducted from salary.
      // Only absent days and LOP (Loss of Pay) reduce the payable days.
      const unpaidDays = lopDays + absentDays;
      const payableDays = Math.max(0, totalDays - unpaidDays);
      const prorationFactor = payableDays / totalDays;

      let gross = 0;
      let totalAdditions = 0;
      let totalDeductions = 0;
      const appliedComponents = [];

      const country = (establishment.country || "India").toLowerCase();

      if (country === 'singapore') {
        // Singapore: CTC is pro-rated first, then statutory deductions are applied
        gross = monthlyCTC * prorationFactor;

        for (const comp of components) {
          if (comp.conditionMaxSalary > 0 && monthlyCTC > comp.conditionMaxSalary) continue;

          let amount = 0;
          if (comp.calculationType === "Fixed Amount") {
            amount = comp.fixedAmount;
          } else {
            amount = (gross * comp.percentage) / 100;
          }

          if (comp.maxCapAmount > 0 && amount > comp.maxCapAmount) amount = comp.maxCapAmount;

          if (amount > 0) {
            appliedComponents.push({ id: comp.id, name: comp.name, amount, type: comp.ctcImpact });
            if (comp.ctcImpact === "Add") {
              totalAdditions += amount;
              gross += amount;
            } else {
              totalDeductions += amount;
            }
          }
        }
      } else {
        // India: Calculate basic and other additions, pro-rate them, then apply deductions
        for (const comp of components) {
          if (comp.conditionMaxSalary > 0 && monthlyCTC > comp.conditionMaxSalary) continue;

          let amount = 0;
          if (comp.calculationType === "Fixed Amount") {
            amount = comp.fixedAmount;
          } else {
            let baseAmount = monthlyCTC;
            if (comp.dependsOn && comp.dependsOn !== 'CTC') {
              const parentComp = appliedComponents.find(c => String(c.id) === String(comp.dependsOn));
              baseAmount = parentComp ? parentComp.amount : 0;
            }
            amount = (baseAmount * comp.percentage) / 100;
          }

          if (comp.maxCapAmount > 0 && amount > comp.maxCapAmount) amount = comp.maxCapAmount;

          if (amount > 0) {
            // Apply proration for absent, LOP, leave
            amount = amount * prorationFactor;

            appliedComponents.push({ id: comp.id, name: comp.name, amount, type: comp.ctcImpact });
            if (comp.ctcImpact === "Add") {
              totalAdditions += amount;
              gross += amount;
            } else {
              totalDeductions += amount;
            }
          }
        }
      }

      const net = gross - totalDeductions;

      // OT Earnings Calculation
      const otHours = emp.ot_hours || 0;
      let otEarnings = 0;
      if (otHours > 0) {
         // Basic assumption: 30 days * 8 hours = 240 hours/month, 1.5x OT rate
         const hourlyRate = monthlyCTC / 240; 
         otEarnings = otHours * hourlyRate * 1.5; 
      }
      
      const inhandSalary = net + otEarnings;

      return {
        id: emp.id, // Ensure frontend emp.id works
        employeeId: emp.id,
        employeeCode: emp.employeeCode || '',
        employeeName: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        employeeType: emp.employee_type,
        email: emp.email || '',
        base_salary: emp.base_salary || 0,
        ot_hours: otHours,
        grossPay: gross,
        deductions: totalDeductions,
        netPay: net,
        otEarnings: otEarnings,
        inhandSalary: inhandSalary,
        components: appliedComponents,
        status: "Calculated"
      };
    });

    return preview;
  },

  async runPayroll(companyId, payload) {
    const { establishmentId, establishmentName, month, year, data } = payload;
    
    if (!data || !data.length) throw new AppError("No data to process", 400);

    // Create the run record
    const run = await caPayrollRunsRepository.createRun(companyId, establishmentId, establishmentName, month, year);

    // Save payslips and send emails
    for (const emp of data) {
      const payslip = await caPayrollRunsRepository.createPayslip(
        companyId, run.id, emp.employeeId, emp.employeeName, emp.grossPay, emp.netPay, emp.deductions
      );

      // Generate PDF in background (dummy for now to avoid hanging)
      this.generateAndSendPayslip(companyId, payslip, emp, month, year, establishmentName).catch(console.error);
    }

    return run;
  },

  async generateAndSendPayslip(companyId, payslipRecord, empData, month, year, establishmentName) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', async () => {
          const pdfData = Buffer.concat(buffers);
          
          // Send via SMTP
          if (config.smtp.email) {
            
            // Neat HTML Table for Email Body
            const emailHtml = `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0c2340; color: #fff; padding: 20px; text-align: center;">
                  <h2 style="margin: 0;">${establishmentName}</h2>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">Payslip for ${month} ${year}</p>
                </div>
                <div style="padding: 20px;">
                  <p>Dear <strong>${empData.employeeName}</strong>,</p>
                  <p>Please find attached your detailed payslip for the month of ${month} ${year}. Below is a summary of your payroll:</p>
                  
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Employee ID</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${empData.employeeId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">Type</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">${empData.employeeType}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #333;">Gross Pay</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;">Rs. ${Math.round(empData.grossPay).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #e53e3e;">Total Deductions</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #e53e3e;">- Rs. ${Math.round(empData.deductions).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #333;">Net Pay</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #333;">Rs. ${Math.round(empData.netPay).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; color: #0284c7;">OT Earnings</td>
                      <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #0284c7;">+ Rs. ${Math.round(empData.otEarnings || 0).toLocaleString()}</td>
                    </tr>
                    <tr style="background-color: #f8fafc;">
                      <td style="padding: 15px 10px; font-weight: bold; color: #16a34a; font-size: 16px;">Inhand Salary</td>
                      <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #16a34a; font-size: 16px;">Rs. ${Math.round(empData.inhandSalary || empData.netPay).toLocaleString()}</td>
                    </tr>
                  </table>
                  <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">This is an auto-generated email. Please do not reply.</p>
                </div>
              </div>
            `;

            const mailOptions = {
              from: `"${config.smtp.fromName}" <${config.smtp.email}>`,
              to: "employee@example.com", 
              subject: `Payslip for ${month} ${year}`,
              html: emailHtml,
              attachments: [
                {
                  filename: `Payslip_${empData.employeeName.replace(/\s+/g, '_')}_${month}_${year}.pdf`,
                  content: pdfData,
                  contentType: 'application/pdf'
                }
              ]
            };
            
            await transporter.sendMail(mailOptions);
            console.log(`[SMTP] Sent payslip to ${empData.employeeName}`);
          }
          resolve(pdfData);
        });

        // PDF Content with Table
        doc.fontSize(20).font('Helvetica-Bold').text(`${establishmentName}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).font('Helvetica').text(`Payslip - ${month} ${year}`, { align: 'center' });
        doc.moveDown(2);
        
        // Employee Details
        doc.fontSize(12);
        doc.text(`Employee Name: ${empData.employeeName}`);
        doc.text(`Employee ID: ${empData.employeeId}`);
        doc.text(`Type: ${empData.employeeType}`);
        doc.moveDown(2);

        // Earnings and Deductions Table using pdfkit-table
        const tableArray = {
          title: "Salary Breakdown",
          headers: [
            { label: "Component", property: "name", width: 250 },
            { label: "Type", property: "type", width: 100 },
            { label: "Amount (Rs)", property: "amount", width: 150, align: "right" }
          ],
          rows: empData.components.map(comp => [
            comp.name,
            comp.type === 'Add' ? 'Earning' : 'Deduction',
            comp.type === 'Add' ? `${Math.round(comp.amount).toLocaleString()}` : `-${Math.round(comp.amount).toLocaleString()}`
          ])
        };

        // Add summary rows directly into the table for a neat look
        tableArray.rows.push(["", "", ""]);
        tableArray.rows.push(["Gross Pay", "", `${Math.round(empData.grossPay).toLocaleString()}`]);
        tableArray.rows.push(["Total Deductions", "", `-${Math.round(empData.deductions).toLocaleString()}`]);
        tableArray.rows.push(["Net Pay", "", `${Math.round(empData.netPay).toLocaleString()}`]);
        tableArray.rows.push(["OT Earnings", "", `+${Math.round(empData.otEarnings || 0).toLocaleString()}`]);
        tableArray.rows.push(["Inhand Salary", "", `${Math.round(empData.inhandSalary || empData.netPay).toLocaleString()}`]);

        doc.table(tableArray, {
          prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
          prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
            if (indexRow >= tableArray.rows.length - 3) {
              doc.font("Helvetica-Bold").fontSize(11);
            } else {
              doc.font("Helvetica").fontSize(10);
            }
          }
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  async sendPayslips(companyId, runId, employeeId = null) {
    const run = await caPayrollRunsRepository.getRunById(companyId, runId);
    if (!run) throw new AppError("Payroll run not found", 404);

    let payslips = await caPayrollRunsRepository.getPayslipsByRun(companyId, runId);
    if (employeeId) {
      payslips = payslips.filter(p => String(p.employeeId) === String(employeeId));
      if (payslips.length === 0) throw new AppError("Payslip not found for this employee", 404);
    }

    let successCount = 0;
    let failCount = 0;

    // Fetch logo once
    let logoBuffer = null;
    let logoUrlForHtml = "";
    try {
      if (config.s3 && config.s3.endpoint) {
        const baseUrl = config.s3.endpoint.replace('/s3', `/object/public/${config.s3.bucket}/`);
        logoUrlForHtml = baseUrl + config.s3.logoKey;
        const resp = await fetch(logoUrlForHtml);
        if (resp.ok) {
          logoBuffer = Buffer.from(await resp.arrayBuffer());
        }
      }
    } catch (e) {
      console.error("Could not fetch logo for payslips", e);
    }

    for (const p of payslips) {
      try {
        const emp = await caEmployeesRepository.findById(p.employeeId, companyId);
        if (!emp || !emp.email) {
          failCount++;
          continue;
        }

        const estName = run.establishmentName || "Your Company";
        const monthYear = `${run.month} ${run.year}`;
        const subject = `Payslip for ${monthYear}`;

        // Simple Email Body - Direct & Concise
        const html = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif; color: #1e293b; padding: 24px; line-height: 1.6; margin: 0;">
            <p style="font-size: 14px; margin-bottom: 12px;">Dear <strong>${p.employeeName}</strong>,</p>
            <p style="font-size: 14px; margin-bottom: 12px;">Please find attached your payslip for <strong>${monthYear}</strong>.</p>
            <p style="font-size: 14px; margin-bottom: 20px;">Net Pay: <strong style="color: #047857;">&#8377; ${Math.round(p.netPay).toLocaleString("en-IN")}</strong></p>
            <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Regards,<br/><strong>${estName}</strong></p>
          </body>
          </html>
        `;

        const named = { ...p, breakdown: await withBreakdownNames(companyId, p.breakdown) };
        const logoDataUri = (await payslipLogoDataUri(companyId, emp)) || logoUrlForHtml;
        const pdfBuffer = await buildPayslipPdf({ p: named, emp, estName, monthYear, logoUrlForHtml: logoDataUri });

        await transporter.sendMail({
          from: `"${config.smtp.fromName}" <${config.smtp.email}>`,
          to: emp.email,
          subject,
          html,
          attachments: [
            {
              filename: `Payslip_${p.employeeName.replace(/\s+/g, '_')}_${monthYear.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            }
          ]
        });
        successCount++;
      } catch (e) {
        console.error("Error sending email to", p.employeeName, e);
        failCount++;
      }
    }

    return { successCount, failCount, total: payslips.length };
  },

  /**
   * Employee (mobile): own payslips for a financial year (April → March),
   * latest first, plus the year totals and the latest payslip overall.
   */
  async getMyPayslips(companyId, employeeId, fyStart) {
    const all = await caPayrollRunsRepository.getEmployeePayslips(companyId, employeeId);
    const rows = all.map(toEmployeePayslip).filter(Boolean);
    rows.sort((a, b) => b.sortKey - a.sortKey);

    const start = Number.parseInt(fyStart, 10);
    const year = Number.isInteger(start) ? start : currentFyStart();
    const inYear = rows.filter((r) => r.fyStart === year);
    const sum = (key) => inYear.reduce((total, r) => total + (Number(r[key]) || 0), 0);
    const strip = ({ sortKey, ...rest }) => rest;

    return {
      financialYear: { start: year, end: year + 1, label: `${year} - ${year + 1}` },
      latest: rows[0] ? strip(rows[0]) : null,
      totals: { grossPay: sum("grossPay"), deductions: sum("deductions"), netPay: sum("netPay"), count: inYear.length },
      payslips: inYear.map(strip),
    };
  },

  /** Employee (mobile): PDF (or PNG image, format "png") of one of their own payslips. */
  async getMyPayslipPdf(companyId, employeeId, payslipId, format = "pdf") {
    const row = await caPayrollRunsRepository.getEmployeePayslipById(companyId, employeeId, payslipId);
    if (!row) throw new AppError("Payslip not found", 404, "PAYSLIP_NOT_FOUND");

    const emp = (await caEmployeesRepository.findById(employeeId, companyId)) || {};
    const monthYear = `${row.runMonth} ${row.runYear}`;
    const pdfBuffer = await buildPayslipPdf({
      p: { ...row, breakdown: await withBreakdownNames(companyId, row.breakdown) },
      emp,
      estName: row.establishmentName || "Your Company",
      monthYear,
      logoUrlForHtml: await payslipLogoDataUri(companyId, emp),
      format,
    });
    const filename = `Payslip_${String(row.employeeName || "Employee").replace(/\s+/g, "_")}_${monthYear.replace(/\s+/g, "_")}.pdf`;
    return { pdfBuffer, filename };
  },
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Month index (1-12) from "April" / "Apr" / "4". */
const monthNumber = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  const n = Number.parseInt(text, 10);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const idx = MONTHS.findIndex((m) => m === text || m.slice(0, 3) === text.slice(0, 3));
  return idx >= 0 ? idx + 1 : null;
};

const currentFyStart = () => {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

/** Payslip row (with run month/year) → mobile list item. */
const toEmployeePayslip = (row) => {
  const month = monthNumber(row.runMonth);
  const year = Number.parseInt(row.runYear, 10);
  if (!month || !Number.isInteger(year)) return null;
  const label = MONTHS[month - 1];
  return {
    id: row.id,
    runId: row.runId,
    month,
    year,
    monthLabel: `${label[0].toUpperCase()}${label.slice(1)} ${year}`,
    fyStart: month >= 4 ? year : year - 1,
    grossPay: Math.round(Number(row.grossPay) || 0),
    deductions: Math.round(Number(row.deductions) || 0),
    netPay: Math.round(Number(row.netPay) || 0),
    paidOn: row.runCreatedAt || row.createdAt || null,
    sortKey: year * 100 + month,
  };
};
