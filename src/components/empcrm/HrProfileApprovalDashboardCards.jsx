"use client";

import { RefreshCcw, Shield } from "lucide-react";
import HrProfileApprovalStatCard from "@/components/empcrm/HrProfileApprovalStatCard";

export default function HrProfileApprovalDashboardCards() {
  return (
    <div className="flex flex-wrap gap-3">
      <HrProfileApprovalStatCard
        status="pending"
        tab="pending"
        title="Profile Approvals"
        subtitle="Pending"
        borderClass="border-teal-500"
        icon={Shield}
        iconClass="text-teal-500"
      />
      <HrProfileApprovalStatCard
        status="reassign"
        tab="reassign"
        title="Profile Reassign"
        subtitle="Reassign"
        borderClass="border-amber-500"
        icon={RefreshCcw}
        iconClass="text-amber-600"
      />
    </div>
  );
}
