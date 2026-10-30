import { ensureOrderShipmentTrackingColumns } from "@/lib/ensureOrderShipmentTrackingColumns";
import { fetchBookingBatchesForOrder } from "@/lib/orderBookingBatches";
import { fetchDelhiveryLrForOrder } from "@/lib/resolveOrderDelhiveryLr";
import { persistOrderTrackingFromReturnBooking } from "@/lib/orderTrackingIdPersist";

/** Resolve outbound + return Delhivery LRs for an order detail page. */
export async function fetchOrderDelhiveryLrs(conn, orderId, orderDetails) {
  if (!orderDetails) {
    return { delhiveryLr: null, returnDelhiveryLr: null };
  }

  await ensureOrderShipmentTrackingColumns(conn);

  const oid = orderDetails.order_id ?? orderId;
  const returnBookingRef = String(orderDetails.return_booking_ref ?? "").trim();
  if (returnBookingRef) {
    try {
      await persistOrderTrackingFromReturnBooking(conn, oid, {
        returnBookingRef,
        returnBookingUrl: orderDetails.return_booking_url,
      });
    } catch {
      /* non-fatal */
    }
  }

  const bookingBatches = await fetchBookingBatchesForOrder(conn, oid);

  const delhiveryLr = await fetchDelhiveryLrForOrder(
    conn,
    oid,
    orderDetails,
    bookingBatches,
    { shipmentKind: "outbound" },
  );

  const returnDelhiveryLr = await fetchDelhiveryLrForOrder(
    conn,
    oid,
    orderDetails,
    bookingBatches,
    { shipmentKind: "return" },
  );

  return { delhiveryLr, returnDelhiveryLr };
}
