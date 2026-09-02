const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

export const normalizeCountryName = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

export const titleCaseCountryName = (value) =>
  normalizeCountryName(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");

export const validateCountryBody = (body = {}) => {
  const errors = {};
  const name = titleCaseCountryName(body.name);

  if (!name) {
    errors.name = "Country name is required";
  } else if (!NAME_PATTERN.test(name)) {
    errors.name = "Only alphabets are allowed";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: { name },
  };
};
