const row = {
  checkIn: "2026-09-21T03:30:00.000Z",
  checkOut: "2026-09-21T12:30:00.000Z",
  date: "2026-09-20T18:30:00.000Z"
};
const employee = {
  details: {
    shiftStartTime: "09:00",
    shiftEndTime: "18:00"
  }
};

const calculateOtHours = (row, employee) => {
  if (!row.checkOut) return 0;
  const out = new Date(row.checkOut);
  if (Number.isNaN(out.getTime())) return 0;

  const dateObj = new Date(row.date);
  if (Number.isNaN(dateObj.getTime())) return 0;
  
  // Format to YYYY-MM-DD in IST
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj);
  console.log('dateKey', dateKey);

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

console.log('Result:', calculateOtHours(row, employee));
