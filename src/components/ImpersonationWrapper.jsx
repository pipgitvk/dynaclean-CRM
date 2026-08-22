"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { jwtVerify } from "jose";
import ExitImpersonation from "@/components/ExitImpersonation";

const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET;
const secret = new TextEncoder().encode(JWT_SECRET);

export default function ImpersonationWrapper({ children }) {
  const [impersonatedUsername, setImpersonatedUsername] = useState(null);

  useEffect(() => {
    async function verifyToken() {
      const impersonationToken = Cookies.get("impersonation_token");

      if (impersonationToken) {
        try {
          const { payload } = await jwtVerify(impersonationToken, secret);
          setImpersonatedUsername(payload.username);
        } catch (error) {
          console.error("Failed to verify impersonation token:", error);
          Cookies.remove("impersonation_token");
        }
      }
    }

    verifyToken();
  }, []);

  return (
    <>
      {impersonatedUsername && (
        <ExitImpersonation username={impersonatedUsername} />
      )}
      {children}
    </>
  );
}
