import UpcomingInstallationsClient from "@/components/installation/UpcomingInstallationsClient";

export default function UpcomingInstallationsPage() {
  return (
    <UpcomingInstallationsClient
      orderLinkBase="/admin-dashboard"
      productsOnly
      showTypeFilter={false}
      initialTypeFilter="products"
    />
  );
}