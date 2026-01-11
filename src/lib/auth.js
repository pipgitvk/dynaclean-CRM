    // lib/auth.js
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";
const secret = new TextEncoder().encode(JWT_SECRET);

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

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}