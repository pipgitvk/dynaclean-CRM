// app/user-dashboard/ImpersonationWrapper.jsx
"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { jwtVerify } from "jose";
import ExitImpersonation from "@/components/ExitImpersonation";

// Make sure your JWT_SECRET is available publicly
// e.g., in .env.local as NEXT_PUBLIC_JWT_SECRET
const JWT_SECRET = process.env.NEXT_PUBLIC_JWT_SECRET;
const secret = new TextEncoder().encode(JWT_SECRET);

export default function ImpersonationWrapper({ children }) {
  const [impersonatedUsername, setImpersonatedUsername] = useState(null);

  useEffect(() => {
    async function verifyToken() {
      // ✅ Make this function async
      const impersonationToken = Cookies.get("impersonation_token");

      if (impersonationToken) {
        try {
          // ✅ Use await with jwtVerify
          const { payload } = await jwtVerify(impersonationToken, secret);
          setImpersonatedUsername(payload.username);
        } catch (error) {
          console.error("Failed to verify impersonation token:", error);
          Cookies.remove("impersonation_token");
        }
      }
    }

    verifyToken(); // ✅ Call the async function
  }, []); // The empty array ensures this runs only once on component mount

  return (
    <>
      {impersonatedUsername && (
        <ExitImpersonation username={impersonatedUsername} />
      )}
      {children}
    </>
  );
}
