import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit-table";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import { AppError } from "../../core/errors/AppError.js";
import { config } from "../../config/index.js";
import { caPayrollRunsRepository } from "./caPayrollRuns.repository.js";
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

        const maxRows = Math.max(earningsList.length, deductionsList.length, 1);

        let tableRowsHtml = "";
        for (let i = 0; i < maxRows; i++) {
          const earn = earningsList[i];
          const ded = deductionsList[i];
          tableRowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 12px; color: #334155; font-size: 12px;">${earn ? earn.name : ""}</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #0f172a; font-size: 12px; border-right: 1px solid #cbd5e1;">${earn ? "&#8377; " + Math.round(earn.amount).toLocaleString("en-IN") : ""}</td>
              <td style="padding: 8px 12px; color: #334155; font-size: 12px;">${ded ? ded.name : ""}</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #dc2626; font-size: 12px;">${ded ? "-&#8377; " + Math.round(ded.amount).toLocaleString("en-IN") : ""}</td>
            </tr>
          `;
        }

        // Clean Official PDF Template (Exact match with frontend View sheet)
        const pdfHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: white; margin: 0; }
              .header { border-bottom: 1px solid #cbd5e1; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
              .header-title h1 { margin: 0; font-size: 18px; color: #0c2340; font-weight: 700; }
              .header-title p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500; }
              .header img { max-height: 40px; }
              
              .info-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 20px; font-size: 12px; }
              .info-table td { padding: 8px 12px; border: 1px solid #cbd5e1; }
              .info-label { background-color: #f8fafc; color: #64748b; font-weight: 500; width: 25%; }
              .info-val { color: #0f172a; font-weight: 600; width: 25%; }

              .salary-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 20px; }
              .salary-table th { background-color: #f8fafc; color: #0c2340; font-weight: 700; font-size: 12px; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; }
              .salary-table tfoot td { background-color: #f8fafc; border-top: 1px solid #cbd5e1; font-weight: 700; font-size: 12px; padding: 8px 12px; }
              
              .net-bar { border: 1px solid #cbd5e1; background-color: #f8fafc; border-radius: 4px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
              .net-label { font-size: 11px; font-weight: 700; color: #0c2340; text-transform: uppercase; }
              .net-words { font-size: 11.5px; color: #475569; font-style: italic; margin-top: 2px; }
              .net-amt { font-size: 18px; font-weight: 700; color: #047857; text-align: right; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="header-title">
                <h1>${estName}</h1>
                <p>Payslip for ${monthYear}</p>
              </div>
              ${logoUrlForHtml ? `<img src="${logoUrlForHtml}" alt="Logo" />` : ""}
            </div>

            <table class="info-table">
              <tr>
                <td class="info-label">Employee Name</td>
                <td class="info-val">${p.employeeName}</td>
                <td class="info-label">Employee Code</td>
                <td class="info-val">${p.employeeCode || emp.employeeCode || "-"}</td>
              </tr>
              <tr>
                <td class="info-label">Designation</td>
                <td class="info-val">${emp.designationName || "-"}</td>
                <td class="info-label">Monthly CTC</td>
                <td class="info-val">&#8377; ${Math.round(p.ctc || 0).toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td class="info-label">Working / Present</td>
                <td class="info-val">${p.breakdown?.workingDays || 30} / ${p.breakdown?.daysPresent || 0} Days</td>
                <td class="info-label">Payable Days</td>
                <td class="info-val">${p.breakdown?.payableDays || p.breakdown?.daysPresent || 0} Days</td>
              </tr>
            </table>

            <table class="salary-table">
              <thead>
                <tr>
                  <th style="text-align: left; width: 40%;">Earnings</th>
                  <th style="text-align: right; width: 15%; border-right: 1px solid #cbd5e1;">Amount</th>
                  <th style="text-align: left; width: 30%;">Deductions</th>
                  <th style="text-align: right; width: 15%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td style="color: #0c2340;">Gross Earnings</td>
                  <td style="text-align: right; border-right: 1px solid #cbd5e1; color: #0c2340;">&#8377; ${Math.round(p.grossPay).toLocaleString("en-IN")}</td>
                  <td style="color: #be123c;">Total Deductions</td>
                  <td style="text-align: right; color: #be123c;">-&#8377; ${Math.round(p.deductions).toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>

            <div class="net-bar">
              <div>
                <div class="net-label">Net Salary</div>
                <div class="net-words">Rupees ${numberToWords(Math.round(p.netPay))}</div>
              </div>
              <div class="net-amt">&#8377; ${Math.round(p.netPay).toLocaleString("en-IN")}</div>
            </div>
          </body>
          </html>
        `;

        let pdfBuffer;
        try {
          const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          const page = await browser.newPage();
          await page.setContent(pdfHtml, { waitUntil: 'networkidle0' });
          pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
          await browser.close();
        } catch (err) {
          console.error("Puppeteer PDF generation failed:", err);
          throw new Error("PDF generation failed");
        }

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
  }
};
