import { MASTER_LABELS, MASTER_TYPES } from "./caHrMaster.constants.js";

const normalizeText = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

export const isValidMasterType = (type) => MASTER_TYPES.includes(String(type || ""));

export const validateMasterBody = (masterType, body = {}) => {
  const errors = {};
  const name = normalizeText(body.name ?? body.values?.name);

  if (!name) {
    errors.name = "Name is required";
  }

  const value = {
    name,
    relatedId: null,
    startTime: null,
    endTime: null,
    totalHours: null,
    breakTime: null,
    multiplier: null,
    days: null,
    code: null,
    countryId: null,
    countryName: null,
    eligibleGenderId: null,
    minHours: null,
    maxHours: null,
  };

  const TYPES_WITH_CODE = ["leave-types", "shift-type", "ot-type"];
  if (TYPES_WITH_CODE.includes(masterType)) {
    const code = normalizeText(body.code ?? body.values?.code).toUpperCase();
    if (!code) {
      errors.code = "Code is required";
    } else if (!/^[A-Z0-9-]{1,10}$/.test(code)) {
      errors.code = "Code must be 1–10 letters/numbers (e.g. ML)";
    }
    value.code = code;
  }

  const countryId = String(body.countryId ?? body.values?.countryId ?? "").trim();
  const countryName = normalizeText(body.countryName ?? body.values?.countryName);
  if (!countryId) {
    errors.countryId = "Country is required";
  } else if (countryId.toLowerCase() === "all") {
    value.countryId = "all";
    value.countryName = "All";
  } else {
    value.countryId = countryId;
    value.countryName = countryName || null;
  }

  if (masterType === "designation") {
    const departmentId = String(body.departmentId ?? body.values?.departmentId ?? "").trim();
    if (!departmentId) {
      errors.departmentId = "Department is required";
    } else {
      value.relatedId = departmentId;
    }
  }

  if (masterType === "leave-types") {
    const days = String(body.days ?? body.values?.days ?? "").trim();
    if (!days) {
      errors.days = "No of days is required";
    } else if (Number.isNaN(Number(days)) || Number(days) <= 0) {
      errors.days = "No of days must be a positive number";
    }
    value.days = days;

    const leaveCategoryId = String(body.leaveCategoryId ?? body.values?.leaveCategoryId ?? "").trim();
    if (!leaveCategoryId) {
      errors.leaveCategoryId = "Leave category is required";
    } else {
      value.relatedId = leaveCategoryId;
    }

    const eligibleGenderId = String(body.eligibleGenderId ?? body.values?.eligibleGenderId ?? "").trim();
    if (!eligibleGenderId) {
      errors.eligibleGenderId = "Eligible gender is required";
    } else if (eligibleGenderId.toLowerCase() === "all") {
      value.eligibleGenderId = null;
    } else {
      value.eligibleGenderId = eligibleGenderId;
    }
  }

  if (masterType === "shift-type") {
    const startTime = String(body.startTime ?? body.values?.startTime ?? "").trim();
    const endTime = String(body.endTime ?? body.values?.endTime ?? "").trim();
    const breakTime = String(body.breakTime ?? body.values?.breakTime ?? "").trim();

    if (!startTime) errors.startTime = "Start time is required";
    if (!endTime) errors.endTime = "End time is required";
    if (!breakTime) errors.breakTime = "Break time is required";

    value.startTime = startTime;
    value.endTime = endTime;
    value.breakTime = breakTime;
  }

  if (masterType === "ot-type") {
    const multiplier = String(body.multiplier ?? body.values?.multiplier ?? "").trim();
    const minHours = String(body.minHours ?? body.values?.minHours ?? "").trim();
    const maxHours = String(body.maxHours ?? body.values?.maxHours ?? "").trim();

    if (!multiplier) {
      errors.multiplier = "Multiplier is required";
    } else if (Number.isNaN(Number(multiplier)) || Number(multiplier) <= 0) {
      errors.multiplier = "Multiplier must be a positive number";
    }
    if (!minHours) {
      errors.minHours = "Min hours is required";
    } else if (Number.isNaN(Number(minHours)) || Number(minHours) < 0) {
      errors.minHours = "Min hours must be a valid number";
    }
    if (!maxHours) {
      errors.maxHours = "Max hours is required";
    } else if (Number.isNaN(Number(maxHours)) || Number(maxHours) <= 0) {
      errors.maxHours = "Max hours must be a positive number";
    } else if (Number(maxHours) < Number(minHours || 0)) {
      errors.maxHours = "Max hours must be >= min hours";
    }

    value.multiplier = multiplier;
    value.minHours = minHours;
    value.maxHours = maxHours;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value,
    label: MASTER_LABELS[masterType] || "Master",
  };
};
