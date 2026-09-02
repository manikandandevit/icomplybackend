import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { loginRepository } from "./login.repository.js";

const COMPANY_ROLE = "CompanyAdmin";
const companySubject = (id) => `company:${id}`;

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
  imageUrl: row.logo_url ? `/companies/${row.id}/logo` : null,
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
    { expiresIn: config.jwt.expiresIn }
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
    imageUrl: user.imageUrl ?? null,
  },
});

export const loginService = {
  async authenticate({ email, password }) {
    let superAdmin = null;

    try {
      superAdmin = await loginRepository.findSuperAdminByEmail(email);
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
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
      if (err instanceof AppError) {
        throw err;
      }
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

      if (company.status !== "Active") {
        throw new AppError("Company account is inactive", 403, "COMPANY_INACTIVE");
      }

      const publicUser = toPublicCompanyAdmin(company);
      return sessionFor(
        { ...publicUser, tokenSub: companySubject(company.id) },
        { type: "company", companyId: String(company.id) }
      );
    }

    const user = users.find((entry) => entry.email === email);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    return sessionFor(toPublicUser(user));
  },

  async getProfile(userId) {
    const raw = String(userId ?? "");

    if (raw.startsWith("company:")) {
      const companyId = raw.slice("company:".length);

      try {
        const company = await loginRepository.findCompanyById(companyId);

        if (!company) {
          throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
        }

        if (company.status !== "Active") {
          throw new AppError("Company account is inactive", 403, "COMPANY_INACTIVE");
        }

        return toPublicCompanyAdmin(company);
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
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
        if (err instanceof AppError) {
          throw err;
        }
        throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
      }
    }

    const user = users.find((entry) => entry.id === raw);

    if (!user) {
      throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
    }

    return toPublicUser(user);
  },
};
