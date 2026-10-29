import { getDbConnection } from "@/lib/db";
import { notFound } from "next/navigation";
import OrderDetailsClient from "./OrderDetailsClient";
import dayjs from "dayjs";
import { getSessionPayload } from "@/lib/auth";
import { isOrderVisibleToViewer } from "@/lib/orderApprovalVisibility";
import { roleShowsDualOrderAmountFields } from "@/lib/orderPaymentHistory";
import { attachActiveInvoiceFieldsToOrder } from "@/lib/activeInvoiceForOrder";
import { ensureOrderShipmentTrackingColumns } from "@/lib/ensureOrderShipmentTrackingColumns";
import { fetchBookingBatchesForOrder } from "@/lib/orderBookingBatches";
import {
  fetchDelhiveryLrForOrder,
  canViewOrderDelhiveryTracking,
  canViewReturnShipmentTracking,
} from "@/lib/resolveOrderDelhiveryLr";
import { persistOrderTrackingFromReturnBooking } from "@/lib/orderTrackingIdPersist";

export const dynamic = "force-dynamic";

function getOrderListPath(userRole) {
  const role = String(userRole || "").toUpperCase();
  if (role.includes("SALES")) return "/sales-dashboard/order";
  if (role.includes("ACCOUNTANT")) return "/accounts-dashboard/order";
  return "/user-dashboard/order";
}

async function fetchOrderData(
  orderId,
  { withOutboundTracking = false, withReturnTracking = false } = {},
) {
  const conn = await getDbConnection();
  const needTracking = withOutboundTracking || withReturnTracking;
  if (needTracking) {
    await ensureOrderShipmentTrackingColumns(conn);
  }

  const [orderRows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );

  if (orderRows.length === 0) return { orderDetails: null };

  let orderDetails = orderRows[0];
  orderDetails = await attachActiveInvoiceFieldsToOrder(conn, orderDetails);

  const returnBookingRef = String(orderDetails.return_booking_ref ?? "").trim();
  if (returnBookingRef) {
    try {
      await persistOrderTrackingFromReturnBooking(conn, orderDetails.order_id ?? orderId, {
        returnBookingRef,
        returnBookingUrl: orderDetails.return_booking_url,
      });
    } catch {
      /* non-fatal */
    }
  }

  const [items] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number],
  );

  const [statusRows] = await conn.execute(
    "SELECT sales_status, account_status, admin_status, dispatch_status, delivery_status, installation_status FROM neworder WHERE order_id = ?",
    [orderId],
  );

  const statuses = statusRows[0];

  // Fetch GSTIN + customer_id from quotations_records using quote_number
  let gstin = null;
  let quoteCustomerId = null;
  try {
    const [quoteRows] = await conn.execute(
      "SELECT gstin, customer_id FROM quotations_records WHERE quote_number = ? LIMIT 1",
      [orderDetails.quote_number],
    );
    gstin = quoteRows?.[0]?.gstin || null;
    quoteCustomerId = quoteRows?.[0]?.customer_id ?? null;
  } catch (_) {
    gstin = null;
  }

  // await conn.end();

  const bookingBatches =
    needTracking && orderDetails
      ? await fetchBookingBatchesForOrder(conn, orderId)
      : [];

  const delhiveryLr =
    withOutboundTracking && orderDetails
      ? await fetchDelhiveryLrForOrder(
          conn,
          orderDetails.order_id ?? orderId,
          orderDetails,
          bookingBatches,
          { shipmentKind: "outbound" },
        )
      : null;

  const returnDelhiveryLr =
    withReturnTracking && orderDetails
      ? await fetchDelhiveryLrForOrder(
          conn,
          orderDetails.order_id ?? orderId,
          orderDetails,
          bookingBatches,
          { shipmentKind: "return" },
        )
      : null;

  return {
    orderDetails,
    items,
    statuses,
    gstin,
    quoteCustomerId,
    delhiveryLr,
    returnDelhiveryLr,
  };
}

export default async function Page({ params }) {
  const { order_id } = await params;
  const orderId = String(order_id ?? "").trim();
  if (!orderId) notFound();

  const payload = await getSessionPayload();
  let orderListPath = "/user-dashboard/order";
  let canUploadDocuments = false;
  let showDualPaymentAmountFields = false;
  let userRole = payload?.role || payload?.userRole || "";
  let empRole = "";
  if (payload?.username) {
    const connAuth = await getDbConnection();
    const [roleRows] = await connAuth.execute(
      "SELECT userRole FROM rep_list WHERE username = ?",
      [payload.username],
    );
    userRole = roleRows[0]?.userRole || userRole;
    const [empRows] = await connAuth.execute(
      "SELECT userRole FROM emplist WHERE username = ?",
      [payload.username],
    );
    empRole = empRows[0]?.userRole || "";
    orderListPath = getOrderListPath(userRole);
    const roleUpper = String(userRole).toUpperCase();
    canUploadDocuments = roleUpper.includes("ACCOUNTANT");
    showDualPaymentAmountFields = roleShowsDualOrderAmountFields(userRole);
  }

  const roleCandidates = [userRole, empRole, payload?.role, payload?.userRole];
  const showOutboundTracking = canViewOrderDelhiveryTracking(...roleCandidates);
  const showReturnTracking = canViewReturnShipmentTracking(...roleCandidates);

  const {
    orderDetails,
    items,
    statuses,
    gstin,
    quoteCustomerId,
    delhiveryLr,
    returnDelhiveryLr,
  } = await fetchOrderData(orderId, {
    withOutboundTracking: showOutboundTracking,
    withReturnTracking: showReturnTracking,
  });

  if (
    !orderDetails ||
    !isOrderVisibleToViewer(orderDetails.approval_status, userRole)
  ) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">View Order by Quotation</h1>
      <div className="mb-4 space-y-2">
        <div>
          <span className="font-medium">Client Delivery Date: </span>
          <span>
            {orderDetails.client_delivery_date
              ? dayjs(orderDetails.client_delivery_date).format("DD-MM-YYYY")
              : "NA"}
          </span>
        </div>
        <div>
          <span className="font-medium">Expected Delivery Date: </span>
          <span>
            {orderDetails.delivery_date
              ? dayjs(orderDetails.delivery_date).format("DD-MM-YYYY")
              : "NA"}
          </span>
        </div>
      </div>
      <OrderDetailsClient
        orderDetails={orderDetails}
        items={items}
        statuses={statuses}
        orderId={orderId}
        gstin={gstin}
        quoteCustomerId={quoteCustomerId}
        orderListPath={orderListPath}
        canUploadDocuments={canUploadDocuments}
        showDualPaymentAmountFields={showDualPaymentAmountFields}
        delhiveryLr={delhiveryLr}
        returnDelhiveryLr={returnDelhiveryLr}
        showReturnTracking={showReturnTracking}
      />
    </div>
  );
}
