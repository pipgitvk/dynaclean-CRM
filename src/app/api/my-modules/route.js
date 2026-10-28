import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getEffectiveAllowedModuleKeys } from "@/lib/userModuleAccessServer";

export async function GET() {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = payload.role ?? payload.userRole ?? "GUEST";
  const username = payload.username || null;

  const allowedModules = await getEffectiveAllowedModuleKeys(username, role);

  return NextResponse.json({ allowedModules });
}
