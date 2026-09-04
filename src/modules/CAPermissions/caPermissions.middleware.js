import { AppError } from "../../core/errors/AppError.js";
import { HR_MASTER_NAV } from "./caPermissions.constants.js";
import { caPermissionsService } from "./caPermissions.service.js";

const actionFromMethod = (method) => {
  const verb = String(method || "GET").toUpperCase();
  if (verb === "POST") {
    return "add";
  }
  if (verb === "PUT" || verb === "PATCH" || verb === "DELETE") {
    return "edit";
  }
  return "access";
};

export const requireNavPermission = (navId, { read = false } = {}) => async (req, _res, next) => {
  try {
    const action = actionFromMethod(req.method);
    if (action === "access" && !read) {
      return next();
    }

    await caPermissionsService.assertAccess(
      req.companyId,
      { isOwner: Boolean(req.isCompanyOwner), designationId: req.designationId, designationName: req.designationName },
      navId,
      action,
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireMasterPermission = async (req, _res, next) => {
  const navId = HR_MASTER_NAV[String(req.params.type || "")];
  if (!navId) {
    return next(new AppError("Unknown master type", 404, "MASTER_TYPE_NOT_FOUND"));
  }

  return requireNavPermission(navId)(req, _res, next);
};
