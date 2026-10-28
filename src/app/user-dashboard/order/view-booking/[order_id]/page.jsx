import ViewOrderDetails from "./ViewOrderDetails";
import { notFound } from "next/navigation";
import { getViewBookingPageData } from "@/lib/getViewBookingPageData";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }) {
  const { order_id } = await params;
  const sp = await searchParams;
  const seq = sp?.seq ? String(sp.seq) : undefined;
  const data = await getViewBookingPageData(order_id, seq);
  if (!data) return notFound();
  return (
    <ViewOrderDetails
      data={data}
      orderBasePath="/user-dashboard/order"
    />
  );
}
