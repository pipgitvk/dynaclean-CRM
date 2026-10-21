import { redirect } from "next/navigation";

export default function SparesNewRedirectPage() {
  redirect("/admin-dashboard/products-new?tab=spares");
}
