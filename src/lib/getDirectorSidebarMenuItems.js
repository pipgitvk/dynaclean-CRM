// lib/getDirectorSidebarMenuItems.js
import { getSessionPayload } from "./auth";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";
import {
  parseModuleAccess,
  isSectionAllowed,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
  SUPERADMIN_ONLY_MODULE_KEYS,
} from "@/lib/moduleAccess";
import { getDbConnection } from "@/lib/db";

function stripSuperadminOnlyMenuItems(items, roleKey) {
  if (roleKey === "SUPERADMIN") return items;
  return (items || [])
    .map((item) => {
      if (item?.moduleKey && SUPERADMIN_ONLY_MODULE_KEYS.has(item.moduleKey)) {
        return null;
      }
      if (item?.children?.length) {
        return { ...item, children: stripSuperadminOnlyMenuItems(item.children, roleKey) };
      }
      return item;
    })
    .filter(Boolean);
}

function roleMatches(itemRoles, roleKey) {
  const roles = Array.isArray(itemRoles) && itemRoles.length > 0 ? itemRoles : ["ALL"];
  const norm = (r) => normalizeRoleKey(r) || String(r || "").trim().toUpperCase();
  const wanted = norm(roleKey);
  return roles.some((r) => {
    const rr = norm(r);
    return rr === "ALL" || rr === wanted;
  });
}

function filterByRole(list, roleKey) {
  return (list || [])
    .map((item) => {
      const children = item?.children?.length ? filterByRole(item.children, roleKey) : [];
      const keepSelf = roleMatches(item?.roles, roleKey);
      if (children.length > 0) return { ...item, children };
      return keepSelf ? item : null;
    })
    .filter(Boolean);
}

const allMenuItems = [
  {
    path: "/director-dashboard",
    name: "Dashboard",
    moduleKey: "dashboard-home",
    roles: ["ALL"],
    icon: "LayoutGrid",
  },
  {
    path: "/director-dashboard/task-manager",
    name: "Task Manager",
    moduleKey: "task-manager",
    roles: ["ALL"],
    icon: "ClipboardList",
  },
  {
    path: "/director-dashboard/product-stock",
    name: "Product Stock",
    moduleKey: "product-stock",
    roles: ["ALL"],
    icon: "Box",
  },
  {
    path: "/director-dashboard/spare",
    name: "Spare Parts",
    moduleKey: "spare-parts",
    roles: ["ALL"],
    icon: "Wrench",
  },
  {
    path: "/director-dashboard/all-expenses",
    name: "All Expenses",
    moduleKey: "view-expenses",
    roles: ["ALL"],
    icon: "DollarSign",
  },
  {
    path: "/director-dashboard/purchase/purchases",
    name: "Purchases",
    moduleKey: "purchases",
    roles: ["ALL"],
    icon: "ShoppingBag",
  },
  {
    path: "/director-dashboard/spare/purchase/purchases",
    name: "Spare Purchases",
    moduleKey: "spare-purchases",
    roles: ["ALL"],
    icon: "Package",
  },
  {
    path: "/director-dashboard/view_service_reports",
    name: "Service Reports",
    moduleKey: "service-reports",
    roles: ["ALL"],
    icon: "FileText",
  },
];

async function getUserModuleAccess(username) {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      "SELECT module_access FROM rep_list WHERE username = ? LIMIT 1",
      [username],
    );
    if (!rows.length) return null;
    return parseModuleAccess(rows[0].module_access ?? null);
  } catch {
    return null;
  }
}

export default async function getDirectorSidebarMenuItems() {
  const payload = await getSessionPayload();
  const role = (payload?.role ?? payload?.userRole) || "GUEST";
  const roleKey = normalizeRoleKey(role) || "GUEST";
  const username = payload?.username || null;

  let items = allMenuItems;

  // Step 1: filter by role
  items = filterByRole(items, roleKey);

  // Hard deny SUPERADMIN-only modules even when module_access is NULL (backward compat).
  items = stripSuperadminOnlyMenuItems(items, roleKey);

  // Step 2: filter by module_access - DISABLED for Director role to show all items
  // const allowedModulesRaw = await getUserModuleAccess(username);
  // const allowedModules1 = applySuperadminOnlyModuleRestrictions(
  //   allowedModulesRaw,
  //   roleKey,
  // );
  // const allowedModules2 = applyRoleDenyModuleRestrictions(allowedModules1, roleKey);
  // const allowedModules = allowedModules2;

  // if (allowedModules !== null) {
  //   const filterByModuleAccess = (list) =>
  //     (list || [])
  //       .map((item) => {
  //         const children = item?.children?.length
  //           ? filterByModuleAccess(item.children)
  //           : [];
  //         const allowed = item?.moduleKey
  //           ? isSectionAllowed(item.moduleKey, allowedModules)
  //           : item?.path
  //             ? false
  //             : true;
  //         if (children.length > 0) return { ...item, children };
  //         return allowed ? item : null;
  //       })
  //       .filter(Boolean);
  //   items = filterByModuleAccess(items);
  // }

  return items;
}
