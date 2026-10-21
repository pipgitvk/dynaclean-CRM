export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getMainSessionPayload } from "@/lib/auth";
import {
  listAllEmployeeRolesForUi,
  createCustomEmployeeRole,
  deleteCustomEmployeeRole,
  refreshRoleDashboardOverridesFromDb,
} from "@/lib/crmEmployeeRoles";

async function requireSuperAdmin() {
  const actor = await getMainSessionPayload();
  if (actor?.role !== "SUPERADMIN") {
    return null;
  }
  return actor;
}

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  try {
    await refreshRoleDashboardOverridesFromDb();
    const data = await listAllEmployeeRolesForUi();
    return NextResponse.json(data);
  } catch (e) {
    console.error("employee-roles GET:", e);
    return NextResponse.json({ message: "Failed to load roles." }, { status: 500 });
  }
}

export async function POST(req) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const created = await createCustomEmployeeRole({
      roleName: body?.roleName ?? body?.role_name,
      dashboardPath: body?.dashboardPath ?? body?.dashboard_path,
    });
    const data = await listAllEmployeeRolesForUi();
    return NextResponse.json({ ...data, created }, { status: 201 });
  } catch (e) {
    const msg = e?.message || "Failed to create role.";
    const status = msg.includes("already") || msg.includes("Invalid") ? 400 : 500;
    return NextResponse.json({ message: msg }, { status });
  }
}

export async function DELETE(req) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }
    await deleteCustomEmployeeRole(id);
    const data = await listAllEmployeeRolesForUi();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e?.message || "Failed to delete role.";
    const status =
      msg.includes("not found") || msg.includes("Cannot delete") ? 400 : 500;
    return NextResponse.json({ message: msg }, { status });
  }
}
