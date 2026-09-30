"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isDashboardHomePath, getProspectSubmissionsPagePath } from "@/lib/prospectSubmissionPaths";
import { ProspectReviewDashboardCard } from "./ProspectSubmissionsDashboardCard";

export default function ProspectDashboardWidget() {
  const pathname = usePathname();
  const [meta, setMeta] = useState({
    hasReportees: false,
    pendingCount: 0,
    userRole: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isDashboardHomePath(pathname)) return;

    const load = async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = meRes.ok ? await meRes.json() : {};
        const roleNorm = String(me.userRole || "").trim().toUpperCase();
        const isSuperAdminUser = roleNorm === "SUPERADMIN";

        const teamRes = await fetch(
          `/api/prospect-submissions?scope=${isSuperAdminUser ? "all" : "team"}`,
        );
        const team = teamRes.ok ? await teamRes.json() : {};
        setMeta({
          hasReportees: !!team.hasReportees,
          pendingCount: Number(team.pendingCount || 0),
          userRole: me.userRole || "",
        });
      } catch {
        setMeta({ hasReportees: false, pendingCount: 0, userRole: "" });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [pathname]);

  if (!isDashboardHomePath(pathname)) return null;

  const reviewPath = getProspectSubmissionsPagePath(meta.userRole);
  const roleNorm = String(meta.userRole || "").trim().toUpperCase();
  const isSuperAdmin = roleNorm === "SUPERADMIN";
  const canReviewSubmissions = meta.hasReportees || isSuperAdmin || roleNorm === "ADMIN";

  // Add Prospect card removed from all dashboards — use header icon instead.
  // Only show review card for managers / admin / superadmin.
  if (!canReviewSubmissions) return null;

  return (
    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <ProspectReviewDashboardCard
        href={reviewPath}
        title={isSuperAdmin ? "All Prospect Submissions" : "Team Prospects"}
        count={meta.pendingCount}
        loading={loading}
      />
    </div>
  );
}
