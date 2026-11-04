import { NextResponse } from "next/server";
import { getSessionPayload, getMainSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

export async function checkLeadDistributionAccess() {
  const main = await getMainSessionPayload();
  const session = await getSessionPayload();
  const payload = main ?? session;
  const effectiveRole = main?.role ?? session?.role ?? payload?.role;

  if (!payload?.username) {
    return {
      allowed: false,
      payload: null,
      forbidden: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const roleKey =
    normalizeRoleKey(effectiveRole) || String(effectiveRole || "").trim().toUpperCase();

  if (
    roleKey === "SUPERADMIN" ||
    roleKey === "ADMIN" ||
    roleKey === "DIRECTOR" ||
    roleKey === "SALES CUM BACKOFFICE"
  ) {
    return { allowed: true, payload, forbidden: null };
  }

  return {
    allowed: false,
    payload,
    forbidden: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  };
}
