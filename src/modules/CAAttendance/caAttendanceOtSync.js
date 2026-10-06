import { db } from "../../core/db/pool.js";
import { caEmployeesRepository } from "../CAEmployees/caEmployees.repository.js";
import { caAttendanceRepository } from "./caAttendance.repository.js";
import { caOtRequestsRepository } from "../CAOvertime/caOtRequests.repository.js";

const calculateOtHours = (row, employee) => {
  if (!row.checkOut) return 0;
  const out = new Date(row.checkOut);
  if (Number.isNaN(out.getTime())) return 0;

  const dateKey = String(row.date || "").slice(0, 10);
  const baseIsoDate = `${dateKey}T00:00:00+05:30`;
  const isSunday = new Date(baseIsoDate).getDay() === 0;
  if (isSunday && row.checkIn) {
    const inDate = new Date(row.checkIn);
    const diffMs = out.getTime() - inDate.getTime();
    return diffMs > 0 ? Math.round((diffMs / 3600000) * 10) / 10 : 0;
  }

  const shiftEndTime = employee.details?.shiftEndTime;
  if (shiftEndTime) {
    let [ehH, ehM] = shiftEndTime.split(":").map(Number);
    const shiftStartTime = employee.details?.shiftStartTime;
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
    return diffMs > 0 ? Math.round((diffMs / 3600000) * 10) / 10 : 0;
  }
  return 0;
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

    if (otHours > 0) {
      if (existingOt) {
        if (existingOt.status === "Pending" && existingOt.source === "auto") {
          await caOtRequestsRepository.update(existingOt.id, companyId, { hours: otHours });
        }
      } else {
        await caOtRequestsRepository.create(companyId, {
          establishmentId: employee.establishmentId,
          establishmentName: employee.establishmentName,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.employeeCode,
          date: dateKey,
          workDate: dateKey,
          hours: otHours,
          reason: "Auto-calculated from attendance",
          source: "auto",
        });
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
