import { FREE_TRIAL_DAYS } from "./companies.constants.js";
import { LOGO_KEY_PATTERN } from "./companies.storage.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const planFrom = (body) => (String(body.plan ?? "").trim() === "Standard" ? "Standard" : "Free Trial");

const requireText = (errors, key, value, label) => {
  const text = String(value ?? "").trim();

  if (!text) {
    errors[key] = `${label} is required`;
  }

  return text;
};

const usersFromSource = (source, countryId) => {
  const id = String(countryId);

  if (Array.isArray(source)) {
    const match = source.find((item) => String(item?.countryId) === id);
    return match?.users;
  }

  if (!source || typeof source !== "object") {
    return undefined;
  }

  if (source[countryId] != null) {
    return source[countryId];
  }

  if (source[id] != null) {
    return source[id];
  }

  for (const [key, value] of Object.entries(source)) {
    if (String(key) === id) {
      return value;
    }
  }

  return undefined;
};

const countryUsersFrom = (body, countries) => {
  const source = body.countryUsers && typeof body.countryUsers === "object" ? body.countryUsers : {};
  const next = {};

  for (const id of countries) {
    const users = Number.parseInt(String(usersFromSource(source, id) ?? ""), 10);
    next[String(id)] = Number.isInteger(users) && users > 0 ? users : 0;
  }

  return next;
};

const subscriptionFrom = (body, countries) => {
  const plan = planFrom(body);

  if (plan === "Standard") {
    const countryUsers = countryUsersFrom(body, countries);
    const missing = countries.filter((id) => countryUsers[id] < 1);

    if (missing.length > 0) {
      return {
        plan,
        countryUsers,
        users: null,
        monthlyValue: null,
        trialDaysLeft: null,
        usersError: "Enter licensed users for each country of operation",
      };
    }

    return {
      plan,
      countryUsers,
      users: Object.values(countryUsers).reduce((sum, count) => sum + count, 0),
      monthlyValue: null,
      trialDaysLeft: null,
    };
  }

  return {
    plan,
    countryUsers: {},
    users: 0,
    monthlyValue: null,
    trialDaysLeft: FREE_TRIAL_DAYS,
  };
};

export const validateCompanyBody = (body = {}, { passwordRequired = true } = {}) => {
  const errors = {};
  const legalName = requireText(errors, "legalName", body.legalName, "Legal company name");
  const tradeName = requireText(errors, "tradeName", body.tradeName, "Trade name");
  const pan = requireText(errors, "pan", body.pan, "PAN").toUpperCase();
  const gstin = requireText(errors, "gstin", body.gstin, "GSTIN").toUpperCase();
  const street = requireText(errors, "street", body.street, "Street address");
  const city = requireText(errors, "city", body.city, "City");
  const state = requireText(errors, "state", body.state, "State");
  const pin = requireText(errors, "pin", body.pin, "Pin code");
  const contactName = requireText(errors, "contactName", body.contactName, "Full name");
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const mobile = requireText(errors, "mobile", body.mobile, "Mobile number");
  const countries = Array.isArray(body.countries)
    ? [...new Set(body.countries.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  const subscription = subscriptionFrom(body, countries);
  const billingCountryId = String(body.billingCountryId ?? "").trim();

  if (!billingCountryId) {
    errors.billingCountryId = "Country is required";
  }

  if (countries.length === 0) {
    errors.countries = "Select at least one country";
  }

  if (!email) {
    errors.email = "Email address is required";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address";
  }

  if (passwordRequired && !password) {
    errors.password = "Password is required";
  } else if (password && password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (subscription.usersError) {
    errors.users = subscription.usersError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      legalName,
      tradeName,
      pan,
      gstin,
      countries,
      billingCountryId,
      street,
      city,
      state,
      pin,
      contactName,
      email,
      password: password || null,
      mobile,
      initials: String(body.initials ?? "").trim() || null,
      logoUrl: LOGO_KEY_PATTERN.test(String(body.logoKey ?? "").trim())
        ? String(body.logoKey).trim()
        : null,
      plan: subscription.plan,
      countryUsers: subscription.countryUsers,
      users: subscription.users,
      monthlyValue: subscription.monthlyValue,
      trialDaysLeft: subscription.trialDaysLeft,
    },
  };
};
