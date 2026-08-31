import { FREE_TRIAL_DAYS, STANDARD_PRICE_PER_USER } from "./companies.constants.js";
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

const subscriptionFrom = (body) => {
  const plan = planFrom(body);

  if (plan === "Standard") {
    const users = Number.parseInt(String(body.users ?? ""), 10);

    if (!Number.isInteger(users) || users < 1) {
      return {
        plan,
        users: null,
        monthlyValue: null,
        trialDaysLeft: null,
        usersError: "Enter number of users",
      };
    }

    return {
      plan,
      users,
      monthlyValue: users * STANDARD_PRICE_PER_USER,
      trialDaysLeft: null,
    };
  }

  return {
    plan,
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
    ? body.countries.map((code) => String(code).toUpperCase()).filter(Boolean)
    : [];
  const subscription = subscriptionFrom(body);
  const uen = String(body.uen ?? "").trim();
  const ssm = String(body.ssm ?? "").trim();
  const dbd = String(body.dbd ?? "").trim();

  if (countries.length === 0) {
    errors.countries = "Select at least one country";
  }

  if (countries.includes("SG") && !uen) {
    errors.uen = "UEN is required";
  }

  if (countries.includes("MY") && !ssm) {
    errors.ssm = "SSM company no. is required";
  }

  if (countries.includes("TH") && !dbd) {
    errors.dbd = "DBD registration no. is required";
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
      uen: countries.includes("SG") ? uen : null,
      ssm: countries.includes("MY") ? ssm : null,
      dbd: countries.includes("TH") ? dbd : null,
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
      users: subscription.users,
      monthlyValue: subscription.monthlyValue,
      trialDaysLeft: subscription.trialDaysLeft,
    },
  };
};
