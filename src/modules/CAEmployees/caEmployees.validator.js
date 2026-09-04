const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) {
    errors[key] = `${label} is required`;
  }
  return next;
};

export const validateEmployeeBody = (body = {}) => {
  const errors = {};

  const employeeCode = required(body.employeeCode, "Employee code", errors, "employeeCode");
  const name = required(body.name, "Employee name", errors, "name");
  const email = required(body.email, "Email", errors, "email");
  const mobile = required(body.mobile, "Mobile", errors, "mobile");
  const joinDate = required(body.joinDate, "Date of joining", errors, "joinDate");
  const companyId = required(body.companyId, "Company", errors, "companyId");
  const companySource = body.companySource === "ca" ? "ca" : body.companySource === "parent" ? "parent" : "";
  if (!companySource) errors.companySource = "Company source is required";
  const companyName = required(body.companyName, "Company", errors, "companyName");
  const establishmentId = required(body.establishmentId, "Establishment", errors, "establishmentId");
  const establishmentName = required(body.establishmentName, "Establishment", errors, "establishmentName");
  const departmentId = required(body.departmentId, "Department", errors, "departmentId");
  const departmentName = required(body.departmentName, "Department", errors, "departmentName");
  const designationId = required(body.designationId, "Designation", errors, "designationId");
  const designationName = required(body.designationName, "Designation", errors, "designationName");
  const employmentTypeId = required(body.employmentTypeId, "Employment type", errors, "employmentTypeId");
  const employmentTypeName = required(body.employmentTypeName, "Employment type", errors, "employmentTypeName");
  const shiftTypeId = required(body.shiftTypeId, "Shift type", errors, "shiftTypeId");
  const shiftTypeName = required(body.shiftTypeName, "Shift type", errors, "shiftTypeName");
  const genderId = required(body.genderId, "Gender", errors, "genderId");
  const genderName = required(body.genderName, "Gender", errors, "genderName");
  const maritalStatusId = required(body.maritalStatusId, "Marital status", errors, "maritalStatusId");
  const maritalStatusName = required(body.maritalStatusName, "Marital status", errors, "maritalStatusName");

  const otApplicable = Boolean(body.otApplicable);
  let otTypeId = String(body.otTypeId ?? "").trim();
  let otTypeName = String(body.otTypeName ?? "").trim();

  if (otApplicable) {
    if (!otTypeId) errors.otTypeId = "OT type is required when OT is applicable";
    if (!otTypeName) errors.otTypeName = "OT type is required when OT is applicable";
  } else {
    otTypeId = "";
    otTypeName = "";
  }

  const status = body.status === "Inactive" ? "Inactive" : "Active";

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    value: {
      employeeCode,
      name,
      email,
      mobile,
      joinDate,
      status,
      companyId,
      companySource,
      companyName,
      establishmentId,
      establishmentName,
      departmentId,
      departmentName,
      designationId,
      designationName,
      employmentTypeId,
      employmentTypeName,
      shiftTypeId,
      shiftTypeName,
      otApplicable,
      otTypeId,
      otTypeName,
      genderId,
      genderName,
      maritalStatusId,
      maritalStatusName,
    },
  };
};
