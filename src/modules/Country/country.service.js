import { AppError } from "../../core/errors/AppError.js";
import { countryRepository } from "./country.repository.js";

const uniqueError = (error) => {
  if (error?.code === "23505") {
    throw new AppError("This country already exists", 409, "COUNTRY_EXISTS");
  }

  throw error;
};

export const countryService = {
  list: () => countryRepository.list(),

  async create(name) {
    const existing = await countryRepository.findByName(name);

    if (existing) {
      throw new AppError("This country already exists", 409, "COUNTRY_EXISTS");
    }

    try {
      return await countryRepository.create(name);
    } catch (error) {
      uniqueError(error);
    }
  },

  async update(id, name) {
    const country = await countryRepository.findById(id);

    if (!country) {
      throw new AppError("Country not found", 404, "COUNTRY_NOT_FOUND");
    }

    const existing = await countryRepository.findByName(name, id);

    if (existing) {
      throw new AppError("This country already exists", 409, "COUNTRY_EXISTS");
    }

    try {
      const updated = await countryRepository.update(id, name);

      if (!updated) {
        throw new AppError("Country not found", 404, "COUNTRY_NOT_FOUND");
      }

      return updated;
    } catch (error) {
      uniqueError(error);
    }
  },

  async remove(id) {
    const country = await countryRepository.findById(id);

    if (!country) {
      throw new AppError("Country not found", 404, "COUNTRY_NOT_FOUND");
    }

    await countryRepository.remove(id);
    return country;
  },
};
