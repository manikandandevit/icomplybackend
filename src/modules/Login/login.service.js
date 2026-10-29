import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { sendMail } from "../../core/mail/mailer.js";
import { FREE_TRIAL_DAYS, isCompanyExpired } from "../Companies/companies.constants.js";
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

const toPublicCAUser = (row) => {
  const allowed = Array.isArray(row.allowedModules) ? row.allowedModules : ["all"];
  const isAll = allowed.includes("all");
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: COMPANY_ROLE,
    department: row.role || "Company",
    companyId: String(row.createdByCompanyId || ""),
    isOwner: isAll,
    allowedModules: allowed,
    designationId: row.designationId || null,
    designationName: row.role || "",
    companyAccess: row.companyAccess || "All Companies",
    mustResetPassword: Boolean(row.mustResetPassword),
    imageUrl: null,
  };
};

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
  establishmentId: row.establishment_id != null ? String(row.establishment_id) : null,
  establishmentName: row.establishment_name || null,
  countryId: row.country_id != null ? String(row.country_id) : null,
  countryName: row.country_name || null,
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
    allowedModules: user.allowedModules || (user.isOwner ? ["all"] : []),
    designationId: user.designationId ?? null,
    designationName: user.designationName ?? null,
    companyAccess: user.companyAccess ?? null,
    establishmentId: user.establishmentId ?? null,
    establishmentName: user.establishmentName ?? null,
    countryId: user.countryId ?? null,
    countryName: user.countryName ?? null,
    imageUrl: user.imageUrl ?? null,
  },
});

