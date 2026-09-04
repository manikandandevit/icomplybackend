import { AppError } from "../../core/errors/AppError.js";
import { caPermissionsRepository } from "./caPermissions.repository.js";

const asMap = (rows) => {
  const map = {};
  for (const row of rows) {
    const current = map[row.navId] || { view: false, add: false, edit: false };
    map[row.navId] = {
      view: current.view || Boolean(row.view),
      add: current.add || Boolean(row.add),
      edit: current.edit || Boolean(row.edit),
    };
  }
  return map;
};

const hasAccess = (perm) => Boolean(perm?.view || perm?.add || perm?.edit);

const permissionsFor = async (companyId, { designationId, designationName }) => {
  const byId = await caPermissionsRepository.listByDesignation(companyId, designationId);
  const byName = await caPermissionsRepository.listByDesignationName(companyId, designationName);
  return asMap([...byId, ...byName]);
};

export const caPermissionsService = {
  list: (companyId) => caPermissionsRepository.listByCompany(companyId),

  async mine(companyId, { isOwner, designationId, designationName }) {
    if (isOwner) {
      return {
        isOwner: true,
        designationId: null,
        permissions: {},
      };
    }

    return {
      isOwner: false,
      designationId: designationId ? String(designationId) : null,
      permissions: await permissionsFor(companyId, { designationId, designationName }),
    };
  },

  async save(companyId, permissions) {
    const rows = Array.isArray(permissions) ? permissions : [];
    return caPermissionsRepository.replaceAll(companyId, rows);
  },

  async assertAccess(companyId, { isOwner, designationId, designationName }, navId, action) {
    if (isOwner) {
      return true;
    }

    if (!navId) {
      return true;
    }

    const perm = (await permissionsFor(companyId, { designationId, designationName }))[navId] || {
      view: false,
      add: false,
      edit: false,
    };

    if (action === "add" && perm.add) {
      return true;
    }
    if (action === "edit" && perm.edit) {
      return true;
    }
    if ((action === "access" || action === "view") && hasAccess(perm)) {
      return true;
    }

    throw new AppError("You do not have permission for this action", 403, "FORBIDDEN");
  },
};
