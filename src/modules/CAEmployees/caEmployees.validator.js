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
    ...src,
    countryId: String(src.countryId ?? "").trim(),
    dateOfBirth: String(src.dateOfBirth ?? "").trim(),
    fatherHusbandType: String(src.fatherHusbandType ?? "Father").trim(),
    fatherHusbandName: String(src.fatherHusbandName ?? "").trim(),
    address: String(src.address ?? src.presentAddress ?? "").trim(),
    state: String(src.state ?? src.presentState ?? "").trim(),
    city: String(src.city ?? src.presentCity ?? "").trim(),
    pinCode: String(src.pinCode ?? src.presentPinCode ?? "").trim(),
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
    paymentMethodId: String(src.paymentMethodId ?? src.paymentModeId ?? "").trim(),
    paymentMethodName: String(src.paymentMethodName ?? src.paymentModeName ?? "").trim(),
    paymentModeId: String(src.paymentModeId ?? src.paymentMethodId ?? "").trim(),
    paymentModeName: String(src.paymentModeName ?? src.paymentMethodName ?? "").trim(),
    citizenshipStatus: String(src.citizenshipStatus ?? src.residentialStatus ?? "").trim(),
    residentialStatus: String(src.residentialStatus ?? src.citizenshipStatus ?? "").trim(),
    nricNumber: String(src.nricNumber ?? "").trim(),
    singpass: String(src.singpass ?? "").trim(),
    uanNumber: String(src.uanNumber ?? "").trim(),
    kwspNumber: String(src.kwspNumber ?? "").trim(),
    statutoryApplicable: Boolean(src.statutoryApplicable ?? body.statutoryApplicable ?? false),
    referredById: String(src.referredById ?? "").trim(),
    referredByName: String(src.referredByName ?? "").trim(),
    educationDetails: Array.isArray(src.educationDetails)
      ? src.educationDetails
      : Array.isArray(body.educationDetails)
      ? body.educationDetails
      : [],
    familyDetails: Array.isArray(src.familyDetails)
      ? src.familyDetails
      : Array.isArray(body.familyDetails)
      ? body.familyDetails
      : [],
    documents: Array.isArray(src.documents)
      ? src.documents
      : Array.isArray(body.documents)
      ? body.documents
      : [],
    sameAsPresent: Boolean(src.sameAsPresent),
    presentAddress: String(src.presentAddress ?? src.address ?? "").trim(),
    presentState: String(src.presentState ?? src.state ?? "").trim(),
    presentCity: String(src.presentCity ?? src.city ?? "").trim(),
    presentPinCode: String(src.presentPinCode ?? src.pinCode ?? "").trim(),
    permanentAddress: String(src.permanentAddress ?? "").trim(),
    permanentState: String(src.permanentState ?? "").trim(),
    permanentCity: String(src.permanentCity ?? "").trim(),
    permanentPinCode: String(src.permanentPinCode ?? "").trim(),
  };
};

export const validateEmployeeBody = (body = {}) => {
  const errors = {};

  const employeeCode = required(body.employeeCode, "Employee code", errors, "employeeCode");
  const name = required(body.name, "Employee name", errors, "name");
  const email = required(body.email, "Email", errors, "email");
  const mobile = String(body.mobile ?? "").trim() || "0000000000";
  const joinDate = required(body.joinDate, "Date of joining", errors, "joinDate");
  const companyId = required(body.companyId, "Company", errors, "companyId");
  const companySource = body.companySource === "ca" ? "ca" : body.companySource === "parent" ? "parent" : "";
  if (!companySource) errors.companySource = "Company source is required";
  const companyName = required(body.companyName, "Company", errors, "companyName");
  const establishmentId = required(body.establishmentId, "Establishment", errors, "establishmentId");
  const establishmentName = required(body.establishmentName, "Establishment", errors, "establishmentName");
  const ctcRaw = String(body.ctc ?? "").trim();
  if (!ctcRaw || !/^\d+(\.\d+)?$/.test(ctcRaw)) {
    errors.ctc = "CTC is required and must be a number";
  }
  const ctc = Number(ctcRaw);
  const departmentId = required(body.departmentId, "Department", errors, "departmentId");
  const departmentName = required(body.departmentName, "Department", errors, "departmentName");
  const designationId = required(body.designationId, "Designation", errors, "designationId");
  const designationName = required(body.designationName, "Designation", errors, "designationName");
  const employmentTypeId = required(body.employmentTypeId, "Employment type", errors, "employmentTypeId");
  const employmentTypeName = required(body.employmentTypeName, "Employment type", errors, "employmentTypeName");
  const shiftTypeId = String(body.shiftTypeId ?? "").trim();
  const shiftTypeName = String(body.shiftTypeName ?? "").trim();
  const genderId = String(body.genderId ?? "").trim();
  const genderName = String(body.genderName ?? "").trim();
  const maritalStatusId = String(body.maritalStatusId ?? "").trim();
  const maritalStatusName = String(body.maritalStatusName ?? "").trim();

  const otApplicable = Boolean(body.otApplicable);
  let otTypeId = String(body.otTypeId ?? "").trim();
  let otTypeName = String(body.otTypeName ?? "").trim();

  if (!otApplicable) {
    otTypeId = "";
    otTypeName = "";
  }

  const status = body.status === "Inactive" ? "Inactive" : "Active";
  const details = mapDetails(body);

  if (details.countryId) {
    // Country validated
  }
  if (details.reportingToId || details.reportingToName) {
    required(details.reportingToId, "Reporting to", errors, "reportingToId");
    required(details.reportingToName, "Reporting to", errors, "reportingToName");
  }

  const bankDetails = Array.isArray(body.bankDetails)
    ? body.bankDetails
      .map((item, index) => {
        const bankName = String(item?.bankName || item?.bankNameBranch?.split("-")[0] || "").trim();
        const branchName = String(item?.branchName || item?.bankNameBranch?.split("-")[1] || "").trim();
        const bankNameBranch = String(
          item?.bankNameBranch ||
          (bankName ? `${bankName}${branchName ? ` - ${branchName}` : ""}` : "") ||
          ""
        ).trim();
        return {
          id: String(item?.id || `bank-${index + 1}`),
          bankAccountTypeId: String(item?.bankAccountTypeId || "salary").trim(),
          bankAccountTypeName: String(item?.bankAccountTypeName || "Primary Salary Account").trim(),
          bankName,
          branchName,
          accountNumber: String(item?.accountNumber ?? "").trim(),
          ifscCode: String(item?.ifscCode ?? "").trim().toUpperCase(),
          bankNameBranch,
        };
      })
      .filter(
        (item) =>
          item.accountNumber &&
          item.ifscCode &&
          item.bankNameBranch,
      )
    : [];

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
      ctc: Number.isFinite(ctc) ? ctc : 0,
      departmentId,
      departmentName,
      designationId,
      designationName,
      employmentTypeId,
      employmentTypeName,
      shiftTypeId: shiftTypeId || null,
      shiftTypeName: shiftTypeName || null,
      otApplicable,
      otTypeId: otTypeId || null,
      otTypeName: otTypeName || null,
      statutoryApplicable: Boolean(body.statutoryApplicable ?? details.statutoryApplicable ?? false),
      genderId: genderId || null,
      genderName: genderName || null,
      maritalStatusId: maritalStatusId || null,
      maritalStatusName: maritalStatusName || null,
      bankDetails,
      details,
    },
  };
};
