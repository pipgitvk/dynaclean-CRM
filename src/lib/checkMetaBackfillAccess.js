import { NextResponse } from "next/server";
import { getSessionPayload, getMainSessionPayload } from "@/lib/auth";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import { userHasModuleKey } from "@/lib/userModuleAccessServer";

/**
 * Meta Leads Backfill APIs — same rules for /admin-dashboard/ads-management and
 * /sales-dashboard/ads-management (shared page + leads-report APIs).
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

  if (
    roleKey === "SUPERADMIN" ||
    roleKey === "ADMIN" ||
    roleKey === "DIRECTOR" ||
    roleKey === "SALES CUM BACKOFFICE"
  ) {
    return { allowed: true, payload, forbidden: null };
  }

  const hasMetaBackfill = await userHasModuleKey(
    payload.username,
    effectiveRole,
    "meta-backfill",
  );
  const hasAdsManagement = await userHasModuleKey(
    payload.username,
    effectiveRole,
    "ads-management",
  );

  if (hasMetaBackfill || hasAdsManagement) {
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
