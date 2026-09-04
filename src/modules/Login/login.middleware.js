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
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
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

    if (req.isCompanyOwner) {
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
      req.designationId = employee.designation_id != null ? String(employee.designation_id) : null;
      req.designationName = employee.designation_name || null;
      req.employeeId = String(employee.id);
      return next();
    }

    const caUserId = req.user?.caUserId || sub.replace(/^causer:/, "");
    const caUser = await caUsersRepository.findAuthById(caUserId, companyId);

    if (!caUser || caUser.status !== "Active") {
      return next(new AppError("Contact admin your account is inactive", 403, "USER_INACTIVE"));
    }

    req.companyAccess = caUser.companyAccess || "All Companies";
    req.designationId = caUser.designationId || null;
    req.designationName = caUser.role || null;
    req.caUserId = caUser.id;
    return next();
  } catch (error) {
    return next(error);
  }
};
