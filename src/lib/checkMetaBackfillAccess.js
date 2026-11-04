import { NextResponse } from "next/server";
import { getSessionPayload, getMainSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { userHasModuleKey } from "@/lib/userModuleAccessServer";

/**
 * Meta Leads Backfill APIs: SUPERADMIN/ADMIN, or users with meta-backfill module
 * (e.g. Sales cum Backoffice on /sales-dashboard/ads-management).
 */
export async function checkMetaBackfillAccess() {
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

  if (roleKey === "SUPERADMIN" || roleKey === "ADMIN") {
    return { allowed: true, payload, forbidden: null };
  }

  const hasModule = await userHasModuleKey(
    payload.username,
    effectiveRole,
    "meta-backfill",
  );

  if (hasModule) {
    return { allowed: true, payload, forbidden: null };
  }

  return {
    allowed: false,
    payload,
    forbidden: NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 },
    ),
  };
}
