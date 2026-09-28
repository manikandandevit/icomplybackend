import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit-table";
import nodemailer from "nodemailer";
import { AppError } from "../../core/errors/AppError.js";
import { config } from "../../config/index.js";
import { caPayrollRunsRepository } from "./caPayrollRuns.repository.js";
import { caPayrollMasterRepository } from "../CAPayrollMaster/caPayrollMaster.repository.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";

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

    // Fetch active employees for establishment
    const employees = await caPayrollRunsRepository.getEmployeesForPayroll(companyId, establishmentId);
    
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
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        employeeType: emp.employee_type,
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
  }
};
