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
    multiplier: null,
    days: null,
  };

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
  }

  if (masterType === "shift-type") {
    const startTime = String(body.startTime ?? body.values?.startTime ?? "").trim();
    const endTime = String(body.endTime ?? body.values?.endTime ?? "").trim();
    const totalHours = String(body.totalHours ?? body.values?.totalHours ?? "").trim();

    if (!startTime) {
      errors.startTime = "Start time is required";
    }
    if (!endTime) {
      errors.endTime = "End time is required";
    }
    if (!totalHours) {
      errors.totalHours = "Total hours is required";
    }

    value.startTime = startTime;
    value.endTime = endTime;
    value.totalHours = totalHours;
  }

  if (masterType === "ot-type") {
    const multiplier = String(body.multiplier ?? body.values?.multiplier ?? "").trim();
    if (!multiplier) {
      errors.multiplier = "Multiplier is required";
    } else if (Number.isNaN(Number(multiplier)) || Number(multiplier) <= 0) {
      errors.multiplier = "Multiplier must be a positive number";
    }
    value.multiplier = multiplier;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value,
    label: MASTER_LABELS[masterType] || "Master",
  };
};
