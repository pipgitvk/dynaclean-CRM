"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Checks every 30 seconds whether the current user's IP is still allowed.
// If not, logs them out and redirects to the login page.
export default function IpGuard() {
  const router = useRouter();

  useEffect(() => {
    const checkIp = async () => {
      try {
        const res = await fetch("/api/check-session-ip", { cache: "no-store" });

        if (res.status === 403) {
          // IP is no longer allowed — force logout
          await fetch("/api/logout", { method: "POST" });
          window.location.href = "/login?reason=ip_blocked";
        }
      } catch {
        // Ignore network errors — don't lock out on connectivity issues
      }
    };

    // Run immediately on mount, then every 30 seconds
    checkIp();
    const interval = setInterval(checkIp, 30_000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
