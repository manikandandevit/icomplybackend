import { Country, State, City } from "country-state-city";
import { AppError } from "../../core/errors/AppError.js";
import { countryRepository } from "./country.repository.js";

const uniqueError = (error) => {
  if (error?.code === "23505") {
    throw new AppError("This country already exists", 409, "COUNTRY_EXISTS");
  }

  throw error;
};

const resolveCountryIso = (input) => {
  if (!input) return "";
  const str = String(input).trim();
  if (str.length === 2) {
    const c = Country.getCountryByCode(str.toUpperCase());
    if (c) return c.isoCode;
  }
  const all = Country.getAllCountries();
  const match = all.find(
    (c) =>
      c.name.toLowerCase() === str.toLowerCase() ||
      c.isoCode.toLowerCase() === str.toLowerCase()
  );
  return match ? match.isoCode : str.toUpperCase();
};

const resolveStateIso = (countryIso, stateInput) => {
  if (!countryIso || !stateInput) return "";
  const stateStr = String(stateInput).trim();
  const states = State.getStatesOfCountry(countryIso);
  const match = states.find(
    (s) =>
      s.isoCode.toLowerCase() === stateStr.toLowerCase() ||
      s.name.toLowerCase() === stateStr.toLowerCase()
  );
  return match ? match.isoCode : stateStr;
};

export const countryService = {
  list: () => countryRepository.list(),

  getStates(countryInput) {
    const iso = resolveCountryIso(countryInput);
    if (!iso) return [];
    return State.getStatesOfCountry(iso).map((s) => ({
      name: s.name,
      isoCode: s.isoCode,
      countryCode: s.countryCode,
    }));
  },

  getCities(countryInput, stateInput) {
    const countryIso = resolveCountryIso(countryInput);
    if (!countryIso) return [];
    const stateIso = resolveStateIso(countryIso, stateInput);
    if (!stateIso) {
      return City.getCitiesOfCountry(countryIso).map((c) => ({
        name: c.name,
        stateCode: c.stateCode,
        countryCode: c.countryCode,
      }));
    }
    return City.getCitiesOfState(countryIso, stateIso).map((c) => ({
      name: c.name,
      stateCode: c.stateCode,
      countryCode: c.countryCode,
    }));
  },

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

