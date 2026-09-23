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
      
      let gross = monthlyCTC; // Default if basic pay component not defined
      let totalAdditions = 0;
      let totalDeductions = 0;

      const appliedComponents = [];

      for (const comp of components) {
        // Condition: eligibility max salary limit (check against monthly CTC)
        if (comp.conditionMaxSalary > 0 && monthlyCTC > comp.conditionMaxSalary) {
          continue; // Skip this component
        }


        let amount = 0;
        if (comp.calculationType === "Fixed Amount") {
          amount = comp.fixedAmount;
        } else {
          // Find base amount depending on depends_on
          let baseAmount = monthlyCTC;
          if (comp.dependsOn && comp.dependsOn !== 'CTC') {
             // We stored the ID of the component in dependsOn
             const parentComp = appliedComponents.find(c => String(c.id) === String(comp.dependsOn));
             if (parentComp) {
                baseAmount = parentComp.amount;
             } else {
                baseAmount = 0; // If parent not found or not eligible, amount is 0
             }
          }
          amount = (baseAmount * comp.percentage) / 100;
        }

        // Cap limit
        if (comp.maxCapAmount > 0 && amount > comp.maxCapAmount) {
          amount = comp.maxCapAmount;
        }

        if (amount > 0) {
          appliedComponents.push({
            id: comp.id,
            name: comp.name,
            amount: amount,
            type: comp.ctcImpact
          });

          if (comp.ctcImpact === "Add") {
            totalAdditions += amount;
          } else {
            totalDeductions += amount;
          }
        }
      }

      // If basic is already part of components, we adjust it
      if (appliedComponents.some(c => c.name.toLowerCase().includes('basic'))) {
         gross = totalAdditions; // Use component driven gross
      } else {
         gross += totalAdditions; // Base + allowances
      }

      const net = gross - totalDeductions;

      return {
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name || ''}`.trim(),
        employeeType: emp.employee_type,
        grossPay: gross,
        deductions: totalDeductions,
        netPay: net,
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
                    <tr style="background-color: #f8fafc;">
                      <td style="padding: 15px 10px; font-weight: bold; color: #16a34a; font-size: 16px;">Net Pay</td>
                      <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #16a34a; font-size: 16px;">Rs. ${Math.round(empData.netPay).toLocaleString()}</td>
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
