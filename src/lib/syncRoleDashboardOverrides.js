import fs from "fs/promises";
import path from "path";
import { normalizeEmployeeRoleName } from "@/lib/employeeRoles";

const OVERRIDES_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "role-dashboard-overrides.json",
);

/**
 * Writes custom role → dashboard map for Edge middleware (static JSON import).
 */
export async function syncRoleDashboardOverridesFile(rows) {
  const map = {};
  for (const row of rows || []) {
    const name = normalizeEmployeeRoleName(row.role_name ?? row.roleName);
    const dash = String(row.dashboard_path ?? row.dashboardPath ?? "").trim();
    if (!name || !dash) continue;
    map[name] = dash;
  }
  await fs.writeFile(OVERRIDES_PATH, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  return map;
}

export async function readRoleDashboardOverridesFile() {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
