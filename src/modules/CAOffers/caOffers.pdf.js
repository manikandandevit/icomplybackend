import puppeteer from "puppeteer";
import { brandingService } from "../Branding/branding.service.js";

let cachedLogoBase64 = null;

async function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const file = await brandingService.getLogo();
    const chunks = [];
    for await (const chunk of file.body) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    cachedLogoBase64 = `data:${file.contentType || "image/png"};base64,${buf.toString("base64")}`;
    return cachedLogoBase64;
  } catch (err) {
    console.warn("Could not load branding logo for PDF, using fallback:", err.message);
    return null;
  }
}

export function numberToWordsIndian(num) {
  if (!num || isNaN(num)) return "Zero Only";
  num = Math.round(Number(num));
  if (num === 0) return "Zero Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function formatTens(n) {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
  }

  function formatHundreds(n) {
    if (n > 99) {
      return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + formatTens(n % 100) : "");
    }
    return formatTens(n);
  }

  let words = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  if (crore) words += formatHundreds(crore) + " Crore ";
  if (lakh) words += formatHundreds(lakh) + " Lakh ";
  if (thousand) words += formatHundreds(thousand) + " Thousand ";
  if (remainder) words += formatHundreds(remainder);

  return words.trim() + " Only";
}

export function parseCtcBreakup(ctcInput) {
  const raw = String(ctcInput || "₹96,000/mo")
    .replace(/[₹,]/g, "")
    .trim();

  let isMonthly = true;
  if (/lpa|per annum|annum|\/yr|\/year/i.test(raw)) {
    isMonthly = false;
  }

  const numeric = parseFloat(raw.replace(/[^0-9.]/g, "")) || 96000;

  let monthlyCtc, annualCtc;
  if (isMonthly && numeric <= 300000) {
    monthlyCtc = numeric;
    annualCtc = numeric * 12;
  } else {
    annualCtc = numeric > 100 ? numeric : numeric * 100000;
    monthlyCtc = Math.round(annualCtc / 12);
  }

  const monthlyBasic = Math.round(monthlyCtc * 0.50);
  const annualBasic = monthlyBasic * 12;

  const monthlyHra = Math.round(monthlyBasic * 0.40);
  const annualHra = monthlyHra * 12;

  const monthlySpecial = monthlyCtc - monthlyBasic - monthlyHra;
  const annualSpecial = annualCtc - annualBasic - annualHra;

  return {
    monthlyCtc,
    annualCtc,
    monthlyBasic,
    annualBasic,
    monthlyHra,
    annualHra,
    monthlySpecial,
    annualSpecial,
  };
}

