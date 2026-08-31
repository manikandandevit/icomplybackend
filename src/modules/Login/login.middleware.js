import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail } from "../../core/utils/response.js";
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
