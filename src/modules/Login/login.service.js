import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { FREE_TRIAL_DAYS, isFreeTrialExpired } from "../Companies/companies.constants.js";
import { loginRepository } from "./login.repository.js";
import { caUsersRepository } from "../CAUsers/caUsers.repository.js";

const COMPANY_ROLE = "CompanyAdmin";
const EMPLOYEE_ROLE = "EmployeeAdmin";
const companySubject = (id) => `company:${id}`;
const caUserSubject = (id) => `causer:${id}`;
const employeeSubject = (id) => `employee:${id}`;

const INACTIVE_ACCOUNT_MESSAGE = "Contact admin your account is inactive";

const users = [
  {
    id: "usr-1002",
    name: "Raj Kumar",
    email: "payroll@icomply.in",
    passwordHash: bcrypt.hashSync("Pay@123", 10),
    role: "Payroll Manager",
    department: "Payroll",
  },
  {
    id: "usr-1003",
    name: "Priya S",
    email: "compliance@icomply.in",
    passwordHash: bcrypt.hashSync("Comply@123", 10),
    role: "Compliance Manager",
    department: "Compliance",
  },
];

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  imageUrl: user.imageUrl ?? null,
});

const toPublicSuperAdmin = (row) => ({
  id: String(row.id),
  name: row.User_Name,
  email: row.Email,
  role: row.Role,
  imageUrl: row.Image_Url ?? null,
});

const toPublicCompanyAdmin = (row) => ({
  id: String(row.id),
  name: row.trade_name || row.legal_name,
  email: row.email,
  role: COMPANY_ROLE,
  department: "Company",
  companyId: String(row.id),
  isOwner: true,
  companyAccess: "All Companies",
  designationId: null,
  imageUrl: row.logo_url ? `/companies/${row.id}/logo` : null,
});

const toPublicCAUser = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: COMPANY_ROLE,
  department: row.role || "Company",
  companyId: String(row.createdByCompanyId || ""),
  isOwner: false,
  designationId: row.designationId || null,
  designationName: row.role || "",
  companyAccess: row.companyAccess || "All Companies",
  imageUrl: null,
});

const toPublicEmployee = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  role: EMPLOYEE_ROLE,
  department: row.department_name || "Employee",
  companyId: String(row.created_by_company_id || row.company_id || ""),
  employeeId: String(row.id),
  mustResetPassword: Boolean(row.must_reset_password),
  isOwner: false,
  designationId: row.designation_id != null ? String(row.designation_id) : row.designationId || null,
  designationName: row.designation_name || row.designationName || "",
  companyAccess: row.company_name || row.companyName || "All Companies",
  imageUrl: null,
});

const issueToken = (user, extra = {}) =>
  jwt.sign(
    {
      sub: user.tokenSub ?? user.id,
      email: user.email,
      role: user.role,
      ...extra,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );

const sessionFor = (user, extra = {}) => ({
  token: issueToken(user, extra),
  expiresIn: config.jwt.expiresIn,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    companyId: user.companyId,
    employeeId: user.employeeId,
    mustResetPassword: Boolean(user.mustResetPassword),
    isOwner: Boolean(user.isOwner),
    designationId: user.designationId ?? null,
    designationName: user.designationName ?? null,
    companyAccess: user.companyAccess ?? null,
    imageUrl: user.imageUrl ?? null,
  },
});

const enforceCompanyAccess = async (company) => {
  if (company.plan !== "Standard" && isFreeTrialExpired(company) && company.status === "Active") {
    await loginRepository.markCompanyInactive(company.id);
    company.status = "Inactive";
    company.trial_days_left = 0;
  }

  if (company.status !== "Active") {
    throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "COMPANY_INACTIVE");
  }
};

