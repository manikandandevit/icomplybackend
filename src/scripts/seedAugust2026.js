import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const ESTABLISHMENT_ID = 17;
const ESTABLISHMENT_NAME = "Nexora Digital Sdn. Bhd.";
const COMPANY_ID = 5;
const SHIFT_START = "09:00";
const SHIFT_END = "18:00";

// Employees for Nexora Digital Sdn. Bhd.
const employees = [
  { id: 111, name: "Muhammad Amir", code: "EMP-MY-001", reportingToId: 115, reportingToName: "Arjun Raj" },
  { id: 112, name: "Nur Aisyah",    code: "EMP-MY-002", reportingToId: 113, reportingToName: "Lim Wei Jian" },
  { id: 113, name: "Lim Wei Jian",  code: "EMP-MY-003", reportingToId: 112, reportingToName: "Nur Aisyah" },
  { id: 114, name: "Siti Farah",    code: "EMP-MY-004", reportingToId: 113, reportingToName: "Lim Wei Jian" },
  { id: 115, name: "Arjun Raj",     code: "EMP-MY-005", reportingToId: 111, reportingToName: "Muhammad Amir" },
];

// August 2026 working days (Mon-Fri)
function getWorkingDays(year, month) {
  const days = [];
  const pad = (n) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const dow = new Date(`${dateStr}T12:00:00Z`).getDay();
    if (dow !== 0 && dow !== 6) days.push(dateStr);
  }
  return days;
}

