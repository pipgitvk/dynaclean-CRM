import UploadBookingForm from "@/components/orders/UploadBookingForm";
import {
  getOrderForBookingUpload,
  resolveBookingUploadPage,
} from "@/lib/getOrderForBookingUpload";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";

const ORDER_BASE = "/sales-dashboard/order";

export default async function UploadBookingPage({ params }) {
  const { order_id: orderId } = await params;
  const payload = await getSessionPayload();
  const viewerRole = payload?.role ?? payload?.userRole ?? "";
  const order = await getOrderForBookingUpload(orderId, viewerRole);

  if (!order) {
    return <div className="text-red-500 p-4">Order not found</div>;
  }
  const ctx = resolveBookingUploadPage(
    order,
    payload?.role ?? payload?.userRole,
  );

  if (ctx.redirectToUploadReport) {
    redirect(`${ORDER_BASE}/upload/${orderId}`);
  }

  if (ctx.redirectToView) {
    redirect(`${ORDER_BASE}/view-booking/${orderId}`);
  }

  return (
    <UploadBookingForm
      order={order}
      isEditMode={ctx.isEditMode}
      redirectPath={ORDER_BASE}
      initialBooking={ctx.initialBooking}
    />
  );
}
