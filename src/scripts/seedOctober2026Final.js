import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { zonedDateTimeToUtc } from "../core/utils/timezone.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// 1. Establishments & Employees (All UTC+8: Asia/Singapore & Asia/Kuala_Lumpur)
const establishments = [
  {
    id: 16,
    name: "Nexora Digital Solutions Pte Ltd",
    zone: "Asia/Singapore",
    companyId: 5,
    employees: [
      { id: 106, name: "Ethan Tan",   code: "EMP-SIN-001", reportingToId: 110, reportingToName: "Ryan Kumar" },
      { id: 107, name: "Chloe Lim",  code: "EMP-SIN-002", reportingToId: 108, reportingToName: "Daniel Wong" },
      { id: 108, name: "Daniel Wong", code: "EMP-SIN-003", reportingToId: 109, reportingToName: "Sophia Lee" },
      { id: 109, name: "Sophia Lee",  code: "EMP-SIN-004", reportingToId: 108, reportingToName: "Daniel Wong" },
      { id: 110, name: "Ryan Kumar",  code: "EMP-SIN-005", reportingToId: 106, reportingToName: "Ethan Tan" },
    ]
  },
  {
    id: 17,
    name: "Nexora Digital Sdn. Bhd.",
    zone: "Asia/Kuala_Lumpur",
    companyId: 5,
    employees: [
      { id: 111, name: "Muhammad Amir", code: "EMP-MY-001", reportingToId: 115, reportingToName: "Arjun Raj" },
      { id: 112, name: "Nur Aisyah",    code: "EMP-MY-002", reportingToId: 113, reportingToName: "Lim Wei Jian" },
      { id: 113, name: "Lim Wei Jian",  code: "EMP-MY-003", reportingToId: 112, reportingToName: "Nur Aisyah" },
      { id: 114, name: "Siti Farah",    code: "EMP-MY-004", reportingToId: 113, reportingToName: "Lim Wei Jian" },
      { id: 115, name: "Arjun Raj",     code: "EMP-MY-005", reportingToId: 111, reportingToName: "Muhammad Amir" },
    ]
  }
];

// October 2026 Working Days (Mon-Fri) -> 22 days: Oct 1 to Oct 30
function getOctoberWorkingDays() {
  const days = [];
  const pad = (n) => String(n).padStart(2, "0");
  for (let d = 1; d <= 31; d++) {
    const dateStr = `2026-10-${pad(d)}`;
    const dateObj = new Date(`${dateStr}T12:00:00Z`);
    const dow = dateObj.getUTCDay();
    if (dow !== 0 && dow !== 6) { // Skip Sat/Sun
      days.push(dateStr);
    }
  }
  return days;
}

const workingDays = getOctoberWorkingDays();

