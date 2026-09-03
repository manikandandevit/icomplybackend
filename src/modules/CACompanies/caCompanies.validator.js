import { LOGO_KEY_PATTERN } from "../Companies/companies.storage.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const textOf = (value) => String(value ?? "").trim();

const requireText = (errors, key, value, label) => {
  const text = textOf(value);

  if (!text) {
    errors[key] = `${label} is required`;
  }

  return text;
};

const logoFrom = (body) => {
  const url = textOf(body.logoUrl);
  const key = textOf(body.logoKey);

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (LOGO_KEY_PATTERN.test(key)) {
    return key;
  }

  if (LOGO_KEY_PATTERN.test(url)) {
    return url;
  }

  return "";
};

const addressCountryFrom = (value) => {
  const text = textOf(value);

  if (!text) {
    return "";
  }

  const asId = Number.parseInt(text, 10);
  if (Number.isInteger(asId) && asId > 0 && String(asId) === text) {
    return String(asId);
  }

  return text;
};

export const validateCACompanyBody = (body = {}, { logoRequired = true } = {}) => {
  const errors = {};
  const legalName = requireText(errors, "legalName", body.legalName, "Legal company name");
  const tradeName = requireText(errors, "tradeName", body.tradeName, "Trade name");
  const pan = requireText(errors, "pan", body.pan, "PAN").toUpperCase();
  const gstin = requireText(errors, "gstin", body.gstin, "GSTIN").toUpperCase();
  const street = requireText(errors, "street", body.street, "Street address");
  const city = requireText(errors, "city", body.city, "City");
  const state = requireText(errors, "state", body.state, "State");
  const pin = requireText(errors, "pin", body.pin, "Pin code");
  const addressCountryId = addressCountryFrom(body.addressCountryId);

  if (!addressCountryId) {
    errors.addressCountryId = "Country is required";
  }
  const contactName = requireText(errors, "contactName", body.contactName, "Full name");
  const email = textOf(body.email);
  const mobile = requireText(errors, "mobile", body.mobile, "Mobile number");
  const logoUrl = logoFrom(body);

  if (!email) {
    errors.email = "Email address is required";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address";
  }

  if (logoRequired && !logoUrl) {
    errors.logoUrl = "Company logo is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      legalName,
      tradeName,
      pan,
      gstin,
      street,
      city,
      state,
      pin,
      addressCountryId,
      contactName,
      email,
      mobile,
      initials: textOf(body.initials) || null,
      logoUrl: logoUrl || null,
    },
  };
};