export async function generateOfferLetterHtml(offer, company = {}) {
  const logoSrc = await getLogoBase64();

  const candidateName = offer.candidate || offer.candidateName || "Candidate Name";
  const companyName = company.trade_name || company.legal_name || "Company Name";
  const designation = offer.role || "Designation";
  const departmentName = offer.department || offer.departmentName || "Engineering";
  const reportingManager = offer.reportingManager || offer.hiringManager || offer.interviewer || "Reporting Manager";
  const dateOfJoining = offer.joiningDate || "Date Of joining";
  const workLocation = offer.location || company.city || "Madurai";

  const breakup = parseCtcBreakup(offer.ctc);
  const formattedAnnualCtc = `₹ ${breakup.annualCtc.toLocaleString("en-IN")}`;
  const ctcInWords = numberToWordsIndian(breakup.annualCtc);

  const hrName = company.contact_name || offer.hrName || "HR Department";
  const offerDate = offer.sentOn || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const addressParts = [company.street, company.city, company.state, company.pin].filter(Boolean);
  const companyAddress = addressParts.length > 0 ? addressParts.join(", ") : "Company Address";

  const renderHeader = () => `
    <div class="page-header">
      <div class="logo-box">
        ${
          logoSrc
            ? `<img src="${logoSrc}" alt="iComply Logo" class="brand-logo" />`
            : `<div class="brand-text"><span class="i-part">i</span>Comply</div>`
        }
      </div>
      <div class="header-divider"></div>
    </div>
  `;

  const renderFooter = () => `
    <div class="page-footer">
      <span class="footer-badge">${companyAddress}</span>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Offer Cum Appointment Letter - ${candidateName}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      font-size: 9.5pt;
      line-height: 1.42;
      background: #ffffff;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 13mm 20mm 14mm 20mm;
      position: relative;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      background: #ffffff;
    }
    .page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .page-header {
      margin-bottom: 12px;
    }
    .logo-box {
      height: 32px;
      display: flex;
      align-items: center;
    }
    .brand-logo {
      height: 30px;
      max-width: 140px;
      object-fit: contain;
    }
    .brand-text {
      font-size: 19px;
      font-weight: 800;
      color: #0c2340;
      letter-spacing: -0.5px;
    }
    .brand-text .i-part {
      color: #2563eb;
    }
    .header-divider {
      height: 2px;
      background: #eab308;
      margin-top: 6px;
    }
    .doc-title {
      font-size: 14pt;
      font-weight: 700;
      color: #0c2340;
      text-align: center;
      margin: 18px 0 16px 0;
    }
    .salutation {
      font-weight: 700;
      color: #0c2340;
      margin-bottom: 10px;
    }
    .section-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0c2340;
      margin-top: 10px;
      margin-bottom: 3px;
    }
    p {
      margin: 0 0 6px 0;
      text-align: justify;
    }
    .page-footer {
      position: absolute;
      bottom: 10mm;
      left: 0;
      right: 0;
      text-align: center;
    }
    .footer-badge {
      background-color: #fef08a;
      padding: 2px 8px;
      font-size: 8pt;
      color: #713f12;
      border-radius: 3px;
      display: inline-block;
    }
    .highlight-param {
      background-color: #fef08a;
      padding: 1px 3px;
      border-radius: 2px;
      font-weight: 600;
      color: #0f172a;
    }
    .acceptance-section {
      margin-top: 20px;
    }
    .signature-grid {
      margin-top: 20px;
    }
    .salary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      margin-bottom: 6px;
      font-size: 9.5pt;
    }
    .salary-table th {
      background-color: #0c2340;
      color: #ffffff;
      padding: 8px 12px;
      font-weight: 700;
      border: 1px solid #0c2340;
    }
    .salary-table td {
      padding: 7px 12px;
      border: 1px solid #cbd5e1;
    }
    .salary-table tr.total-row td {
      font-weight: 700;
      background-color: #f8fafc;
      border-top: 2px solid #0c2340;
    }
    .text-center {
      text-align: center;
    }
    .text-left {
      text-align: left;
    }
    .annexure-title {
      font-size: 11.5pt;
      font-weight: 700;
      color: #0c2340;
      text-align: center;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .annexure-b-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0c2340;
      text-align: center;
      margin-top: 28px;
      margin-bottom: 12px;
    }
    .doc-list {
      padding-left: 20px;
      margin: 0;
      line-height: 1.7;
      font-size: 9.5pt;
    }
    .doc-list li {
      margin-bottom: 3px;
    }
    .disclaimer {
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
      margin-top: 5px;
    }
  </style>
</head>
<body>

  <!-- PAGE 1 -->
  <div class="page">
    ${renderHeader()}

    <div class="doc-title">Offer Cum Appointment Letter</div>

    <div class="salutation">Dear <span class="highlight-param">${candidateName}</span>,</div>

    <p>
      We are pleased to offer you employment with <span class="highlight-param">${companyName}</span> for the position of <span class="highlight-param">${designation}</span>, subject to the terms and conditions set out in this Offer-cum-Appointment Letter.
    </p>

    <div class="section-title">1. Appointment</div>
    <p>
      You are appointed as <span class="highlight-param">${designation}</span>, in the department of <span class="highlight-param">${departmentName}</span>, reporting to <span class="highlight-param">${reportingManager}</span>. Your employment will commence on <span class="highlight-param">${dateOfJoining}</span>. Your initial place of work will be <strong>${workLocation}</strong>. The Company may reasonably change your reporting structure, responsibilities, work location or assignment based on business requirements, subject to applicable law.
    </p>

    <div class="section-title">2. Nature of Employment</div>
    <p>
      Your employment is on a full-time basis. You are expected to devote your professional time, attention and abilities to the business of the Company during working hours and perform your responsibilities diligently and professionally. You shall not undertake outside employment, consultancy, freelance work or other professional engagement that conflicts with your responsibilities without prior written approval.
    </p>

    <div class="section-title">3. Compensation</div>
    <p>
      Your annual Cost to Company (CTC) will be <span class="highlight-param">${formattedAnnualCtc}</span> per annum. (in words <span class="highlight-param">${ctcInWords}</span> per annum). The detailed compensation structure is provided in Annexure A. Your salary will be paid monthly through the Company’s regular payroll process, subject to applicable taxes and other statutory or authorised deductions, as applicable.
    </p>

    <div class="section-title">4. Statutory Benefits and Deductions</div>
    <p>
      You will be entitled to statutory benefits and leave applicable to your employment in accordance with the applicable laws and regulations. Any statutory deductions, taxes or contributions applicable to you will be made from your salary as required by law.
    </p>
    <p>
      Where any statutory benefit or contribution becomes applicable to the Company or to your employment based on the applicable legal requirements, the Company will comply with such requirements accordingly.
    </p>

    <div class="section-title">5. Probation</div>
    <p>
      You will initially be on probation for a period of <strong>3 months</strong> from your date of joining. During the probation period, your performance, conduct, attendance, skills and overall suitability for the role will be assessed.
    </p>
    <p>
      Upon satisfactory completion of the 3-month probation period, you will be confirmed as a permanent employee of the Company. If there are any changes to your employment status, including extension of probation or other applicable changes, you will be formally notified in writing by the Company.
    </p>

    ${renderFooter()}
  </div>

  <!-- PAGE 2 -->
  <div class="page">
    ${renderHeader()}

    <div class="section-title" style="margin-top: 6px;">6. Working Hours</div>
    <p>
      Your normal working hours will be <strong>Monday to Friday, 09:30 AM to 05:30 PM</strong>. In addition, the <strong>1st and 3rd Saturdays</strong> of each month will be working days during the same working hours. Sundays and other declared holidays will be observed as weekly offs/holidays, as applicable.
    </p>
    <p>
      Business or client requirements may occasionally require additional working time, subject to applicable law and Company policy.
    </p>

    <div class="section-title">7. Leave and Holidays</div>
    <p>
      You will be entitled to leave, holidays and weekly offs in accordance with applicable law, the Company’s Leave Policy and applicable establishment rules. Leave must normally be applied for and approved through the designated process.
    </p>

    <div class="section-title">8. Duties and Responsibilities</div>
    <p>
      You shall perform assigned duties professionally and diligently, meet reasonable performance expectations, comply with lawful instructions, maintain professional conduct, protect Company property and information, comply with security and technology requirements and follow applicable Company policies.
    </p>

    <div class="section-title">9. Confidentiality</div>
    <p>
      During and after employment, you shall protect confidential Information belonging to the Company, customers, employees, vendors and business partners. Confidential Information includes source code, software architecture, algorithms, databases, customer information, pricing, business plans, financial information, technical documentation, credentials, intellectual property, employee information, contracts, proposals, trade secrets and other non-public information. You shall use such information only for authorised purposes and report suspected unauthorised access, disclosure or loss.
    </p>

    <div class="section-title">10. Intellectual Property Rights</div>
    <p>
      To the extent permitted by applicable law, intellectual property created, developed, designed, conceived or contributed to by you during employment, in connection with your duties, using Company resources or confidential information, or specifically for Company/client projects, shall belong to the Company. This includes software/source code, applications, APIs, databases, documentation, UI/UX designs, inventions, processes, technical solutions, reports, presentations, AI prompts/workflows, automation scripts and other work products. You agree to execute reasonable documents required to establish or protect such rights.
    </p>

    <div class="section-title">11. Company Systems and Information Security</div>
    <p>
      Employees may use their own personal devices, including laptops and mobile devices, for authorised Company work, subject to the Company’s applicable information security requirements.
    </p>
    <p>
      You are responsible for maintaining the security of your device and protecting Company information, systems, applications, credentials and data accessed through it. You must keep your device reasonably secured, use appropriate passwords and authentication measures, avoid unauthorised software or data transfers, and follow the Company’s information security and acceptable-use requirements.
    </p>
    <p>
      Company information must not be copied, shared, stored or transferred through unauthorised applications, personal accounts, external storage or other insecure channels. Any suspected loss, unauthorised access,
    </p>

    ${renderFooter()}
  </div>

  <!-- PAGE 3 -->
  <div class="page">
    ${renderHeader()}

    <p style="margin-top: 6px;">
      data breach or security incident involving Company information must be reported to the Company promptly.
    </p>

    <div class="section-title">12. Personal Data and Privacy</div>
    <p>
      The Company may collect and process your personal information for legitimate employment purposes including recruitment, payroll, statutory compliance, attendance, benefits, performance management, employee administration, security and legal/regulatory requirements. Such information will be handled in accordance with applicable privacy and data-protection requirements and Company policies.
    </p>

    <div class="section-title">13. Conflict of Interest</div>
    <p>
      You must disclose actual or potential conflicts of interest that could reasonably affect your duties. You shall not use your position, Company information, resources or business relationships for unauthorised personal benefit.
    </p>

    <div class="section-title">14. Company Property</div>
    <p>
      All Company property provided to you remains the Company’s property, including laptops, mobile devices, ID cards, documents, files, storage devices, software, credentials, equipment and intellectual property. You must return all Company property upon request and upon cessation of employment.
    </p>

    <div class="section-title">15. Company Policies</div>
    <p>
      You agree to comply with applicable Company policies, including Code of Conduct, Information Security, Data Protection, POSH, Leave and Attendance, Remote/Hybrid Working, Acceptable Use of IT, Conflict of Interest, Intellectual Property, Expense Management and Disciplinary Procedures. Policies may be amended from time to time in accordance with applicable law.
    </p>

    <div class="section-title">16. Prevention of Sexual Harassment</div>
    <p>
      The Company is committed to maintaining a workplace free from sexual harassment and discrimination. Employees must comply with the Company’s POSH policy and applicable law. Complaints will be handled through the designated mechanism and Internal Committee, where applicable.
    </p>

    <div class="section-title">17. Background Verification</div>
    <p>
      This appointment is subject to satisfactory verification of information and documents provided by you. The Company may verify qualifications, employment history, professional credentials, references, identity/address information and other relevant information as legally permissible. Material falsification or deliberate concealment may result in appropriate action in accordance with applicable law and policy.
    </p>

    <div class="section-title">18. Notice Period</div>
    <p>
      After confirmation, either you or the Company may terminate employment by providing <strong>30 days’ written notice</strong>, or such other notice as may be applicable under law, contract or Company policy. The Company may waive or reduce the notice period or relieve you earlier, with any applicable payment in lieu governed by Company policy and applicable law.
    </p>

    ${renderFooter()}
  </div>

  <!-- PAGE 4 -->
  <div class="page">
    ${renderHeader()}

    <div class="section-title" style="margin-top: 6px;">19. Termination for Cause</div>
    <p>
      The Company may take disciplinary action, including termination, for serious misconduct or other lawful grounds, subject to applicable law and disciplinary procedures. Examples may include fraud, theft, serious confidentiality breaches, deliberate falsification, serious misuse of Company systems, wilful security violations or other material breaches of employment obligations.
    </p>

    <div class="section-title">20. Resignation and Exit Formalities</div>
    <p>
      Upon resignation or termination, you shall complete applicable handover, return Company property, return or delete confidential information as instructed, transfer project information, settle authorised dues and cooperate with reasonable exit procedures. Final settlement and statutory documents will be processed in accordance with applicable law and Company procedures.
    </p>

    <div class="section-title">21. Non-Solicitation</div>
    <p>
      To the extent permitted by applicable law, during employment you shall not misuse confidential information or Company resources to solicit Company employees, customers or business partners for an unauthorised competing purpose. Any post-employment restriction shall apply only to the extent legally enforceable.
    </p>

    <div class="section-title">22. Professional Conduct</div>
    <p>
      You are expected to maintain professional behaviour and treat colleagues, customers, vendors and business partners respectfully. Discrimination, harassment, bullying, threats, violence, retaliation and other serious misconduct will not be tolerated.
    </p>

    <div class="section-title">23. Place of Work and Transfer</div>
    <p>
      Based on business requirements, you may be required to work from another Company location, client location or approved remote location, subject to reasonable notice and applicable law. Material changes to fundamental employment conditions will be communicated separately.
    </p>

    <div class="section-title">24. Performance Review</div>
    <p>
      Your performance may be reviewed periodically based on quality, productivity, professional capability, teamwork, attendance, customer satisfaction, achievement of objectives and policy compliance. Performance reviews do not automatically guarantee salary increases, bonuses or promotions.
    </p>

    <div class="section-title">25. Changes to Terms</div>
    <p>
      The Company may update policies, procedures and administrative practices from time to time. Any material change to fundamental employment terms will be communicated in writing and will be subject to applicable law.
    </p>

    ${renderFooter()}
  </div>

  <!-- PAGE 5 -->
  <div class="page">
    ${renderHeader()}

    <div class="section-title" style="margin-top: 6px;">26. Governing Law and Jurisdiction</div>
    <p>
      This employment relationship shall be governed by the laws applicable in India. Subject to applicable statutory dispute-resolution mechanisms, courts/authorities having appropriate jurisdiction over the Company’s establishment and the relevant employment relationship shall have jurisdiction.
    </p>

    <div class="section-title">27. Entire Understanding</div>
    <p>
      This letter, its annexure and applicable Company policies constitute the understanding between you and the Company concerning your employment and supersede prior discussions relating to the same subject matter, except where expressly stated otherwise in writing. If any provision is invalid or unenforceable, the remaining provisions shall continue to the extent permitted by law.
    </p>

    <div class="section-title">28. Acceptance</div>
    <p>
      Please sign and return a copy of this letter as confirmation that you have read, understood and accepted the terms and conditions of employment. We look forward to your contribution and wish you a successful career with <span class="highlight-param">${companyName}</span>.
    </p>

    <div class="signature-grid">
      <p><strong>For <span class="highlight-param">${companyName}</span>.</strong></p>
      <div style="margin-top: 20px; line-height: 1.8;">
        <div>Name: <span class="highlight-param">${hrName}</span></div>
        <div>Designation: <span class="highlight-param">Authorized Signatory</span></div>
        <div>Date: <span class="highlight-param">${offerDate}</span></div>
      </div>
    </div>

    <div class="acceptance-section">
      <div class="section-title" style="margin-bottom: 8px;">EMPLOYEE ACCEPTANCE</div>
      <p>
        I, <span class="highlight-param">${candidateName}</span>, confirm that I have read, understood and accepted the terms and conditions contained in this Offer-cum-Appointment Letter and its annexure(A&B).
      </p>
      <div style="margin-top: 35px; line-height: 2;">
        <div>Employee Signature: __________________________</div>
        <div>Name: <span class="highlight-param">${candidateName}</span></div>
        <div>Date: __________________________</div>
      </div>
    </div>

    ${renderFooter()}
  </div>

  <!-- PAGE 6 -->
  <div class="page">
    ${renderHeader()}

    <div class="annexure-title">ANNEXURE A — COMPENSATION STRUCTURE</div>

    <table class="salary-table">
      <thead>
        <tr>
          <th class="text-left" style="width: 40%;">Component</th>
          <th class="text-center" style="width: 30%;">Monthly (₹)</th>
          <th class="text-center" style="width: 30%;">Annual (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-left"><strong>Basic Salary</strong></td>
          <td class="text-center">₹ ${breakup.monthlyBasic.toLocaleString("en-IN")}</td>
          <td class="text-center">₹ ${breakup.annualBasic.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td class="text-left"><strong>HRA</strong></td>
          <td class="text-center">₹ ${breakup.monthlyHra.toLocaleString("en-IN")}</td>
          <td class="text-center">₹ ${breakup.annualHra.toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td class="text-left"><strong>Special Allowance</strong></td>
          <td class="text-center">₹ ${breakup.monthlySpecial.toLocaleString("en-IN")}</td>
          <td class="text-center">₹ ${breakup.annualSpecial.toLocaleString("en-IN")}</td>
        </tr>
        <tr class="total-row">
          <td class="text-left"><strong>Total CTC</strong></td>
          <td class="text-center"><strong>₹ ${breakup.monthlyCtc.toLocaleString("en-IN")}</strong></td>
          <td class="text-center"><strong>₹ ${breakup.annualCtc.toLocaleString("en-IN")}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="disclaimer">
      **Applicable statutory and authorised deductions will be made as per prevailing laws.
    </div>

    <div class="annexure-b-title">ANNEXURE B — DOCUMENTS TO BE SUBMITTED</div>

    <ul class="doc-list">
      <li>Identity proof</li>
      <li>Address proof</li>
      <li>PAN</li>
      <li>Aadhaar</li>
      <li>Educational certificates(Highest Degree)</li>
      <li>Previous employment documents (if any)</li>
      <li>Bank account details (Front page of passbook)</li>
      <li>Passport-size photograph</li>
      <li>UAN/PF details, where applicable</li>
    </ul>

    ${renderFooter()}
  </div>

</body>
</html>
  `;
}

export async function generateOfferPdfBuffer(offer, company = {}) {
  const html = await generateOfferLetterHtml(offer, company);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return buffer;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
