import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail } from "../../core/utils/response.js";
import { caUsersRepository } from "../CAUsers/caUsers.repository.js";
import { loginRepository } from "./login.repository.js";
import { validateLoginBody } from "./login.validator.js";

export const validateLoginRequest = (req, res, next) => {
  const { isValid, errors, value } = validateLoginBody(req.body);

  if (!isValid) {
    const message = Object.values(errors)[0] || "Validation failed";

    return fail(res, {
      status: 422,
      message,
      code: "VALIDATION_ERROR",
      errors,
    });
  }

  req.validatedBody = value;
  return next();
};

export const authenticateToken = (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, headerToken] = header.split(" ");
  const token = (scheme === "Bearer" && headerToken) ? headerToken : req.query?.token;

  if (!token) {
    return next(new AppError("Authentication token is required", 401, "UNAUTHORIZED"));
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch {
    return next(new AppError("Invalid or expired session", 401, "UNAUTHORIZED"));
  }
};

export const companyIdFromUser = (user) => {
  if ((user?.type === "company" || user?.type === "ca_user" || user?.type === "employee") && user.companyId) {
    return String(user.companyId);
  }

  return null;
};

export const requireCompanyAdmin = async (req, _res, next) => {
  try {
    const companyId = companyIdFromUser(req.user);

    if (!companyId) {
      return next(new AppError("Company admin access is required", 403, "FORBIDDEN"));
    }

    req.companyId = companyId;
    req.isCompanyOwner = req.user?.type === "company";
    req.companyAccess = "All Companies";
    req.designationId = null;
    req.designationName = null;
    req.caUserId = null;
    req.employeeId = null;
    req.actorName = req.user?.name || req.user?.email || "Company Admin";

    if (req.isCompanyOwner) {
      req.actorName = "Company Admin";
      req.allowedModules = ["all"];
      return next();
    }

    const sub = String(req.user?.sub || "");
    const isEmployee = req.user?.type === "employee" || sub.startsWith("employee:");

    if (isEmployee) {
      const employeeId = req.user?.employeeId || sub.replace(/^employee:/, "");
      const employee = await loginRepository.findEmployeeById(employeeId);

      if (!employee || employee.status !== "Active") {
        return next(new AppError("Contact admin your account is inactive", 403, "USER_INACTIVE"));
      }

      req.companyId = String(employee.created_by_company_id || companyId);
      req.companyAccess = employee.company_name || "All Companies";
      req.departmentId = employee.department_id != null ? String(employee.department_id) : null;
      req.departmentName = employee.department_name || null;
      req.designationId = employee.designation_id != null ? String(employee.designation_id) : null;
      req.designationName = employee.designation_name || null;
      req.employeeId = String(employee.id);
      req.actorName = employee.name || req.actorName;
      req.allowedModules = [];
      req.establishmentId = employee.establishment_id != null ? String(employee.establishment_id) : null;
      req.establishmentName = employee.establishment_name || null;
      req.countryId = employee.country_id != null ? String(employee.country_id) : null;
      req.countryName = employee.country_name || null;
      return next();
    }

    const caUserId = req.user?.caUserId || sub.replace(/^causer:/, "");
    const caUser = await caUsersRepository.findAuthById(caUserId, companyId);

    if (!caUser || caUser.status !== "Active") {
      return next(new AppError("Contact admin your account is inactive", 403, "USER_INACTIVE"));
    }

    const isAll = Boolean(caUser.allowedModules?.includes("all"));
    req.isCompanyOwner = isAll;
    req.allowedModules = caUser.allowedModules || ["all"];
    req.companyAccess = caUser.companyAccess || "All Companies";
    req.designationId = caUser.designationId || null;
    req.designationName = caUser.role || null;
    req.caUserId = caUser.id;
    req.actorName = caUser.name || req.actorName;
    return next();
  } catch (error) {
    return next(error);
  }
};
