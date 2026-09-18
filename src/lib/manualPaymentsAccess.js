import { jwtVerify } from "jose";
import { getSessionPayload } from "@/lib/auth";
import { userHasManualPaymentsModuleAccess } from "@/lib/userModuleAccessServer";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function hasManualPaymentsAccess(username, role) {
  if (!username) return false;
  return userHasManualPaymentsModuleAccess(username, role);
}

/** Server page guard — returns session + module access flag. */
export async function getManualPaymentsPageAccess() {
  const payload = await getSessionPayload();
  if (!payload?.username) {
    return { payload: null, allowed: false };
  }
  const allowed = await hasManualPaymentsAccess(
    payload.username,
    payload.role ?? payload.userRole,
  );
  return { payload, allowed };
}

/** API route guard from request cookies. */
export async function verifyManualPaymentsApiAccess(req) {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    return { error: "Unauthorized", status: 401 };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET),
    );
    const username = payload.username || null;
    const role = payload.role || null;
    if (!username) {
      return { error: "Unauthorized", status: 401 };
    }

    const allowed = await hasManualPaymentsAccess(username, role);
    if (!allowed) {
      return { error: "Access denied", status: 403 };
    }

    return { username, role };
  } catch {
    return { error: "Invalid token", status: 401 };
  }
}
