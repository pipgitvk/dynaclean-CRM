import ViewOrderDetails from "./ViewOrderDetails";
import { notFound } from "next/navigation";
import { getSessionPayload } from "@/lib/auth";
import { canEditOrderBooking } from "@/lib/getOrderForBookingUpload";
import { getViewBookingPageData } from "@/lib/getViewBookingPageData";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }) {
  const { order_id } = await params;
  const sp = await searchParams;
  const seq = sp?.seq ? String(sp.seq) : undefined;
  const data = await getViewBookingPageData(order_id, seq);
  if (!data) return notFound();

  const payload = await getSessionPayload();
  const canEditBooking = canEditOrderBooking(payload?.role ?? payload?.userRole);

  return (
    <ViewOrderDetails
      data={data}
      orderBasePath="/admin-dashboard/order"
      canEditBooking={canEditBooking && !seq}
    />
  );
}
