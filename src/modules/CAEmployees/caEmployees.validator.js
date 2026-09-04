const required = (value, label, errors, key) => {
  const next = String(value ?? "").trim();
  if (!next) {
    errors[key] = `${label} is required`;
  }
  return next;
};

const mapDetails = (body = {}) => {
  const src = body.details && typeof body.details === "object" ? body.details : body;
  return {
    countryId: String(src.countryId ?? "").trim(),
    dateOfBirth: String(src.dateOfBirth ?? "").trim(),
    fatherHusbandName: String(src.fatherHusbandName ?? "").trim(),
    address: String(src.address ?? "").trim(),
    state: String(src.state ?? "").trim(),
    city: String(src.city ?? "").trim(),
    pinCode: String(src.pinCode ?? "").trim(),
    childrenCount: String(src.childrenCount ?? "").trim(),
    reportingToId: String(src.reportingToId ?? "").trim(),
    reportingToName: String(src.reportingToName ?? "").trim(),
    emergencyName: String(src.emergencyName ?? "").trim(),
    emergencyRelationship: String(src.emergencyRelationship ?? "").trim(),
    emergencyPhone: String(src.emergencyPhone ?? "").trim(),
    emergencyAltPhone: String(src.emergencyAltPhone ?? "").trim(),
    emergencyAddress: String(src.emergencyAddress ?? "").trim(),
    emergencyState: String(src.emergencyState ?? "").trim(),
    emergencyCity: String(src.emergencyCity ?? "").trim(),
    emergencyPinCode: String(src.emergencyPinCode ?? "").trim(),
    shiftNameCode: String(src.shiftNameCode ?? "").trim(),
    weekOffDay: String(src.weekOffDay ?? "").trim(),
    shiftStartTime: String(src.shiftStartTime ?? "").trim(),
    shiftEndTime: String(src.shiftEndTime ?? "").trim(),
    breakTime: String(src.breakTime ?? "").trim(),
  };
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
  const details = mapDetails(body);

  required(details.countryId, "Country", errors, "countryId");
  required(details.dateOfBirth, "Date of birth", errors, "dateOfBirth");
  required(details.fatherHusbandName, "Father / husband name", errors, "fatherHusbandName");
  required(details.address, "Address", errors, "address");
  required(details.state, "State", errors, "state");
  required(details.city, "City", errors, "city");
  required(details.pinCode, "Pin code", errors, "pinCode");
  if (details.reportingToId || details.reportingToName) {
    required(details.reportingToId, "Reporting to", errors, "reportingToId");
    required(details.reportingToName, "Reporting to", errors, "reportingToName");
  }
  required(details.emergencyName, "Emergency contact name", errors, "emergencyName");
  required(details.emergencyRelationship, "Emergency relationship", errors, "emergencyRelationship");
  required(details.emergencyPhone, "Emergency phone", errors, "emergencyPhone");
  required(details.emergencyAltPhone, "Alternate phone", errors, "emergencyAltPhone");
  required(details.emergencyAddress, "Emergency address", errors, "emergencyAddress");
  required(details.emergencyState, "Emergency state", errors, "emergencyState");
  required(details.emergencyCity, "Emergency city", errors, "emergencyCity");
  required(details.emergencyPinCode, "Emergency pin code", errors, "emergencyPinCode");
  required(details.shiftNameCode, "Shift name / code", errors, "shiftNameCode");
  required(details.weekOffDay, "Week off day", errors, "weekOffDay");
  required(details.shiftStartTime, "Shift start time", errors, "shiftStartTime");
  required(details.shiftEndTime, "Shift end time", errors, "shiftEndTime");
  required(details.breakTime, "Break time", errors, "breakTime");

  const bankDetails = Array.isArray(body.bankDetails)
    ? body.bankDetails
        .map((item, index) => ({
          id: String(item?.id || `bank-${index + 1}`),
          bankAccountTypeId: String(item?.bankAccountTypeId ?? "").trim(),
          bankAccountTypeName: String(item?.bankAccountTypeName ?? "").trim(),
          accountNumber: String(item?.accountNumber ?? "").trim(),
          ifscCode: String(item?.ifscCode ?? "").trim().toUpperCase(),
          bankNameBranch: String(item?.bankNameBranch ?? "").trim(),
        }))
        .filter(
          (item) =>
            item.bankAccountTypeId &&
            item.bankAccountTypeName &&
            item.accountNumber &&
            item.ifscCode &&
            item.bankNameBranch,
        )
    : [];

  if (bankDetails.length === 0) {
    errors.bankDetails = "At least one bank account is required";
  }

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
      bankDetails,
      details,
    },
  };
};