export const loginService = {
  async authenticate({ email, password }) {
    let superAdmin = null;

    try {
      superAdmin = await loginRepository.findSuperAdminByEmail(email);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Unable to sign in", 500, "LOGIN_UNAVAILABLE");
    }

    if (superAdmin) {
      const matches = await bcrypt.compare(password, superAdmin.Password);
      if (!matches) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }
      return sessionFor(toPublicSuperAdmin(superAdmin));
    }

    let company = null;
    try {
      company = await loginRepository.findCompanyByEmail(email);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Unable to sign in", 500, "LOGIN_UNAVAILABLE");
    }

    if (company) {
      if (!company.password_hash) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      const matches = await bcrypt.compare(password, company.password_hash);
      if (!matches) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      await enforceCompanyAccess(company);

      const publicUser = toPublicCompanyAdmin(company);
      return sessionFor(
        { ...publicUser, tokenSub: companySubject(company.id) },
        { type: "company", companyId: String(company.id) },
      );
    }

    let caUser = null;
    try {
      caUser = await caUsersRepository.findAuthByEmail(email);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Unable to sign in", 500, "LOGIN_UNAVAILABLE");
    }

    if (caUser) {
      if (caUser.status !== "Active") {
        throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "USER_INACTIVE");
      }

      if (!caUser.passwordHash) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      const matches = await bcrypt.compare(password, caUser.passwordHash);
      if (!matches) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      const parentCompany = await loginRepository.findCompanyById(caUser.createdByCompanyId);
      if (parentCompany) {
        await enforceCompanyAccess(parentCompany);
      }

      const publicUser = toPublicCAUser(caUser);
      return sessionFor(
        { ...publicUser, tokenSub: caUserSubject(caUser.id) },
        {
          type: "ca_user",
          caUserId: String(caUser.id),
          companyId: String(caUser.createdByCompanyId),
          designationId: caUser.designationId || null,
          companyAccess: caUser.companyAccess || "All Companies",
        },
      );
    }

    let employee = null;
    try {
      employee = await loginRepository.findEmployeeByEmail(email);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("Unable to sign in", 500, "LOGIN_UNAVAILABLE");
    }

    if (employee) {
      if (employee.status !== "Active") {
        throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "EMPLOYEE_INACTIVE");
      }

      if (!employee.password_hash) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      const matches = await bcrypt.compare(password, employee.password_hash);
      if (!matches) {
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
      }

      const parentCompany = await loginRepository.findCompanyById(employee.created_by_company_id);
      if (parentCompany) {
        await enforceCompanyAccess(parentCompany);
      }

      const publicUser = toPublicEmployee(employee);
      return sessionFor(
        { ...publicUser, tokenSub: employeeSubject(employee.id) },
        {
          type: "employee",
          employeeId: String(employee.id),
          companyId: String(employee.created_by_company_id || employee.company_id || ""),
          designationId: employee.designation_id != null ? String(employee.designation_id) : null,
          companyAccess: employee.company_name || "All Companies",
          mustResetPassword: Boolean(employee.must_reset_password),
        },
      );
    }

    const user = users.find((entry) => entry.email === email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    return sessionFor(toPublicUser(user));
  },

  async getProfile(tokenUser) {
    const raw = String(tokenUser?.sub ?? tokenUser ?? "");

    if (raw.startsWith("company:")) {
      const companyId = raw.slice("company:".length);
      try {
        const company = await loginRepository.findCompanyById(companyId);
        if (!company) {
          throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
        }
        await enforceCompanyAccess(company);
        return toPublicCompanyAdmin(company);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
      }
    }

    if (raw.startsWith("causer:")) {
      const caUserId = raw.slice("causer:".length);
      try {
        const caUser = await caUsersRepository.findAuthByIdOnly(caUserId);
        if (!caUser) {
          throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
        }
        if (caUser.status !== "Active") {
          throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "USER_INACTIVE");
        }
        const parentCompany = await loginRepository.findCompanyById(caUser.createdByCompanyId);
        if (parentCompany) {
          await enforceCompanyAccess(parentCompany);
        }
        return toPublicCAUser(caUser);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
      }
    }

    if (raw.startsWith("employee:")) {
      const employeeId = raw.slice("employee:".length);
      try {
        const employee = await loginRepository.findEmployeeById(employeeId);
        if (!employee) {
          throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
        }
        if (employee.status !== "Active") {
          throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "EMPLOYEE_INACTIVE");
        }
        const parentCompany = await loginRepository.findCompanyById(employee.created_by_company_id);
        if (parentCompany) {
          await enforceCompanyAccess(parentCompany);
        }
        return toPublicEmployee(employee);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
      }
    }

    if (/^\d+$/.test(raw)) {
      try {
        const superAdmin = await loginRepository.findSuperAdminById(raw);
        if (superAdmin) {
          return toPublicSuperAdmin(superAdmin);
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
      }
    }

    const user = users.find((entry) => entry.id === raw);
    if (!user) {
      throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
    }

    return toPublicUser(user);
  },

  async resetPassword(userPayload, { password }) {
    const sub = String(userPayload?.sub ?? "");
    if (!sub.startsWith("employee:")) {
      throw new AppError("Only employees can reset password here", 403, "FORBIDDEN");
    }

    const employeeId = sub.slice("employee:".length);
    const employee = await loginRepository.findEmployeeById(employeeId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (employee.status !== "Active") {
      throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "EMPLOYEE_INACTIVE");
    }

    const next = String(password ?? "");
    if (next.length < 6) {
      throw new AppError("Password must be at least 6 characters", 422, "VALIDATION_ERROR");
    }

    const passwordHash = await bcrypt.hash(next, 10);
    const updated = await loginRepository.updateEmployeePassword(employeeId, passwordHash);
    if (!updated) {
      throw new AppError("Unable to update password", 500, "PASSWORD_UPDATE_FAILED");
    }

    const publicUser = toPublicEmployee(updated);
    return sessionFor(
      { ...publicUser, tokenSub: employeeSubject(updated.id), mustResetPassword: false },
      {
        type: "employee",
        employeeId: String(updated.id),
        companyId: String(updated.created_by_company_id || updated.company_id || ""),
        designationId: updated.designation_id != null ? String(updated.designation_id) : null,
        companyAccess: updated.company_name || "All Companies",
        mustResetPassword: false,
      },
    );
  },
};

export { FREE_TRIAL_DAYS, EMPLOYEE_ROLE };
