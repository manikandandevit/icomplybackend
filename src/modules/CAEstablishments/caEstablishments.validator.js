const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const textOf = (value) => String(value ?? "").trim();

const requireText = (errors, key, value, label) => {
  const text = textOf(value);

  if (!text) {
    errors[key] = `${label} is required`;
  }

  return text;
};

const companySourceFrom = (value) => (textOf(value).toLowerCase() === "ca" ? "ca" : "parent");

const statusFrom = (value) => (textOf(value).toLowerCase() === "active" ? "Active" : "Inactive");

const employeeCountFrom = (value) => {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

const countryIdFrom = (value) => {
  const text = textOf(value);
  const asId = Number.parseInt(text, 10);
  return Number.isInteger(asId) && asId > 0 ? String(asId) : text;
};

export const validateCAEstablishmentBody = (body = {}) => {
  const errors = {};
  const companyId = requireText(errors, "companyId", body.companyId, "Parent company");
  const companySource = companySourceFrom(body.companySource);
  const countryId = countryIdFrom(body.countryId);
  const name = requireText(errors, "name", body.name, "Establishment name");
  const type = requireText(errors, "type", body.type, "Establishment type");
  const effectiveDate = requireText(errors, "effectiveDate", body.effectiveDate, "Effective date");
  const address = requireText(errors, "address", body.address, "Address line");
  const city = requireText(errors, "city", body.city, "City");
  const state = requireText(errors, "state", body.state, "State");
  const pin = requireText(errors, "pin", body.pin, "Pin code");
  const pfCode = requireText(errors, "pfCode", body.pfCode, "PF registration code");
  const contactName = requireText(errors, "contactName", body.contactName, "Contact name");
  const email = textOf(body.email);
  const mobile = requireText(errors, "mobile", body.mobile, "Mobile number");

  if (!countryId) {
    errors.countryId = "Country is required";
  }

  if (!email) {
    errors.email = "Email address is required";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      companyId,
      companySource,
      countryId,
      name,
      type,
      status: statusFrom(body.status),
      effectiveDate,
      employeeCount: employeeCountFrom(body.employeeCount ?? body.employees),
      natureOfWork: textOf(body.natureOfWork),
      address,
      city,
      state,
      pin,
      pfCode,
      pfStatus: textOf(body.pfStatus) || "Pending",
      esiApplicable: body.esiApplicable !== false && textOf(body.esiApplicable) !== "false",
      esiCode: textOf(body.esiCode),
      lwfCode: textOf(body.lwfCode),
      ptRegNo: textOf(body.ptRegNo),
      ptState: textOf(body.ptState),
      contactName,
      email,
      mobile,
    },
  };
};
