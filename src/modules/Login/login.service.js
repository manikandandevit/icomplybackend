import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { loginRepository } from "./login.repository.js";

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

const issueToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

const sessionFor = (user) => ({
  token: issueToken(user),
  expiresIn: config.jwt.expiresIn,
  user,
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

    const user = users.find((entry) => entry.email === email);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    return sessionFor(toPublicUser(user));
  },

  async getProfile(userId) {
    if (/^\d+$/.test(String(userId))) {
      try {
        const superAdmin = await loginRepository.findSuperAdminById(userId);

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

    const user = users.find((entry) => entry.id === userId);

    if (!user) {
      throw new AppError("User session is no longer valid", 401, "UNAUTHORIZED");
    }

    return toPublicUser(user);
  },
};
