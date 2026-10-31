import { AppError } from "../../core/errors/AppError.js";
import { MODULE_NAV_MAP } from "./caPermissions.constants.js";
import { caPermissionsRepository } from "./caPermissions.repository.js";

const asMap = (rows) => {
  const map = {};
  for (const row of rows) {
    const current = map[row.navId] || { view: false, add: false, edit: false, scope: "self" };
    map[row.navId] = {
      view: current.view || Boolean(row.view),
      add: current.add || Boolean(row.add),
      edit: current.edit || Boolean(row.edit),
      scope: row.scope || current.scope || "self",
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

  async mine(companyId, { isOwner, designationId, designationName, allowedModules, departmentId }) {
    if (isOwner || allowedModules?.includes("all")) {
      return {
        isOwner: true,
        allowedModules: ["all"],
        designationId: null,
        departmentId: null,
        permissions: {},
      };
    }

    if (Array.isArray(allowedModules) && allowedModules.length > 0 && !allowedModules.includes("all")) {
      const modulePerms = {};
      for (const mod of allowedModules) {
        const navList = MODULE_NAV_MAP[mod] || [];
        for (const navId of navList) {
          modulePerms[navId] = { view: true, add: true, edit: true, scope: "all" };
        }
      }
      return {
        isOwner: false,
        allowedModules,
        designationId: designationId ? String(designationId) : null,
        departmentId: departmentId ? String(departmentId) : null,
        permissions: modulePerms,
      };
    }

    return {
      isOwner: false,
      allowedModules: [],
      designationId: designationId ? String(designationId) : null,
      departmentId: departmentId ? String(departmentId) : null,
      permissions: await permissionsFor(companyId, { designationId, designationName }),
    };
  },

  async save(companyId, permissions, designationId = null) {
    const rows = Array.isArray(permissions) ? permissions : [];
    return caPermissionsRepository.replaceAll(companyId, rows, designationId);
  },

  async getScope(companyId, actor = {}, navId) {
    if (actor.isOwner || actor.allowedModules?.includes("all")) {
      return "all";
    }
    const map = await permissionsFor(companyId, {
      designationId: actor.designationId,
      designationName: actor.designationName,
    });
    const perm = map[navId];
    return perm?.scope || "self";
  },

  async can(companyId, actor = {}, navId, action = "access") {
    if (actor.isOwner || actor.allowedModules?.includes("all")) {
      return true;
    }
    const map = await permissionsFor(companyId, {
      designationId: actor.designationId,
      designationName: actor.designationName,
    });
    const perm = map[navId];
    if (!perm) return false;

    if (action === "add") return Boolean(perm.add);
    if (action === "edit") return Boolean(perm.edit);
    if (action === "view" || action === "read") return Boolean(perm.view || perm.add || perm.edit);
    if (action === "write") return Boolean(perm.add || perm.edit);
    return Boolean(perm.view || perm.add || perm.edit);
  },

  async assertAccess(companyId, { isOwner, designationId, designationName, allowedModules }, navId, action) {
    if (isOwner || allowedModules?.includes("all")) {
      return true;
    }

    const map = await permissionsFor(companyId, { designationId, designationName });
    const perm = map[navId];

    if (!perm) {
      // Baseline fallback for common employee self-service tabs
      const baselineSelfNavs = new Set(["dashboard", "profile", "attendance", "leave", "leave-apply", "revokes", "revoke-apply"]);
      if (baselineSelfNavs.has(navId) && action !== "edit") {
        return true;
      }
      throw new AppError("Access denied for this resource", 403, "ACCESS_DENIED");
    }

    if (action === "add" && !perm.add) {
      throw new AppError("Access denied: You do not have permission to create this resource", 403, "ACCESS_DENIED");
    }

    if (action === "edit" && !perm.edit) {
      throw new AppError("Access denied: You do not have permission to modify or approve this resource", 403, "ACCESS_DENIED");
    }

    if ((action === "read" || action === "view") && !hasAccess(perm)) {
      throw new AppError("Access denied for this resource", 403, "ACCESS_DENIED");
    }

    if (action === "write" && !perm.add && !perm.edit) {
      throw new AppError("Access denied for this resource", 403, "ACCESS_DENIED");
    }

    if (action === "access" && !hasAccess(perm)) {
      throw new AppError("Access denied for this resource", 403, "ACCESS_DENIED");
    }

    return true;
  },
};
