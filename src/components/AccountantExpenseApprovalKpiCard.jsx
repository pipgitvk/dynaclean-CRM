"use client";

import ServiceBeforeInstallationKpiCard from "@/components/ServiceBeforeInstallation/ServiceBeforeInstallationKpiCard";
import { SERVICE_BEFORE_INSTALLATION_HUB_EXTRA_CARDS } from "@/lib/serviceBeforeInstallationHub";

const EXPENSE_CARD_META =
  SERVICE_BEFORE_INSTALLATION_HUB_EXTRA_CARDS.find(
    (c) => c.id === "expense-approval-dashboard",
  ) || SERVICE_BEFORE_INSTALLATION_HUB_EXTRA_CARDS[0];

export default function AccountantExpenseApprovalKpiCard({ count = 0 }) {
  const card = {
    ...EXPENSE_CARD_META,
    title: "Expense Approval",
    countCaption: "Pending statement link · from 10-05-2026",
    href:
      "/accounts-dashboard/service-before-installation/expense-approval-dashboard?bucket=pending_linked_statements",
  };

  return (
    <div className="w-full max-w-[15rem] sm:max-w-[16.5rem]">
      <ServiceBeforeInstallationKpiCard
        card={card}
        total={count}
        changePct={null}
        loading={false}
        showTrend={false}
        variant="compact"
        className="!min-h-[7.25rem] sm:!min-h-[7.5rem]"
      />
    </div>
  );
}