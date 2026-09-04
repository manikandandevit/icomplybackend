export const ALL_COMPANIES_ACCESS = "All Companies";

export const isAllCompanyAccess = (access) => {
  const value = String(access || "").trim();
  return !value || value.toLowerCase() === ALL_COMPANIES_ACCESS.toLowerCase();
};

export const companyAccessNames = (...values) =>
  values
    .flat()
    .map((value) => String(value || "").trim())
    .filter(Boolean);

export const matchesCompanyAccess = (access, ...values) => {
  if (isAllCompanyAccess(access)) {
    return true;
  }

  const needle = String(access).trim().toLowerCase();
  return companyAccessNames(...values).some((name) => name.toLowerCase() === needle);
};
