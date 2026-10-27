import { getDbConnection } from "@/lib/db";
import { hasOrderInvoiceReport } from "@/lib/orderDocumentEditRules";
import { isBookingAllowedForOrder } from "@/lib/orderBookingEligibility";
import { isOrderVisibleToViewer } from "@/lib/orderApprovalVisibility";
import {
  canCreateFollowUpBooking,
  ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT,
  ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT,
  orderHasDispatchedStock,
} from "@/lib/orderDeliveryEligibility";

export { hasOrderInvoiceReport };

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
  const dispatchStatus = Number(order.dispatch_status);

  if (!booked && !isBookingAllowedForOrder(order)) {
    return {
      redirectToView: false,
      redirectToUploadReport: true,
      isEditMode: false,
      initialBooking: null,
    };
  }

  if (booked && dispatchStatus === 1) {
    return {
      redirectToView: true,
      redirectToUploadReport: false,
      isEditMode: false,
      initialBooking: null,
    };
  }

  if (canCreateFollowUpBooking(order)) {
    return {
      redirectToView: false,
      redirectToUploadReport: false,
      isEditMode: false,
      initialBooking: null,
    };
  }

  const wantsEditBooking =
    booked &&
    (dispatchStatus === 0 ||
      (dispatchStatus === 2 && !orderHasDispatchedStock(order)));

  if (wantsEditBooking) {
    if (!canEditOrderBooking(role)) {
      return {
        redirectToView: true,
        redirectToUploadReport: false,
        isEditMode: false,
        initialBooking: null,
      };
    }
    return {
      redirectToView: false,
      redirectToUploadReport: false,
      isEditMode: true,
      initialBooking: getInitialBookingValues(order),
    };
  }

  if (booked) {
    return {
      redirectToView: true,
      redirectToUploadReport: false,
      isEditMode: false,
      initialBooking: null,
    };
  }

  return {
    redirectToView: false,
    redirectToUploadReport: false,
    isEditMode: false,
    initialBooking: null,
  };
}

export async function getOrderForBookingUpload(
  orderId,
  viewerRole = "",
  username = "",
) {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    `SELECT
       no.order_id, no.client_name, no.contact, no.email, no.delivery_location, no.quote_number,
       no.client_delivery_date, no.booking_id, no.booking_date, no.booking_url, no.admin_remark,
       no.delivery_date, no.dispatch_status, no.report_file, no.approval_status,
       no.totalamt, no.baseAmount, no.taxamt,
       qr.grand_total AS quotation_grand_total,
       ${ORDER_LIST_DISPATCHED_STOCK_COUNT_SELECT},
       ${ORDER_LIST_PENDING_DISPATCH_UNITS_SELECT}
     FROM neworder no
     LEFT JOIN quotations_records qr ON qr.quote_number = no.quote_number
     WHERE no.order_id = ?`,
    [orderId],
  );
  const order = rows[0] || null;
  if (
    order &&
    !isOrderVisibleToViewer(order.approval_status, viewerRole, {
      order,
      username,
    })
  ) {
    return null;
  }
  return order;
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
