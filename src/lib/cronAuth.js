import { getMainSessionPayload, getSessionPayload } from "@/lib/auth";

/**
 * For /api/cron/* routes called by Vercel/external cron OR admin dashboard "Test".
 * - No CRON_SECRET in env → allow (dev / open).
 * - CRON_SECRET set → allow if ?secret= or Bearer matches, or cookies show ADMIN/SUPERADMIN
 *   (main JWT first so impersonation still counts as admin).
 */
export async function isCronRequestAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!cronSecret) {
    return true;
  }
  if (secret === cronSecret || bearerToken === cronSecret) {
    return true;
  }

  const main = await getMainSessionPayload();
  const session = await getSessionPayload();
  const role = (main?.role ?? session?.role ?? "").toUpperCase();
  return ["ADMIN", "SUPERADMIN"].includes(role);
}
