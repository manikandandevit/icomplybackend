import { asyncHandler } from "../../core/middleware/asyncHandler.js";
import { AppError } from "../../core/errors/AppError.js";
import { fail, success } from "../../core/utils/response.js";
import { MASTER_LABELS } from "./caHrMaster.constants.js";
import { caHrMasterService } from "./caHrMaster.service.js";
import { isValidMasterType, validateMasterBody } from "./caHrMaster.validator.js";

const sendAppError = (res, error) => {
  if (error instanceof AppError) {
    return fail(res, {
      status: error.statusCode,
      message: error.message,
      code: error.code,
    });
  }

  throw error;
};

const requireType = (req, res) => {
  const masterType = String(req.params.type || "");

  if (!isValidMasterType(masterType)) {
    fail(res, {
      status: 404,
      message: "Unknown master type",
      code: "MASTER_TYPE_NOT_FOUND",
    });
    return null;
  }

  return masterType;
};

export const caHrMasterController = {
  list: asyncHandler(async (req, res) => {
    const masterType = requireType(req, res);
    if (!masterType) {
      return;
    }

    const items = await caHrMasterService.list(req.companyId, masterType);
    const label = MASTER_LABELS[masterType];

    return success(res, {
      message: `${label} list loaded`,
      data: { items },
    });
  }),

  create: asyncHandler(async (req, res) => {
    const masterType = requireType(req, res);
    if (!masterType) {
      return;
    }

    const { isValid, errors, value, label } = validateMasterBody(masterType, req.body);

    if (!isValid) {
      const message = Object.values(errors)[0] || "Validation failed";
      return fail(res, {
        status: 422,
        message,
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const item = await caHrMasterService.create(req.companyId, masterType, value);

      return success(res, {
        status: 201,
        message: `${label} created successfully`,
        data: { item },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  update: asyncHandler(async (req, res) => {
    const masterType = requireType(req, res);
    if (!masterType) {
      return;
    }

    const { isValid, errors, value, label } = validateMasterBody(masterType, req.body);

    if (!isValid) {
      const message = Object.values(errors)[0] || "Validation failed";
      return fail(res, {
        status: 422,
        message,
        code: "VALIDATION_ERROR",
        errors,
      });
    }

    try {
      const item = await caHrMasterService.update(req.params.id, req.companyId, masterType, value);

      return success(res, {
        message: `${label} updated successfully`,
        data: { item },
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),

  delete: asyncHandler(async (req, res) => {
    const masterType = requireType(req, res);
    if (!masterType) {
      return;
    }

    const label = MASTER_LABELS[masterType];

    try {
      await caHrMasterService.delete(req.params.id, req.companyId, masterType);

      return success(res, {
        message: `${label} deleted successfully`,
      });
    } catch (error) {
      return sendAppError(res, error);
    }
  }),
};