const workingDays = getWorkingDays(2026, 8); // August = 8

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function makeIST(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+08:00`; // Malaysia timezone (MYT = UTC+8)
}

// Attendance patterns (index of working day, 1-based)
const patterns = {
  111: { absent: [3, 17], halfDay: [10], late: [2, 6, 12, 19], earlyOut: [5, 14] },
  112: { absent: [5, 20], halfDay: [8],  late: [1, 9, 15],     earlyOut: [7, 18] },
  113: { absent: [4],     halfDay: [13], late: [3, 8, 16, 21], earlyOut: [10, 17] },
  114: { absent: [2, 15], halfDay: [],   late: [4, 7, 11],     earlyOut: [6, 19] },
  115: { absent: [6],     halfDay: [11], late: [1, 5, 13, 20], earlyOut: [9, 16] },
};

// Leave absent days
const leaveAbsent = {
  112: ["2026-08-12"],              // Nur Aisyah - Sick Leave (Approved)
  113: ["2026-08-18", "2026-08-19"], // Lim Wei Jian - Annual Leave (Rejected)
  114: ["2026-08-25", "2026-08-26"], // Siti Farah - Annual Leave (Approved)
};

async function seedAttendance(client) {
  console.log("\n📅 Seeding Attendance...");
  let count = 0;
  for (const emp of employees) {
    const pat = patterns[emp.id];
    for (let i = 0; i < workingDays.length; i++) {
      const dateStr = workingDays[i];
      const dayNum = i + 1;
      const isLeaveDay = (leaveAbsent[emp.id] || []).includes(dateStr);

      let status, checkIn, checkOut, regularizationStatus, regularizationReason, reqCheckIn, reqCheckOut;

      if (isLeaveDay) {
        status = "On Leave"; checkIn = null; checkOut = null;
      } else if (pat.absent.includes(dayNum)) {
        status = "Absent"; checkIn = null; checkOut = null;
        if (pat.absent.indexOf(dayNum) === 0) {
          reqCheckIn = makeIST(dateStr, addMinutes(SHIFT_START, 20));
          reqCheckOut = makeIST(dateStr, addMinutes(SHIFT_END, -20));
          regularizationReason = "System error - punch not recorded";
          regularizationStatus = ["Pending", "Approved", "Rejected"][emp.id % 3];
        }
      } else if (pat.halfDay.includes(dayNum)) {
        status = "Half Day";
        checkIn = makeIST(dateStr, SHIFT_START);
        checkOut = makeIST(dateStr, addMinutes(SHIFT_START, 240));
      } else if (pat.late.includes(dayNum)) {
        const lateMins = 15 + (dayNum % 4) * 10;
        status = "Present";
        checkIn = makeIST(dateStr, addMinutes(SHIFT_START, lateMins));
        checkOut = makeIST(dateStr, SHIFT_END);
      } else if (pat.earlyOut.includes(dayNum)) {
        const earlyMins = 30 + (dayNum % 3) * 15;
        status = "Present";
        checkIn = makeIST(dateStr, SHIFT_START);
        checkOut = makeIST(dateStr, addMinutes(SHIFT_END, -earlyMins));
      } else {
        const inVar = (dayNum % 3 === 0) ? 5 : 0;
        const outVar = (dayNum % 5 === 0) ? 10 : 0;
        status = "Present";
        checkIn = makeIST(dateStr, addMinutes(SHIFT_START, inVar));
        checkOut = makeIST(dateStr, addMinutes(SHIFT_END, outVar));
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
    // Pending - Muhammad Amir
    {
      emp: employees[0], leaveTypeId: 294, leaveTypeName: "Annual Leave",
      startDate: "2026-08-20", endDate: "2026-08-21", days: 2,
      reason: "Family commitment", status: "Pending", session: "full"
    },
    // Approved - Nur Aisyah (Sick)
    {
      emp: employees[1], leaveTypeId: 296, leaveTypeName: "Outpatient Sick Leave",
      startDate: "2026-08-12", endDate: "2026-08-12", days: 1,
      reason: "Flu and fever, clinic visit", status: "Approved",
      approverName: "Lim Wei Jian", reviewedByName: "Lim Wei Jian", session: "full"
    },
    // Rejected - Lim Wei Jian
    {
      emp: employees[2], leaveTypeId: 294, leaveTypeName: "Annual Leave",
      startDate: "2026-08-18", endDate: "2026-08-19", days: 2,
      reason: "Personal matters", status: "Rejected",
      approverName: "Nur Aisyah", reviewedByName: "Nur Aisyah",
      rejectReason: "Team short-staffed during this period", session: "full"
    },
    // Approved - Siti Farah
    {
      emp: employees[3], leaveTypeId: 294, leaveTypeName: "Annual Leave",
      startDate: "2026-08-25", endDate: "2026-08-26", days: 2,
      reason: "Raya Haji celebration with family", status: "Approved",
      approverName: "Lim Wei Jian", reviewedByName: "Lim Wei Jian", session: "full"
    },
    // Pending - Arjun Raj
    {
      emp: employees[4], leaveTypeId: 296, leaveTypeName: "Outpatient Sick Leave",
      startDate: "2026-08-07", endDate: "2026-08-07", days: 1,
      reason: "Doctor appointment - follow up checkup", status: "Pending", session: "full"
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
  const approvedLeaves = leaveRequests.filter(l => l.lr.status === "Approved");
  const revokes = [
    {
      lrData: approvedLeaves[0], // Nur Aisyah
      reason: "Feeling better, can attend office", status: "Pending",
    },
    {
      lrData: approvedLeaves[1], // Siti Farah
      reason: "Plans changed, will come to work", status: "Approved",
      approverName: "Lim Wei Jian", reviewedByName: "Lim Wei Jian"
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
    // Weekday OT
    { emp: employees[0], date: "2026-08-05", hours: 2,   mins: 120, totalHours: "11:00", workHours: 9, reason: "Client presentation prep",         status: "Pending",  type: "Weekday Ot" },
    { emp: employees[1], date: "2026-08-11", hours: 1.5, mins: 90,  totalHours: "10:30", workHours: 9, reason: "Module testing before release",    status: "Approved", approverName: "Lim Wei Jian", reviewedByName: "Lim Wei Jian", type: "Weekday Ot" },
    { emp: employees[2], date: "2026-08-14", hours: 2,   mins: 120, totalHours: "11:00", workHours: 9, reason: "API integration work",             status: "Rejected", approverName: "Nur Aisyah",   reviewedByName: "Nur Aisyah",   rejectReason: "No prior approval obtained", type: "Weekday Ot" },
    { emp: employees[3], date: "2026-08-21", hours: 3,   mins: 180, totalHours: "12:00", workHours: 9, reason: "Month-end report preparation",     status: "Approved", approverName: "Lim Wei Jian", reviewedByName: "Lim Wei Jian", type: "Weekday Ot" },
    { emp: employees[4], date: "2026-08-27", hours: 1,   mins: 60,  totalHours: "10:00", workHours: 9, reason: "Critical bug fix for production",  status: "Pending",  type: "Weekday Ot" },
    // Weekend OT
    { emp: employees[0], date: "2026-08-01", hours: 3, mins: 180, totalHours: "03:00", workHours: 0, reason: "Emergency deployment",             status: "Approved", approverName: "Arjun Raj", reviewedByName: "Arjun Raj", type: "Weekend Ot" },
    { emp: employees[4], date: "2026-08-08", hours: 4, mins: 240, totalHours: "04:00", workHours: 0, reason: "Server migration weekend task",     status: "Pending",  type: "Weekend Ot" },
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
  console.log("🚀 Starting August 2026 Seed Data — Nexora Digital Sdn. Bhd.");
  console.log(`📆 Working days: ${workingDays.length} days (${workingDays[0]} to ${workingDays[workingDays.length - 1]})`);

  await client.query("BEGIN");
  await seedAttendance(client);
  const insertedLeaves = await seedLeaveRequests(client);
  await seedLeaveRevokes(client, insertedLeaves);
  await seedOTRequests(client);
  await client.query("COMMIT");

  console.log("\n🎉 All August 2026 seed data inserted successfully!");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ Error:", err.message, err.stack);
} finally {
  client.release();
  await db.end();
}

