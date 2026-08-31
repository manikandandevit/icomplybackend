import { fail } from "../utils/response.js";
import { config } from "../../config/index.js";

export const notFoundHandler = (req, res) => {
  return fail(res, {
    status: 404,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: "NOT_FOUND",
  });
};

export const errorHandler = (err, req, res, _next) => {
  const status = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message =
    status === 500 && config.env === "production"
      ? "An unexpected error occurred"
      : err.message || "An unexpected error occurred";

  if (config.env !== "production") {
    console.error("[ErrorHandler]", err);
  }

  return fail(res, { status, message, code });
};