const enforceCompanyAccess = async (company) => {
  if (isCompanyExpired(company) && company.status === "Active") {
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
        { ...publicUser, tokenSub: caUserSubject(caUser.id), mustResetPassword: Boolean(caUser.mustResetPassword) },
        {
          type: "ca_user",
          caUserId: String(caUser.id),
          companyId: String(caUser.createdByCompanyId),
          designationId: caUser.designationId || null,
          companyAccess: caUser.companyAccess || "All Companies",
          isOwner: publicUser.isOwner,
          allowedModules: publicUser.allowedModules,
          mustResetPassword: Boolean(caUser.mustResetPassword),
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
    const isCAUser = userPayload?.type === "ca_user" || sub.startsWith("causer:") || sub.startsWith("ca_user:");

    if (isCAUser) {
      const caUserId = String(userPayload?.caUserId || sub.replace(/^(causer:|ca_user:)/, ""));
      const caUser = await loginRepository.findCAUserById(caUserId);
      if (!caUser) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }
      if (caUser.status !== "Active") {
        throw new AppError(INACTIVE_ACCOUNT_MESSAGE, 403, "USER_INACTIVE");
      }

      const next = String(password ?? "");
      if (next.length < 6) {
        throw new AppError("Password must be at least 6 characters", 422, "VALIDATION_ERROR");
      }

      const passwordHash = await bcrypt.hash(next, 10);
      const updated = await loginRepository.updateCAUserPassword(caUserId, passwordHash);
      if (!updated) {
        throw new AppError("Unable to update password", 500, "PASSWORD_UPDATE_FAILED");
      }

      const publicUser = toPublicCAUser(updated);
      return sessionFor(
        { ...publicUser, tokenSub: caUserSubject(updated.id), mustResetPassword: false },
        {
          type: "ca_user",
          caUserId: String(updated.id),
          companyId: String(updated.createdByCompanyId),
          designationId: updated.designationId || null,
          companyAccess: updated.companyAccess || "All Companies",
          mustResetPassword: false,
        },
      );
    }

    if (!sub.startsWith("employee:")) {
      throw new AppError("Only employees or users can reset password here", 403, "FORBIDDEN");
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

  async requestPasswordReset({ email, origin }) {
    const targetEmail = String(email || "").trim().toLowerCase();
    if (!targetEmail) {
      throw new AppError("Email address is required", 400, "EMAIL_REQUIRED");
    }

    let userType = null;
    let userId = null;
    let userName = "";

    // 1. Check employee
    const employee = await loginRepository.findEmployeeByEmail(targetEmail);
    if (employee) {
      if (employee.status === "Inactive") {
        throw new AppError("Account is inactive. Please contact your company administrator.", 403, "ACCOUNT_INACTIVE");
      }
      userType = "employee";
      userId = String(employee.id);
      userName = employee.name || "Employee";
    }

    // 2. Check CA User
    if (!userType) {
      const caUser = await loginRepository.findCAUserByEmail(targetEmail);
      if (caUser) {
        if (caUser.status === "Inactive") {
          throw new AppError("Account is inactive. Please contact your administrator.", 403, "ACCOUNT_INACTIVE");
        }
        userType = "ca_user";
        userId = String(caUser.id);
        userName = caUser.name || "User";
      }
    }

    // 3. Check Company Admin
    if (!userType) {
      const company = await loginRepository.findCompanyByEmail(targetEmail);
      if (company) {
        if (company.status === "Inactive") {
          throw new AppError("Company account is inactive.", 403, "ACCOUNT_INACTIVE");
        }
        userType = "company";
        userId = String(company.id);
        userName = company.legal_name || company.trade_name || "Company Admin";
      }
    }

    // 4. Check Super Admin
    if (!userType) {
      const superAdmin = await loginRepository.findSuperAdminByEmail(targetEmail);
      if (superAdmin) {
        userType = "super_admin";
        userId = String(superAdmin.id);
        userName = superAdmin.User_Name || "Super Admin";
      }
    }

    if (!userType) {
      throw new AppError("No registered account found with this email address", 404, "USER_NOT_FOUND");
    }

    const resetToken = jwt.sign(
      {
        sub: `reset:${userType}:${userId}`,
        id: userId,
        userType,
        email: targetEmail,
        purpose: "reset_password",
      },
      config.jwt.secret,
      { expiresIn: "1h" }
    );

    let clientOrigin = origin ? String(origin).trim().replace(/\/$/, "") : "";
    if (!clientOrigin) {
      if (process.env.FRONTEND_URL) {
        clientOrigin = process.env.FRONTEND_URL.trim().replace(/\/$/, "");
      } else if (config.env === "production") {
        const liveOrigin = (config.clientOrigins || []).find((o) => o && !o.includes("localhost"));
        clientOrigin = liveOrigin ? liveOrigin.replace(/\/$/, "") : "https://icomplyone.com";
      } else {
        clientOrigin = (config.clientOrigins[0] || "http://localhost:5173").replace(/\/$/, "");
      }
    }

    const resetUrl = `${clientOrigin}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await sendMail({
      to: targetEmail,
      subject: "Reset Your iComply Password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 22px; font-weight: 700; color: #0c2340; letter-spacing: -0.5px;">iComply</span>
          </div>
          <h2 style="color: #0c2340; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Reset Your Password</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            Hello ${userName},<br/>
            We received a request to reset the password for your iComply account (${targetEmail}). Click the button below to choose a new password:
          </p>
          <div style="margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #0c2340; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 16px 0;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetUrl}" style="color: #f97316; word-break: break-all;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
            This password reset link will expire in 1 hour. If you did not make this request, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Hello ${userName},\n\nReset your iComply password by clicking the link below:\n${resetUrl}\n\nThis link expires in 1 hour.`,
    });

    return {
      message: "Password reset link has been sent to your email address.",
    };
  },

  async resetPasswordWithToken({ token, password }) {
    if (!token) {
      throw new AppError("Reset token is required", 400, "TOKEN_REQUIRED");
    }
    const cleanPassword = String(password ?? "").trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      throw new AppError("Password must be at least 6 characters", 422, "VALIDATION_ERROR");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch {
      throw new AppError("Invalid or expired password reset link. Please request a new one.", 400, "TOKEN_EXPIRED");
    }

    if (decoded.purpose !== "reset_password" || !decoded.userType || !decoded.id) {
      throw new AppError("Invalid reset token", 400, "INVALID_TOKEN");
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    if (decoded.userType === "employee") {
      await loginRepository.updateEmployeePassword(decoded.id, passwordHash);
    } else if (decoded.userType === "ca_user") {
      await loginRepository.updateCAUserPassword(decoded.id, passwordHash);
    } else if (decoded.userType === "company") {
      await loginRepository.updateCompanyPassword(decoded.id, passwordHash);
    } else if (decoded.userType === "super_admin") {
      await loginRepository.updateSuperAdminPassword(decoded.id, passwordHash);
    } else {
      throw new AppError("Invalid user type", 400, "INVALID_USER_TYPE");
    }

    return {
      message: "Password has been reset successfully. You can now log in with your new password.",
    };
  },
};

export { FREE_TRIAL_DAYS, EMPLOYEE_ROLE };
