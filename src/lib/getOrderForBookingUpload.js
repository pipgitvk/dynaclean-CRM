import { getDbConnection } from "@/lib/db";

export function formatDateForInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function hasOrderBooking(order) {
  return (
    order?.booking_id !== undefined &&
    order?.booking_id !== null &&
    String(order.booking_id).trim() !== "" &&
    String(order.booking_id) !== "0"
  );
}

/** Only ADMIN and SUPERADMIN may edit an existing booking (before dispatch). */
export function canEditOrderBooking(role) {
  const normalized = String(role ?? "").trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "SUPERADMIN";
}

export function resolveBookingUploadPage(order, role) {
  const booked = hasOrderBooking(order);
  const dispatched = Number(order.dispatch_status) === 1;

  if (booked && dispatched) {
    return { redirectToView: true, isEditMode: false, initialBooking: null };
  }

  const isEditMode = booked && !dispatched;
  if (isEditMode && !canEditOrderBooking(role)) {
    return { redirectToView: true, isEditMode: false, initialBooking: null };
  }

  return {
    redirectToView: false,
    isEditMode,
    initialBooking: isEditMode ? getInitialBookingValues(order) : null,
  };
}

export async function getOrderForBookingUpload(orderId) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT order_id, client_name, contact, email, delivery_location, quote_number,
            client_delivery_date, booking_id, booking_date, booking_url, admin_remark,
            delivery_date, dispatch_status
     FROM neworder WHERE order_id = ?`,
    [orderId],
  );
  return rows[0] || null;
}

export function getInitialBookingValues(order) {
  if (!hasOrderBooking(order)) return null;
  return {
    booking_id: order.booking_id || "",
    booking_date: formatDateForInput(order.booking_date),
    expected_delivery_date: formatDateForInput(order.delivery_date),
    booking_url: order.booking_url || "",
    adminremark: order.admin_remark || "",
  };
}
