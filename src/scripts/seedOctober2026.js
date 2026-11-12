import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const ESTABLISHMENT_ID = 16;
const ESTABLISHMENT_NAME = "Nexora Digital Solutions Pte Ltd";
const COMPANY_ID = 5;
const SHIFT_START = "09:00";
const SHIFT_END = "18:00";

// Employees
const employees = [
  { id: 106, name: "Ethan Tan",    code: "EMP-SIN-001", reportingToId: 110, reportingToName: "Ryan Kumar" },
  { id: 107, name: "Chloe Lim",   code: "EMP-SIN-002", reportingToId: 108, reportingToName: "Daniel Wong" },
  { id: 108, name: "Daniel Wong",  code: "EMP-SIN-003", reportingToId: 109, reportingToName: "Sophia Lee" },
  { id: 109, name: "Sophia Lee",   code: "EMP-SIN-004", reportingToId: 108, reportingToName: "Daniel Wong" },
  { id: 110, name: "Ryan Kumar",   code: "EMP-SIN-005", reportingToId: 106, reportingToName: "Ethan Tan" },
];

// October 2026 working days (Mon-Fri) - using manual date strings to avoid timezone issues
function getWorkingDays(year, month) {
  const days = [];
  const pad = (n) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const dow = new Date(`${dateStr}T12:00:00Z`).getDay(); // use noon UTC to avoid day shift
    if (dow !== 0 && dow !== 6) {
      days.push(dateStr);
    }
  }
  return days;
}

const workingDays = getWorkingDays(2026, 10);
// workingDays: ["2026-10-01", "2026-10-02", "2026-10-05", ...]

