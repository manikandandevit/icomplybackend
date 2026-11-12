import { db } from "../../core/db/pool.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caAttendanceRepository } from "./caAttendance.repository.js";
import { caOtRequestsRepository } from "../CAOvertime/caOtRequests.repository.js";
import { caFcmService } from "../CANotifications/caFcm.service.js";
import { OT_THRESHOLD_MINUTES } from "./caAttendance.window.js";

/** Weekday of a "YYYY-MM-DD" calendar date (0 = Sunday), same on any server timezone. */
const weekdayOf = (dateKey) => {
  const [y, m, d] = String(dateKey || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const calculateOtHours = (row, employee) => {
  const isOtApplicable = employee?.otApplicable !== undefined ? Boolean(employee.otApplicable) : Boolean(employee?.details?.otApplicable ?? true);
  if (!isOtApplicable) return 0;
  const effectiveOut = row.checkOut || row.requestedCheckOut;
  const effectiveIn = row.checkIn || row.requestedCheckIn;
  if (!effectiveOut) return 0;

  if (row.otHoursNum !== undefined && row.otHoursNum !== null && row.checkOut) {
    return Number(row.otHoursNum);
  }

  const out = new Date(effectiveOut);
  if (Number.isNaN(out.getTime())) return 0;

  const dateObj = new Date(row.date);
  if (Number.isNaN(dateObj.getTime())) return 0;
  const dateParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(dateObj);
  const dateKey = `${dateParts.find(p => p.type === 'year').value}-${dateParts.find(p => p.type === 'month').value}-${dateParts.find(p => p.type === 'day').value}`;
  const isSunday = weekdayOf(dateKey) === 0;
  if (isSunday && effectiveIn) {
    const inDate = new Date(effectiveIn);
    const diffMs = out.getTime() - inDate.getTime();
    return diffMs > 0 ? Math.round((diffMs / 3600000) * 10) / 10 : 0;
  }

  const shiftEndTime = row.shiftEndTime || employee.details?.shiftEndTime || "18:30";
  let [ehH, ehM] = shiftEndTime.split(":").map(Number);
  const shiftStartTime = row.shiftStartTime || employee.details?.shiftStartTime || "09:30";
  let addDay = false;
  if (shiftStartTime) {
    const [shH, shM] = shiftStartTime.split(":").map(Number);
    if (ehH < shH || (ehH === shH && ehM < shM)) {
      addDay = true;
    }
  }

  // Construct exact ISO string in IST
  const shiftEndIso = `${dateKey}T${String(ehH).padStart(2, '0')}:${String(ehM).padStart(2, '0')}:00+05:30`;
  const shiftEnd = new Date(shiftEndIso);
  if (addDay) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  const diffMs = out.getTime() - shiftEnd.getTime();
  // Up to 10 min after shift end is not OT; past it, OT counts from shift end.
  if (diffMs <= OT_THRESHOLD_MINUTES * 60000) return 0;
  return Math.round((diffMs / 3600000) * 10) / 10;
};

export const syncOtRequest = async (companyId, attendanceId) => {
  try {
    const record = await caAttendanceRepository.getById(attendanceId, companyId);
    if (!record) return;
    const employee = await caEmployeesRepository.findById(record.employeeId, companyId);
    if (!employee) return;

    const otHours = calculateOtHours(record, employee);
    const dateKey = String(record.date || "").slice(0, 10);

    const { rows } = await db.query(
      `SELECT * FROM ca_ot_requests WHERE employee_id = $1 AND date = $2 AND created_by_company_id = $3 LIMIT 1`,
      [employee.id, dateKey, companyId]
    );
    const existingOt = rows[0];

    const reportingToId = employee.reportingToId || employee.details?.reportingToId || null;
    const approverName = employee.reportingToName || employee.details?.reportingToName || "Company Admin";

    if (otHours > 0) {
      if (existingOt) {
        if (existingOt.status === "Pending" && existingOt.source === "auto") {
          await caOtRequestsRepository.update(existingOt.id, companyId, {
            hours: otHours,
            workedOtHours: otHours,
            reportingToId: reportingToId ? Number(reportingToId) : null,
            approverName,
          });
        }
      } else {
        const created = await caOtRequestsRepository.create(companyId, {
          establishmentId: employee.establishmentId,
          establishmentName: employee.establishmentName,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.employeeCode,
          date: dateKey,
          workDate: dateKey,
          hours: otHours,
          workedOtHours: otHours,
          reason: "Auto-calculated from attendance",
          reportingToId: reportingToId ? Number(reportingToId) : null,
          approverName,
          source: "auto",
        });
        if (created) {
          void caFcmService.notifyApproversOfOtRequest({
            companyId,
            employee,
            otRequest: created,
          });
        }
      }
    } else {
      if (existingOt && existingOt.status === "Pending" && existingOt.source === "auto") {
         await caOtRequestsRepository.delete(existingOt.id, companyId);
      }
    }
  } catch (err) {
    console.error("Failed to sync OT request:", err);
  }
};
