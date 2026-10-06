import { getSessionPayload } from "@/lib/auth";
import { getEngineerIdFromPayload, isThirdPartyEngineerSession } from "@/lib/thirdPartyEngineerPortalSession";

export async function requireThirdPartyEngineerPortalSession() {
  const payload = await getSessionPayload();
  if (!payload || !isThirdPartyEngineerSession(payload)) {
    return { ok: false, status: 401, error: "Unauthorized", payload: null, engineerId: null };
  }
  const engineerId = getEngineerIdFromPayload(payload);
  if (!engineerId) {
    return { ok: false, status: 401, error: "Invalid session", payload: null, engineerId: null };
  }
  return { ok: true, payload, engineerId };
}
