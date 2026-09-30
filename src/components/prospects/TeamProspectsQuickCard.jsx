"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import SummaryStatCard from "@/components/sales/SummaryStatCard";
import { getProspectSubmissionsPagePath } from "@/lib/prospectSubmissionPaths";

export default function TeamProspectsQuickCard() {
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const [title, setTitle] = useState("Team Prospects");
  const [href, setHref] = useState("/user-dashboard/prospect-submissions");

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/me");
        const me = meRes.ok ? await meRes.json() : {};
        const roleNorm = String(me.userRole || "").trim().toUpperCase();
        const isSuperAdmin = roleNorm === "SUPERADMIN";
        const isAdmin = roleNorm === "ADMIN";

        const res = await fetch(
          `/api/prospect-submissions?scope=${isSuperAdmin ? "all" : "team"}`,
        );
        const data = res.ok ? await res.json() : {};
        const canShow = !!data.hasReportees || isSuperAdmin || isAdmin;
        if (!canShow) {
          setVisible(false);
          return;
        }

        setVisible(true);
        setCount(Number(data.pendingCount || 0));
        setTitle(isSuperAdmin ? "All Prospect Submissions" : "Team Prospects");
        setHref(getProspectSubmissionsPagePath(me.userRole || ""));
      } catch {
        setVisible(false);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (!loading && !visible) return null;

  return (
    <SummaryStatCard
      href={href}
      label={title}
      count={count}
      suffix="Pending review"
      icon={Users}
      iconWrapClass="bg-violet-500"
      arrowClass="text-violet-500"
      loading={loading}
    />
  );
}
