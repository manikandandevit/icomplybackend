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

/**
 * Permissions of a designation in an establishment: that establishment's own
 * setting if saved, else the "all establishments" default. The same
 * designation name in another establishment no longer leaks in.
 */
const pickForEstablishment = (rows, establishmentId) => {
  const est = String(establishmentId || "");
  if (est && est !== "0" && est !== "all") {
    const own = rows.filter((r) => r.establishmentId === est);
    if (own.length) return own;
  }
  const defaults = rows.filter((r) => r.establishmentId === "all");
  if (defaults.length) return defaults;
  // No establishment known (e.g. admin users): fall back to any saved setting.
  return est && est !== "0" && est !== "all" ? [] : rows;
};

const permissionsFor = async (companyId, { designationId, designationName, establishmentId, employeeId }) => {
  let est = establishmentId;
  if (!est && employeeId) {
    est = await caPermissionsRepository.establishmentOfEmployee(companyId, employeeId);
  }
  let rows = await caPermissionsRepository.listByDesignation(companyId, designationId);
  if (!rows.length) {
    // Older records: designation matched by name only when the id has nothing.
    rows = await caPermissionsRepository.listByDesignationName(companyId, designationName);
  }
  return asMap(pickForEstablishment(rows, est));
};

const actorScope = (actor = {}) => ({
  designationId: actor.designationId,
  designationName: actor.designationName,
  establishmentId: actor.establishmentId,
  employeeId: actor.employeeId,
});

export const caPermissionsService = {
  list: (companyId) => caPermissionsRepository.listByCompany(companyId),

  async mine(companyId, { isOwner, designationId, designationName, allowedModules, departmentId, establishmentId, employeeId }) {
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
      permissions: await permissionsFor(companyId, { designationId, designationName, establishmentId, employeeId }),
    };
  },

  async save(companyId, permissions, designationId = null, establishmentId = null) {
    const rows = Array.isArray(permissions) ? permissions : [];
    return caPermissionsRepository.replaceAll(companyId, rows, designationId, establishmentId);
  },

  async getScope(companyId, actor = {}, navId) {
    if (actor.isOwner || actor.allowedModules?.includes("all")) {
      return "all";
    }
    const map = await permissionsFor(companyId, actorScope(actor));
    const perm = map[navId] || (navId === "religion" ? map["gender"] : undefined);
    return perm?.scope || "self";
  },

  async can(companyId, actor = {}, navId, action = "access") {
    if (actor.isOwner || actor.allowedModules?.includes("all")) {
      return true;
    }
    const map = await permissionsFor(companyId, actorScope(actor));
    const perm = map[navId] || (navId === "religion" ? map["gender"] : undefined);
    if (!perm) {
      if (navId === "religion") return true;
      return false;
    }

    if (action === "add") return Boolean(perm.add);
    if (action === "edit") return Boolean(perm.edit);
    if (action === "view" || action === "read") return Boolean(perm.view || perm.add || perm.edit);
    if (action === "write") return Boolean(perm.add || perm.edit);
    return Boolean(perm.view || perm.add || perm.edit);
  },

  async assertAccess(companyId, actor, navId, action) {
    const { isOwner, allowedModules } = actor || {};
    if (isOwner || allowedModules?.includes("all")) {
      return true;
    }

    const map = await permissionsFor(companyId, actorScope(actor));
    const perm = map[navId] || (navId === "religion" ? map["gender"] : undefined);

    if (!perm) {
      if (navId === "religion") return true;
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
