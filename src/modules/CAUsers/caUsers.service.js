import bcrypt from "bcryptjs";
import { AppError } from "../../core/errors/AppError.js";
import { caUsersRepository } from "./caUsers.repository.js";

export const DEFAULT_CA_USER_PASSWORD = "User@123";

const hashPassword = async (password) => {
  return bcrypt.hash(password || DEFAULT_CA_USER_PASSWORD, 10);
};

export const caUsersService = {
  list: (companyId) => caUsersRepository.list(companyId),

  async get(id, companyId) {
    const user = await caUsersRepository.findById(id, companyId);

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return user;
  },

  async create(companyId, payload) {
    const rawPassword = payload.password || DEFAULT_CA_USER_PASSWORD;

    const user = await caUsersRepository.create(companyId, {
      ...payload,
      passwordHash: await hashPassword(rawPassword),
      mustResetPassword: true,
    });

    if (!user) {
      throw new AppError("Unable to create user", 500, "USER_CREATE_FAILED");
    }

    return user;
  },

  async update(id, companyId, payload) {
    const existing = await caUsersRepository.findById(id, companyId);

    if (!existing) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const updated = await caUsersRepository.update(id, companyId, {
      ...payload,
      passwordHash: payload.password ? await hashPassword(payload.password) : null,
    });

    if (!updated) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return updated;
  },

  async updateStatus(id, companyId, status) {
    const existing = await caUsersRepository.findById(id, companyId);

    if (!existing) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const next = status === "Active" ? "Active" : "Inactive";
    const updated = await caUsersRepository.updateStatus(id, companyId, next);

    if (!updated) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return updated;
  },

  async delete(id, companyId) {
    const existing = await caUsersRepository.findById(id, companyId);

    if (!existing) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return caUsersRepository.delete(id, companyId);
  },
};
