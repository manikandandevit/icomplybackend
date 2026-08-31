import { createToast, toastTypeForStatus } from "../toast/index.js";

export const success = (res, { status = 200, message = "Success", data = null, toast = null } = {}) => {
  return res.status(status).json({
    success: true,
    message,
    data,
    toast,
    timestamp: new Date().toISOString(),
  });
};

export const fail = (
  res,
  { status = 400, message = "Request failed", code = "BAD_REQUEST", errors = null, toast } = {}
) => {
  return res.status(status).json({
    success: false,
    message,
    code,
    errors,
    toast: toast ?? createToast({ type: toastTypeForStatus(status), message }),
    timestamp: new Date().toISOString(),
  });
};
