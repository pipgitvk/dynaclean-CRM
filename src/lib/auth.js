    // lib/auth.js
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";
const secret = new TextEncoder().encode(JWT_SECRET);

// Pin algorithm and claims so tokens minted by other services sharing the secret are rejected.
const SESSION_VERIFY_OPTIONS = {
  algorithms: ["HS256"],
  issuer: "dynaclean-crm",
  audience: "dynaclean-crm-web",
};

async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret, SESSION_VERIFY_OPTIONS);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieves and verifies the authentication token from cookies,
 * prioritizing the impersonation token.
 * @returns {object | null} The decoded payload of the token, or null if no valid token is found.
 */
export async function getSessionPayload() {
  const cookieStore = await cookies();
  const impersonationToken = cookieStore.get("impersonation_token")?.value;
  const mainToken = cookieStore.get("token")?.value;
  
  const token = impersonationToken || mainToken;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Only the main login JWT (`token` cookie), not `impersonation_token`.
 * Use for /api/admin/* when the real admin identity must authorize (e.g. attendance rules)
 * while the UI may still show the impersonated user elsewhere.
 */
export async function getMainSessionPayload() {
  const cookieStore = await cookies();
  const mainToken = cookieStore.get("token")?.value;
  if (!mainToken) {
    return null;
  }
  return verifySessionToken(mainToken);
}
