import { AppError } from "../../core/errors/AppError.js";
import { db } from "../../core/db/pool.js";
import { caHrMasterRepository } from "../CAHrMaster/caHrMaster.repository.js";
import { caHolidaysRepository } from "./caHolidays.repository.js";

const uniqueError = (error) => {
  if (error?.code === "23505") {
    throw new AppError("This holiday already exists for the selected date and establishment", 409, "HOLIDAY_EXISTS");
  }
  throw error;
};

const withHolidayType = async (companyId, payload) => {
  const holidayType = await caHrMasterRepository.findById(payload.holidayTypeId, companyId, "holiday-type");
  if (!holidayType) {
    throw new AppError("Holiday type not found", 404, "HOLIDAY_TYPE_NOT_FOUND");
  }

  const estIdRaw = String(payload.establishmentId ?? "all").trim();
  const establishmentId = estIdRaw.toLowerCase() === "all" || !estIdRaw ? "all" : estIdRaw;
  let establishmentName = String(payload.establishmentName ?? "").trim();
  if (establishmentId === "all") {
    establishmentName = "All";
  } else if (!establishmentName) {
    const { rows } = await db.query(
      `SELECT name FROM public.ca_establishments WHERE id = $1 AND created_by_company_id = $2 LIMIT 1`,
      [Number(establishmentId), Number(companyId)],
    );
    establishmentName = rows[0]?.name || "";
  }

  const countryId = payload.countryId === "all" || !payload.countryId ? "all" : payload.countryId;
  return {
    ...payload,
    name: String(payload.name || "").trim(),
    establishmentId,
    establishmentName,
    countryId,
    countryName: countryId === "all" ? "All" : payload.countryName || "",
    holidayTypeName: holidayType.values?.name || "Holiday",
  };
};

export const caHolidaysService = {
  list: (companyId, filter = {}) => caHolidaysRepository.list(companyId, filter),

  async create(companyId, payload) {
    try {
      const created = await caHolidaysRepository.create(companyId, await withHolidayType(companyId, payload));
      if (!created) throw new AppError("Unable to save holiday", 500, "HOLIDAY_CREATE_FAILED");
      return created;
    } catch (error) {
      uniqueError(error);
    }
  },

  async update(id, companyId, payload) {
    const existing = await caHolidaysRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Holiday not found", 404, "HOLIDAY_NOT_FOUND");
    }
    try {
      const updated = await caHolidaysRepository.update(id, companyId, await withHolidayType(companyId, payload));
      if (!updated) throw new AppError("Unable to update holiday", 500, "HOLIDAY_UPDATE_FAILED");
      return updated;
    } catch (error) {
      uniqueError(error);
    }
  },

  async remove(id, companyId) {
    const existing = await caHolidaysRepository.findById(id, companyId);
    if (!existing) {
      throw new AppError("Holiday not found", 404, "HOLIDAY_NOT_FOUND");
    }
    const removed = await caHolidaysRepository.remove(id, companyId);
    if (!removed) {
      throw new AppError("Unable to delete holiday", 500, "HOLIDAY_DELETE_FAILED");
    }
    return existing;
  },
};
