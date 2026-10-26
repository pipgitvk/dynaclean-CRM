import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import {
  parseModuleAccess,
  applySuperadminOnlyModuleRestrictions,
  applyRoleDenyModuleRestrictions,
} from "@/lib/moduleAccess";
import { normalizeRoleKey } from "@/lib/adminAttendanceRulesAuth";

export async function GET() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = payload.role ?? payload.userRole ?? "GUEST";
  const roleKey = normalizeRoleKey(role) || "GUEST";
  const username = payload.username || null;

  // SUPERADMIN gets all modules
  if (roleKey === "SUPERADMIN") {
    return NextResponse.json({ allowedModules: null });
  }

  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      "SELECT module_access FROM rep_list WHERE username = ? LIMIT 1",
      [username]
    );

    if (!rows.length) {
      return NextResponse.json({ allowedModules: null });
    }

    let allowedModules = parseModuleAccess(rows[0].module_access ?? null);
    allowedModules = applySuperadminOnlyModuleRestrictions(allowedModules, roleKey);
    allowedModules = applyRoleDenyModuleRestrictions(allowedModules, roleKey);

    return NextResponse.json({ allowedModules });
  } catch {
    return NextResponse.json({ allowedModules: null });
  }
}