async function runSeed() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    console.log("🚀 Starting Complete October 2026 Seed (ONLY Approved & Rejected, NO Pending)...\n");

    // Clean previous
    await client.query("DELETE FROM public.ca_leave_revokes;");
    await client.query("DELETE FROM public.ca_ot_requests;");
    await client.query("DELETE FROM public.ca_leave_requests;");
    await client.query("DELETE FROM public.ca_attendance;");

    let totalAttendance = 0;
    let totalLeaves = 0;
    let totalRevokes = 0;
    let totalOt = 0;

    for (const est of establishments) {
      console.log(`\n======================================================`);
      console.log(`🏢 Processing: ${est.name} (${est.zone})`);
      console.log(`======================================================`);

      for (let empIdx = 0; empIdx < est.employees.length; empIdx++) {
        const emp = est.employees[empIdx];
        
        // Designated days for scenarios for this employee:
        // Day 2 (Oct 2): Late Check-in
        // Day 5 (Oct 7): Approved Sick Leave
        // Day 8 (Oct 12): Absent with Regularization Approved
        // Day 11 (Oct 15): Absent with Regularization Rejected
        // Day 14 (Oct 20): Pure Absent / LOP (No Punch, No Regularization)
        // Day 17 (Oct 23): Half Day
        // Day 20 (Oct 28): Early Check-out

        for (let dayIdx = 0; dayIdx < workingDays.length; dayIdx++) {
          const dateStr = workingDays[dayIdx];
          const dayNum = dayIdx + 1;

          let status = "Present";
          let checkIn = null;
          let checkOut = null;
          let reqIn = null;
          let reqOut = null;
          let regStatus = null;
          let regReason = null;
          let regReviewedBy = null;

          if (dayNum === 5) {
            // On Leave (Sick Leave)
            status = "On Leave";
          } else if (dayNum === 8) {
            // Absent with Approved Regularization
            status = "Absent";
            reqIn = zonedDateTimeToUtc(dateStr, "09:30", est.zone);
            reqOut = zonedDateTimeToUtc(dateStr, "18:30", est.zone);
            regStatus = "Approved";
            regReason = "Biometric machine offline during morning entry";
            regReviewedBy = emp.reportingToName;
          } else if (dayNum === 11) {
            // Absent with Rejected Regularization
            status = "Absent";
            reqIn = zonedDateTimeToUtc(dateStr, "09:30", est.zone);
            reqOut = zonedDateTimeToUtc(dateStr, "18:30", est.zone);
            regStatus = "Rejected";
            regReason = "Forgot to check-in";
            regReviewedBy = emp.reportingToName;
          } else if (dayNum === 14) {
            // Pure Absent / LOP (Loss of Pay)
            status = "Absent";
          } else if (dayNum === 17) {
            // Half Day (09:30 - 13:30)
            status = "Half Day";
            checkIn = zonedDateTimeToUtc(dateStr, "09:30", est.zone);
            checkOut = zonedDateTimeToUtc(dateStr, "13:30", est.zone);
          } else if (dayNum === 2) {
            // Late Check-in (10:15 AM - 18:30 PM)
            status = "Present";
            checkIn = zonedDateTimeToUtc(dateStr, "10:15", est.zone);
            checkOut = zonedDateTimeToUtc(dateStr, "18:30", est.zone);
          } else if (dayNum === 20) {
            // Early Check-out (09:30 AM - 17:30 PM)
            status = "Present";
            checkIn = zonedDateTimeToUtc(dateStr, "09:30", est.zone);
            checkOut = zonedDateTimeToUtc(dateStr, "17:30", est.zone);
          } else {
            // Normal on-time Present (09:30 AM - 18:30 PM)
            status = "Present";
            checkIn = zonedDateTimeToUtc(dateStr, "09:30", est.zone);
            checkOut = zonedDateTimeToUtc(dateStr, "18:30", est.zone);
          }

          await client.query(`
            INSERT INTO public.ca_attendance (
              establishment_id, establishment_name, employee_id, employee_name, employee_code,
              date, check_in, check_out, status,
              requested_check_in, requested_check_out,
              regularization_status, regularization_reason, regularization_reviewed_by,
              created_by_company_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          `, [
            est.id, est.name, emp.id, emp.name, emp.code,
            dateStr, checkIn, checkOut, status,
            reqIn, reqOut,
            regStatus, regReason, regReviewedBy,
            est.companyId
          ]);
          totalAttendance++;
        }

        // Leave Requests for this Employee (1 Approved, 1 Rejected)
        // 1. Approved Sick Leave (Oct 07)
        const leaveAppRes = await client.query(`
          INSERT INTO public.ca_leave_requests (
            establishment_id, establishment_name, employee_id, employee_name, employee_code,
            leave_type_id, leave_type_name, start_date, end_date, days,
            reason, status, approver_name, reviewed_by_name, reporting_to_id,
            session, created_by_company_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          RETURNING id
        `, [
          est.id, est.name, emp.id, emp.name, emp.code,
          296, "Outpatient Sick Leave", "2026-10-07", "2026-10-07", 1,
          "Severe migraine and doctor consultation", "Approved", emp.reportingToName, emp.reportingToName, emp.reportingToId,
          "full", est.companyId
        ]);
        totalLeaves++;

        // 2. Rejected Annual Leave (Oct 26 - Oct 27)
        await client.query(`
          INSERT INTO public.ca_leave_requests (
            establishment_id, establishment_name, employee_id, employee_name, employee_code,
            leave_type_id, leave_type_name, start_date, end_date, days,
            reason, status, approver_name, reviewed_by_name, reject_reason, reporting_to_id,
            session, created_by_company_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        `, [
          est.id, est.name, emp.id, emp.name, emp.code,
          294, "Annual Leave", "2026-10-26", "2026-10-27", 2,
          "Personal family function trip", "Rejected", emp.reportingToName, emp.reportingToName,
          "Critical product release deadline during that week. Please reschedule.", emp.reportingToId,
          "full", est.companyId
        ]);
        totalLeaves++;

        // 3. Leave Revoke Requests:
        // For employee #1 & #3 in establishment: Approved Revoke
        // For employee #2 in establishment: Rejected Revoke
        if (empIdx === 0 || empIdx === 2) {
          await client.query(`
            INSERT INTO public.ca_leave_revokes (
              leave_request_id, establishment_id, establishment_name,
              employee_id, employee_name, employee_code,
              leave_type_id, leave_type_name, start_date, end_date, days,
              reason, status, approver_name, reviewed_by_name,
              reporting_to_id, session, created_by_company_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          `, [
            leaveAppRes.rows[0].id, est.id, est.name,
            emp.id, emp.name, emp.code,
            296, "Outpatient Sick Leave", "2026-10-07", "2026-10-07", 1,
            "Doctor gave fitness clearance earlier than expected, attending office.",
            "Approved", emp.reportingToName, emp.reportingToName,
            emp.reportingToId, "full", est.companyId
          ]);
          totalRevokes++;
        } else if (empIdx === 1) {
          await client.query(`
            INSERT INTO public.ca_leave_revokes (
              leave_request_id, establishment_id, establishment_name,
              employee_id, employee_name, employee_code,
              leave_type_id, leave_type_name, start_date, end_date, days,
              reason, reject_reason, status, approver_name, reviewed_by_name,
              reporting_to_id, session, created_by_company_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          `, [
            leaveAppRes.rows[0].id, est.id, est.name,
            emp.id, emp.name, emp.code,
            296, "Outpatient Sick Leave", "2026-10-07", "2026-10-07", 1,
            "Want to cancel leave and work half day.",
            "Duty roster already adjusted with backup staff; take complete rest.",
            "Rejected", emp.reportingToName, emp.reportingToName,
            emp.reportingToId, "full", est.companyId
          ]);
          totalRevokes++;
        }

        // 4. OT Requests for each employee:
        // OT 1: Approved Weekday OT (Oct 16 - 2.0 hrs)
        await client.query(`
          INSERT INTO public.ca_ot_requests (
            establishment_id, establishment_name, employee_id, employee_name, employee_code,
            date, work_date, total_working_hours, ot_hours, ot_minutes,
            hours, worked_ot_hours, work_hours,
            reason, type, status, reporting_to_id, approver_name, reviewed_by_name,
            source, created_by_company_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        `, [
          est.id, est.name, emp.id, emp.name, emp.code,
          "2026-10-16", "2026-10-16", "11:00", "2.0", 120,
          2.0, 2.0, 9.0,
          "Completed sprint testing and production patch deployment", "Weekday Ot",
          "Approved", emp.reportingToId, emp.reportingToName, emp.reportingToName,
          "manual", est.companyId
        ]);
        totalOt++;

        // OT 2: Rejected Weekday OT (Oct 21 - 1.5 hrs)
        await client.query(`
          INSERT INTO public.ca_ot_requests (
            establishment_id, establishment_name, employee_id, employee_name, employee_code,
            date, work_date, total_working_hours, ot_hours, ot_minutes,
            hours, worked_ot_hours, work_hours,
            reason, reject_reason, type, status, reporting_to_id, approver_name, reviewed_by_name,
            source, created_by_company_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        `, [
          est.id, est.name, emp.id, emp.name, emp.code,
          "2026-10-21", "2026-10-21", "10:30", "1.5", 90,
          1.5, 1.5, 9.0,
          "General backlog clearance",
          "Non-critical activity without prior written authorization.", "Weekday Ot",
          "Rejected", emp.reportingToId, emp.reportingToName, emp.reportingToName,
          "manual", est.companyId
        ]);
        totalOt++;

        // OT 3: Approved Sunday / Weekend OT (Oct 18 - 4.0 hrs)
        await client.query(`
          INSERT INTO public.ca_ot_requests (
            establishment_id, establishment_name, employee_id, employee_name, employee_code,
            date, work_date, total_working_hours, ot_hours, ot_minutes,
            hours, worked_ot_hours, work_hours,
            reason, type, status, reporting_to_id, approver_name, reviewed_by_name,
            source, created_by_company_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        `, [
          est.id, est.name, emp.id, emp.name, emp.code,
          "2026-10-18", "2026-10-18", "04:00", "4.0", 240,
          4.0, 4.0, 0,
          "Sunday emergency database maintenance and DR drills", "Weekend Ot",
          "Approved", emp.reportingToId, emp.reportingToName, emp.reportingToName,
          "manual", est.companyId
        ]);
        totalOt++;
      }
    }

    await client.query("COMMIT");

    console.log("\n======================================================");
    console.log("🎉 OCTOBER 2026 SEED COMPLETED SUCCESSFULLY!");
    console.log("======================================================");
    console.log(`📅 Attendance Records Created: ${totalAttendance}`);
    console.log(`📋 Leave Requests Created:    ${totalLeaves} (All Approved or Rejected)`);
    console.log(`🔄 Leave Revokes Created:     ${totalRevokes} (All Approved or Rejected)`);
    console.log(`⏰ OT Requests Created:        ${totalOt} (All Approved or Rejected)`);
    console.log(`🚫 Pending Count:              0 (ZERO Pending Records)`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed Failed:", err);
  } finally {
    client.release();
    await db.end();
  }
}

runSeed();

