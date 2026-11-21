"use client";

import { useSearchParams } from "next/navigation";
import UpcomingInstallationsClient from "@/components/installation/UpcomingInstallationsClient";

export default function UpcomingInstallationsPage() {
  const searchParams = useSearchParams();
  const registrationFilter = searchParams.get("registration") || "";
  const showUnregisteredOnly = registrationFilter === "unregistered";
  const initialType = searchParams.get("type") || "products";

  return (
    <UpcomingInstallationsClient
      orderLinkBase="/user-dashboard"
      initialTypeFilter={showUnregisteredOnly ? "products" : initialType}
      registrationFilter={showUnregisteredOnly ? "unregistered" : ""}
      pageTitle={
        showUnregisteredOnly ? "Pending Product Registration" : "Upcoming Installations"
      }
      showTypeFilter={!showUnregisteredOnly}
    />
  );
}