// Helper: make a timestamp in IST for a given date and time like "09:15"
function makeIST(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+05:30`;
}

// Helper: add minutes to a time string "HH:MM" -> "HH:MM"
function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// Attendance patterns per employee for variety
// Pattern: [checkInOffset, checkOutOffset] in minutes (positive = late/early leave)
// null means absent
const patterns = {
  106: { absent: [2, 15], halfDay: [9], late: [4, 7, 11, 18, 22], earlyOut: [5, 13] },
  107: { absent: [3, 19], halfDay: [14], late: [1, 8, 12], earlyOut: [6, 20] },
  108: { absent: [6], halfDay: [], late: [3, 10, 17, 24], earlyOut: [8, 15, 22] },
  109: { absent: [4, 21], halfDay: [12], late: [2, 9, 16], earlyOut: [5, 19] },
  110: { absent: [7], halfDay: [17], late: [1, 5, 11, 20, 25], earlyOut: [9, 23] },
};

// Leave days per employee (will be absent in attendance)
const leaveAbsent = {
  107: ["2026-10-07"], // Chloe - Sick Leave (Approved)
  108: ["2026-10-13", "2026-10-14"], // Daniel - Annual Leave (Rejected - still marked absent)
  109: ["2026-10-27", "2026-10-28"], // Sophia - Annual Leave (Approved)
};

async function seedAttendance(client) {
  console.log("\n📅 Seeding Attendance...");
  let count = 0;

  for (const emp of employees) {
    const pat = patterns[emp.id];
    for (let i = 0; i < workingDays.length; i++) {
      const dateStr = workingDays[i];
      const dayNum = i + 1;

      // Check if leave day
      const isLeaveDay = (leaveAbsent[emp.id] || []).includes(dateStr);

      let status, checkIn, checkOut, regularizationStatus, regularizationReason,
          reqCheckIn, reqCheckOut;

      if (isLeaveDay) {
        status = "On Leave";
        checkIn = null; checkOut = null;
      } else if (pat.absent.includes(dayNum)) {
        status = "Absent";
        checkIn = null; checkOut = null;
        // Add regularization for 1 absent day per employee
        if (pat.absent.indexOf(dayNum) === 0) {
          reqCheckIn = makeIST(dateStr, addMinutes(SHIFT_START, 30));
          reqCheckOut = makeIST(dateStr, addMinutes(SHIFT_END, -30));
          regularizationReason = "Forgot to punch in/out";
          regularizationStatus = ["Pending", "Approved", "Rejected"][emp.id % 3];
        }
      } else if (pat.halfDay.includes(dayNum)) {
        status = "Half Day";
        checkIn = makeIST(dateStr, SHIFT_START);
        checkOut = makeIST(dateStr, addMinutes(SHIFT_START, 240)); // 4 hours
      } else if (pat.late.includes(dayNum)) {
        const lateMins = 15 + (dayNum % 4) * 10; // 15, 25, 35, 45 min late
        status = "Present";
        checkIn = makeIST(dateStr, addMinutes(SHIFT_START, lateMins));
        checkOut = makeIST(dateStr, SHIFT_END);
      } else if (pat.earlyOut.includes(dayNum)) {
        const earlyMins = 30 + (dayNum % 3) * 15; // 30, 45, 60 min early
        status = "Present";
        checkIn = makeIST(dateStr, SHIFT_START);
        checkOut = makeIST(dateStr, addMinutes(SHIFT_END, -earlyMins));
      } else {
        // Normal day - slight variation
        const inVariation = (dayNum % 3 === 0) ? 5 : 0;
        const outVariation = (dayNum % 5 === 0) ? 10 : 0;
        status = "Present";
        checkIn = makeIST(dateStr, addMinutes(SHIFT_START, inVariation));
        checkOut = makeIST(dateStr, addMinutes(SHIFT_END, outVariation));
      }

      await client.query(`
        INSERT INTO public.ca_attendance (
          establishment_id, establishment_name, employee_id, employee_name, employee_code,
          date, check_in, check_out, status,
          requested_check_in, requested_check_out,
          regularization_status, regularization_reason,
          created_by_company_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (employee_id, date) DO NOTHING
      `, [
        ESTABLISHMENT_ID, ESTABLISHMENT_NAME, emp.id, emp.name, emp.code,
        dateStr, checkIn, checkOut, status,
        reqCheckIn || null, reqCheckOut || null,
        regularizationStatus || null, regularizationReason || null,
        COMPANY_ID
      ]);
      count++;
    }
  }
  console.log(`✅ Attendance: ${count} records inserted`);
}

async function seedLeaveRequests(client) {
  console.log("\n📋 Seeding Leave Requests...");

  const leaveRequests = [
    // Pending
    {
      emp: employees[0], // Ethan Tan
      leaveTypeId: 294, leaveTypeName: "Annual Leave",
      startDate: "2026-10-20", endDate: "2026-10-21", days: 2,
      reason: "Family vacation", status: "Pending",
      session: "full"
    },
    // Approved
    {
      emp: employees[1], // Chloe Lim
      leaveTypeId: 296, leaveTypeName: "Outpatient Sick Leave",
      startDate: "2026-10-07", endDate: "2026-10-07", days: 1,
      reason: "Fever and cold, doctor visit required", status: "Approved",
      approverName: "Daniel Wong", reviewedByName: "Daniel Wong",
      session: "full"
    },
    // Rejected
    {
      emp: employees[2], // Daniel Wong
      leaveTypeId: 294, leaveTypeName: "Annual Leave",
      startDate: "2026-10-13", endDate: "2026-10-14", days: 2,
      reason: "Personal work", status: "Rejected",
      approverName: "Sophia Lee", reviewedByName: "Sophia Lee",
      rejectReason: "Project deadline - cannot approve during this period",
      session: "full"
    },
    // Approved
    {
      emp: employees[3], // Sophia Lee
      leaveTypeId: 294, leaveTypeName: "Annual Leave",
      startDate: "2026-10-27", endDate: "2026-10-28", days: 2,
      reason: "Annual family trip", status: "Approved",
      approverName: "Daniel Wong", reviewedByName: "Daniel Wong",
      session: "full"
    },
    // Pending
    {
      emp: employees[4], // Ryan Kumar
      leaveTypeId: 296, leaveTypeName: "Outpatient Sick Leave",
      startDate: "2026-10-09", endDate: "2026-10-09", days: 1,
      reason: "Stomach infection - visiting clinic", status: "Pending",
      session: "full"
    },
  ];

  const insertedIds = [];
  for (const lr of leaveRequests) {
    const res = await client.query(`
      INSERT INTO public.ca_leave_requests (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        leave_type_id, leave_type_name, start_date, end_date, days, reason, status,
        approver_name, reviewed_by_name, reject_reason,
        reporting_to_id, session, created_by_company_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING id
    `, [
      ESTABLISHMENT_ID, ESTABLISHMENT_NAME, lr.emp.id, lr.emp.name, lr.emp.code,
      lr.leaveTypeId, lr.leaveTypeName, lr.startDate, lr.endDate, lr.days, lr.reason, lr.status,
      lr.approverName || null, lr.reviewedByName || null, lr.rejectReason || null,
      lr.emp.reportingToId, lr.session, COMPANY_ID
    ]);
    insertedIds.push({ id: res.rows[0].id, emp: lr.emp, lr });
    console.log(`  ✅ ${lr.emp.name} - ${lr.leaveTypeName} (${lr.status})`);
  }
  return insertedIds;
}

async function seedLeaveRevokes(client, leaveRequests) {
  console.log("\n🔄 Seeding Leave Revokes...");

  // Revoke approved leaves: Chloe (Pending revoke), Sophia (Approved revoke)
  const approvedLeaves = leaveRequests.filter(l => l.lr.status === "Approved");

  const revokes = [
    {
      lrData: approvedLeaves[0], // Chloe's approved sick leave
      reason: "Recovered, can come to office", status: "Pending",
    },
    {
      lrData: approvedLeaves[1], // Sophia's approved annual leave
      reason: "Trip cancelled, available for work", status: "Approved",
      approverName: "Daniel Wong", reviewedByName: "Daniel Wong"
    },
  ];

  for (const rv of revokes) {
    const lrd = rv.lrData;
    await client.query(`
      INSERT INTO public.ca_leave_revokes (
        leave_request_id, establishment_id, establishment_name,
        employee_id, employee_name, employee_code,
        leave_type_id, leave_type_name, start_date, end_date, days,
        reason, status, approver_name, reviewed_by_name, reject_reason,
        reporting_to_id, session, created_by_company_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    `, [
      lrd.id, ESTABLISHMENT_ID, ESTABLISHMENT_NAME,
      lrd.emp.id, lrd.emp.name, lrd.emp.code,
      lrd.lr.leaveTypeId, lrd.lr.leaveTypeName, lrd.lr.startDate, lrd.lr.endDate, lrd.lr.days,
      rv.reason, rv.status, rv.approverName || null, rv.reviewedByName || null, null,
      lrd.emp.reportingToId, "full", COMPANY_ID
    ]);
    console.log(`  ✅ ${lrd.emp.name} - Revoke (${rv.status})`);
  }
}

async function seedOTRequests(client) {
  console.log("\n⏰ Seeding OT Requests...");

  const otRequests = [
    {
      emp: employees[0], // Ethan Tan
      date: "2026-10-02", hours: 2, mins: 120,
      checkIn: makeIST("2026-10-02", "09:00"),
      checkOut: makeIST("2026-10-02", "20:00"),
      workHours: 9, totalHours: "11:00",
      reason: "Client deliverable deadline", status: "Pending",
      type: "Weekday Ot"
    },
    {
      emp: employees[1], // Chloe Lim - Approved
      date: "2026-10-09", hours: 1.5, mins: 90,
      checkIn: makeIST("2026-10-09", "09:00"),
      checkOut: makeIST("2026-10-09", "19:30"),
      workHours: 9, totalHours: "10:30",
      reason: "Sprint release preparation", status: "Approved",
      approverName: "Daniel Wong", reviewedByName: "Daniel Wong",
      type: "Weekday Ot"
    },
    {
      emp: employees[2], // Daniel Wong - Rejected
      date: "2026-10-15", hours: 2, mins: 120,
      checkIn: makeIST("2026-10-15", "09:00"),
      checkOut: makeIST("2026-10-15", "20:00"),
      workHours: 9, totalHours: "11:00",
      reason: "Database migration work", status: "Rejected",
      approverName: "Sophia Lee", reviewedByName: "Sophia Lee",
      rejectReason: "OT not pre-approved for this task",
      type: "Weekday Ot"
    },
    {
      emp: employees[3], // Sophia Lee - Approved
      date: "2026-10-22", hours: 3, mins: 180,
      checkIn: makeIST("2026-10-22", "09:00"),
      checkOut: makeIST("2026-10-22", "21:00"),
      workHours: 9, totalHours: "12:00",
      reason: "Month-end payroll processing", status: "Approved",
      approverName: "Daniel Wong", reviewedByName: "Daniel Wong",
      type: "Weekday Ot"
    },
    {
      emp: employees[4], // Ryan Kumar - Pending
      date: "2026-10-29", hours: 1, mins: 60,
      checkIn: makeIST("2026-10-29", "09:00"),
      checkOut: makeIST("2026-10-29", "19:00"),
      workHours: 9, totalHours: "10:00",
      reason: "Client support ticket resolution", status: "Pending",
      type: "Weekday Ot"
    },
    // Weekend OT - Ethan (Approved)
    {
      emp: employees[0], // Ethan Tan - Weekend OT
      date: "2026-10-04", hours: 4, mins: 240,
      checkIn: makeIST("2026-10-04", "10:00"),
      checkOut: makeIST("2026-10-04", "14:00"),
      workHours: 0, totalHours: "04:00",
      reason: "Weekend server deployment", status: "Approved",
      approverName: "Ryan Kumar", reviewedByName: "Ryan Kumar",
      type: "Weekend Ot"
    },
    // Weekend OT - Ryan (Pending)
    {
      emp: employees[4], // Ryan Kumar - Weekend OT
      date: "2026-10-11", hours: 3, mins: 180,
      checkIn: makeIST("2026-10-11", "11:00"),
      checkOut: makeIST("2026-10-11", "14:00"),
      workHours: 0, totalHours: "03:00",
      reason: "Emergency system fix", status: "Pending",
      type: "Weekend Ot"
    },
  ];

  for (const ot of otRequests) {
    await client.query(`
      INSERT INTO public.ca_ot_requests (
        establishment_id, establishment_name, employee_id, employee_name, employee_code,
        date, work_date, total_working_hours, ot_hours, ot_minutes,
        hours, worked_ot_hours, work_hours,
        reason, reject_reason, type, status,
        reporting_to_id, approver_name, reviewed_by_name,
        source, created_by_company_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    `, [
      ESTABLISHMENT_ID, ESTABLISHMENT_NAME, ot.emp.id, ot.emp.name, ot.emp.code,
      ot.date, ot.date, ot.totalHours, String(ot.hours), ot.mins,
      ot.hours, ot.hours, ot.workHours,
      ot.reason, ot.rejectReason || null, ot.type, ot.status,
      ot.emp.reportingToId, ot.approverName || null, ot.reviewedByName || null,
      "manual", COMPANY_ID
    ]);
    console.log(`  ✅ ${ot.emp.name} - OT ${ot.hours}hrs on ${ot.date} (${ot.status})`);
  }
}

// MAIN
const client = await db.connect();
try {
  console.log("🚀 Starting October 2026 Seed Data...");
  console.log(`📆 Working days: ${workingDays.length} days (${workingDays[0]} to ${workingDays[workingDays.length-1]})`);

  await client.query("BEGIN");

  await seedAttendance(client);
  const insertedLeaves = await seedLeaveRequests(client);
  await seedLeaveRevokes(client, insertedLeaves);
  await seedOTRequests(client);

  await client.query("COMMIT");
  console.log("\n🎉 All seed data inserted successfully!");

} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ Error:", err.message);
  console.error(err.stack);
} finally {
  client.release();
  await db.end();
}
