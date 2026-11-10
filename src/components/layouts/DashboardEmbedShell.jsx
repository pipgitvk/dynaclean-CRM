"use client";

import { UserProvider } from "@/context/UserContext";
import EmbedLightBackground from "@/components/embed/EmbedLightBackground";

/** Minimal chrome for iframe popups (`?embed=1`) — no sidebar or navbar. */
export default function DashboardEmbedShell({ children }) {
  return (
    <UserProvider>
      <EmbedLightBackground />
      <div className="min-h-0 min-w-0 w-full max-w-full bg-gray-50 text-gray-900">
        <main className="w-full min-w-0 max-w-full min-h-0 overflow-x-hidden overflow-y-auto p-2 sm:p-3">
          {children}
        </main>
      </div>
    </UserProvider>
  );
}
