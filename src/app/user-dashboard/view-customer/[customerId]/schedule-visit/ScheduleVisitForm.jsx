"use client";

import { useRouter } from "next/navigation";
import ScheduleVisitForm from "@/components/scheduleVisit/ScheduleVisitForm";

export default function PageScheduleVisitForm({
  customerId,
  customerName,
  contact,
  address,
  dashboardPrefix = "user-dashboard",
}) {
  const router = useRouter();

  return (
    <ScheduleVisitForm
      customerId={customerId}
      customerName={customerName}
      contact={contact}
      address={address}
      onSuccess={() => router.push(`/${dashboardPrefix}/view-customer/${customerId}`)}
    />
  );
}
