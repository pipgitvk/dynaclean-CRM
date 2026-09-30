import UploadBookingForm from "@/components/orders/UploadBookingForm";
import {
  getOrderForBookingUpload,
  resolveBookingUploadPage,
} from "@/lib/getOrderForBookingUpload";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";

const ORDER_BASE = "/hr-dashboard/order";

export default async function UploadBookingPage({ params }) {
  const { order_id: orderId } = await params;
  const order = await getOrderForBookingUpload(orderId);

  if (!order) {
    return <div className="text-red-500 p-4">Order not found</div>;
  }

  const payload = await getSessionPayload();
  const ctx = resolveBookingUploadPage(
    order,
    payload?.role ?? payload?.userRole,
  );

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
