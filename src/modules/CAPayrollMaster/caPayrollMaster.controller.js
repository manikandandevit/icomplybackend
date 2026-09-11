import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { createToast } from "../../core/toast/index.js";
import { fail, success } from "../../core/utils/response.js";
import { caPayrollMasterService } from "./caPayrollMaster.service.js";

const sendAppError = (res, error) => {
  if (error instanceof AppError) {
    return fail(res, { status: error.statusCode, message: error.message, code: error.code });
  }
  throw error;
};

export const caPayrollMasterController = {
  list: asyncHandler(async (req, res) => {
    const components = await caPayrollMasterService.list(req.companyId);
    return success(res, { message: "Payroll components loaded", data: { components } });
  }),

  create: asyncHandler(async (req, res) => {
    try {
      const component = await caPayrollMasterService.create(req.companyId, req.body);
      const message = "Payroll component added";
      return success(res, {
        status: 201,
        message,
        data: { component },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    try {
      const component = await caPayrollMasterService.update(req.params.id, req.companyId, req.body);
      const message = "Payroll component updated";
      return success(res, {
        message,
        data: { component },
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  delete: asyncHandler(async (req, res) => {
    try {
      await caPayrollMasterService.delete(req.params.id, req.companyId);
      const message = "Payroll component deleted";
      return success(res, {
        message,
        toast: createToast({ type: "success", message }),
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
