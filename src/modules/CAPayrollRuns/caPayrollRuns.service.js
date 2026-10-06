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
        const subject = `Payslip for ${monthYear} - ${estName}`;

        let earningsHtml = "";
        let deductionsHtml = "";
        
        if (p.breakdown && p.breakdown.components) {
          Object.entries(p.breakdown.components).forEach(([name, amount]) => {
            earningsHtml += `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #334155; font-size: 14px;">${name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #0f172a; font-size: 14px; text-align: right; font-weight: 500;">&#8377; ${Math.round(amount).toLocaleString("en-IN")}</td>
              </tr>
            `;
          });
        }

        if (p.breakdown && p.breakdown.statutory) {
          Object.entries(p.breakdown.statutory).forEach(([name, amount]) => {
            deductionsHtml += `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #334155; font-size: 14px;">${name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #ef4444; font-size: 14px; text-align: right; font-weight: 500;">&#8377; ${Math.round(amount).toLocaleString("en-IN")}</td>
              </tr>
            `;
          });
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
              .header img { max-height: 40px; margin-bottom: 10px; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
              .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
              .content { padding: 40px; }
              .greeting { font-size: 16px; color: #334155; margin-bottom: 30px; line-height: 1.5; }
              .summary-box { background: linear-gradient(145deg, #f0f9ff, #e0f2fe); border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: center; }
              .summary-box .label { font-size: 12px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
              .summary-box .amount { font-size: 32px; font-weight: 800; color: #0c2340; margin: 0; }
              .details-grid { display: flex; flex-direction: column; gap: 30px; margin-bottom: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { text-align: left; padding: 12px 10px; background-color: #f1f5f9; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
              .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                ${logoUrlForHtml ? `<img src="${logoUrlForHtml}" alt="Logo" />` : ''}
                <h1>${estName}</h1>
                <p>Payslip for ${monthYear}</p>
              </div>
              <div class="content">
                <div class="greeting">
                  <strong>Dear ${p.employeeName},</strong><br/><br/>
                  Please find below the summary of your payroll for <strong>${monthYear}</strong>. 
                  Your salary has been processed successfully.
                </div>
                
                <div class="summary-box">
                  <div class="label">Net In-Hand Salary</div>
                  <div class="amount">&#8377; ${Math.round(p.netPay).toLocaleString("en-IN")}</div>
                </div>

                <div class="details-grid">
                  <div>
                    <h3 style="margin: 0 0 10px 0; color: #0c2340; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Earnings</h3>
                    <table>
                      <tr><th>Component</th><th style="text-align:right;">Amount</th></tr>
                      ${earningsHtml}
                      <tr>
                        <td style="padding: 12px 10px; border-top: 2px solid #e2e8f0; color: #0c2340; font-weight: bold; font-size: 14px;">Gross Pay</td>
                        <td style="padding: 12px 10px; border-top: 2px solid #e2e8f0; color: #0c2340; font-weight: bold; font-size: 14px; text-align: right;">&#8377; ${Math.round(p.grossPay).toLocaleString("en-IN")}</td>
                      </tr>
                    </table>
                  </div>

                  <div>
                    <h3 style="margin: 0 0 10px 0; color: #0c2340; font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Deductions</h3>
                    <table>
                      <tr><th>Component</th><th style="text-align:right;">Amount</th></tr>
                      ${deductionsHtml || `<tr><td colspan="2" style="padding: 10px; text-align: center; color: #94a3b8; font-size: 14px;">No deductions</td></tr>`}
                      <tr>
                        <td style="padding: 12px 10px; border-top: 2px solid #e2e8f0; color: #0c2340; font-weight: bold; font-size: 14px;">Total Deductions</td>
                        <td style="padding: 12px 10px; border-top: 2px solid #e2e8f0; color: #ef4444; font-weight: bold; font-size: 14px; text-align: right;">&#8377; ${Math.round(p.deductions).toLocaleString("en-IN")}</td>
                      </tr>
                    </table>
                  </div>
                </div>
                
                <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 40px; font-style: italic;">
                  This is a computer-generated payslip and does not require a physical signature.
                </p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} ${estName}. All rights reserved.<br/>
                Powered by iComply HR
              </div>
            </div>
          </body>
          </html>
        `;

        const pdfHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; background: white; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #0c2340; padding-bottom: 20px; }
              .logo { max-height: 50px; }
              .company-info { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }
              .company-info h1 { margin: 0; color: #0c2340; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
              .title-strip { background-color: #0c2340; color: white; text-align: center; padding: 12px; font-weight: bold; letter-spacing: 2px; font-size: 14px; margin-bottom: 30px; text-transform: uppercase; }
              
              .emp-grid { display: flex; gap: 20px; margin-bottom: 30px; }
              .emp-col { flex: 1; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
              .emp-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; }
              .emp-row:last-child { margin-bottom: 0; }
              .label { color: #64748b; font-weight: 600; }
              .value { color: #0f172a; font-weight: 700; text-align: right; }

              .salary-container { display: flex; gap: 20px; margin-bottom: 30px; }
              .salary-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
              .box-title { background: #0c2340; color: white; padding: 12px 15px; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
              .box-title.deduct { background: #be123c; }
              .s-table { width: 100%; border-collapse: collapse; }
              .s-table td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
              .s-table tr:nth-child(even) { background: #f8fafc; }
              .s-table .amt { text-align: right; font-weight: 600; }
              .s-total { background: #f1f5f9; font-weight: 800; }
              
              .net-pay-section { display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; border: 1px solid #10b981; padding: 20px 30px; border-radius: 8px; margin-bottom: 40px; }
              .net-label { font-size: 14px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 1px; }
              .net-words { font-size: 12px; color: #047857; margin-top: 5px; }
              .net-amount { font-size: 32px; font-weight: 900; color: #065f46; }

              .footer { text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px dashed #cbd5e1; padding-top: 20px; }
              .signature-area { margin-top: 50px; text-align: right; margin-bottom: 20px; }
              .signature-area div { display: inline-block; text-align: center; }
              .signature-area .line { border-top: 1px solid #000; width: 150px; margin-bottom: 5px; }
              .signature-area .role { font-size: 11px; color: #64748b; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoUrlForHtml ? `<img src="${logoUrlForHtml}" class="logo" />` : '<div style="width: 50px;"></div>'}
              <div class="company-info">
                <h1>${estName}</h1>
                <div>Payslip generated through iComply HR</div>
              </div>
            </div>

            <div class="title-strip">Payslip for the month of ${monthYear}</div>

            <div class="emp-grid">
              <div class="emp-col">
                <div class="emp-row"><span class="label">Employee Name</span><span class="value">${p.employeeName}</span></div>
                <div class="emp-row"><span class="label">Employee ID</span><span class="value">${p.employeeCode || p.employeeId}</span></div>
                <div class="emp-row"><span class="label">Designation</span><span class="value">${emp.designationName || '-'}</span></div>
                <div class="emp-row"><span class="label">Date of Joining</span><span class="value">${emp.details?.dateOfJoining || '-'}</span></div>
              </div>
              <div class="emp-col">
                <div class="emp-row"><span class="label">UAN Number</span><span class="value">${emp.details?.uan || '-'}</span></div>
                <div class="emp-row"><span class="label">PF Number</span><span class="value">${emp.details?.pfNumber || '-'}</span></div>
                <div class="emp-row"><span class="label">PAN Number</span><span class="value">${emp.details?.panNumber || '-'}</span></div>
                <div class="emp-row"><span class="label">Bank A/C</span><span class="value">${emp.details?.bankAccountNumber || '-'}</span></div>
              </div>
            </div>

            <div class="salary-container">
              <!-- Earnings -->
              <div class="salary-box">
                <div class="box-title">Earnings</div>
                <table class="s-table">
                  ${p.breakdown && p.breakdown.components ? Object.entries(p.breakdown.components).map(([k,v]) => `<tr><td>${k}</td><td class="amt">&#8377; ${Math.round(v).toLocaleString("en-IN")}</td></tr>`).join('') : ''}
                  <tr class="s-total"><td>Gross Earnings</td><td class="amt">&#8377; ${Math.round(p.grossPay).toLocaleString("en-IN")}</td></tr>
                </table>
              </div>

              <!-- Deductions -->
              <div class="salary-box">
                <div class="box-title deduct">Deductions</div>
                <table class="s-table">
                  ${p.breakdown && p.breakdown.statutory ? Object.entries(p.breakdown.statutory).map(([k,v]) => `<tr><td>${k}</td><td class="amt">&#8377; ${Math.round(v).toLocaleString("en-IN")}</td></tr>`).join('') : '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">No Deductions</td></tr>'}
                  <tr class="s-total"><td>Total Deductions</td><td class="amt" style="color:#be123c;">&#8377; ${Math.round(p.deductions).toLocaleString("en-IN")}</td></tr>
                </table>
              </div>
            </div>

            <div class="net-pay-section">
              <div>
                <div class="net-label">Net In-Hand Salary</div>
                <div class="net-words">Rupees ${numberToWords(Math.round(p.netPay))}</div>
              </div>
              <div class="net-amount">&#8377; ${Math.round(p.netPay).toLocaleString("en-IN")}</div>
            </div>

            <div class="signature-area">
              <div>
                <div class="line"></div>
                <div class="role">Authorized Signatory</div>
              </div>
            </div>

            <div class="footer">
              This is a computer-generated document and does not require a signature.
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
