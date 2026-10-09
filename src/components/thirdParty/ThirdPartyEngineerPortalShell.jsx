"use client";

import { useRouter } from "next/navigation";
import HeaderLogoutButton from "@/components/HeaderLogoutButton";

export default function ThirdPartyEngineerPortalShell({ children, title }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (_) {}
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              DynaClean CRM
            </p>
            <h1 className="text-lg font-bold text-slate-900">{title || "Third Party Engineer"}</h1>
          </div>
          <HeaderLogoutButton onClick={handleLogout} variant="sales" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
