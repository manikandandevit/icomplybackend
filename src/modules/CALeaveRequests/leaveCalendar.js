import { expandHolidayDates, expandHolidayMap } from "../../core/leave/workingDays.js";
import { caEstablishmentsRepository } from "../CAEstablishments/caEstablishments.repository.js";
import { caHolidaysRepository } from "../CAHolidays/caHolidays.repository.js";

export const leaveCalendarFor = async (companyId, employee, establishment) => {
  const resolved =
    establishment ||
    (employee?.establishmentId ? await caEstablishmentsRepository.findById(employee.establishmentId) : null);
  const holidays = await caHolidaysRepository.list(companyId);
  const countryId = resolved?.countryId || employee?.details?.countryId || "";
  return {
    weekOffDay: employee?.details?.weekOffDay || "Sunday",
    holidayDates: expandHolidayDates(holidays, countryId),
    holidayMap: expandHolidayMap(holidays, countryId),
  };
};
