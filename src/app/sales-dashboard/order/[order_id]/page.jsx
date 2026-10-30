import { getDbConnection } from "@/lib/db";
import { notFound } from "next/navigation";
import OrderDetailsClient from "./OrderDetailsClient";
import dayjs from "dayjs";
import { getSessionPayload } from "@/lib/auth";
import { isOrderVisibleToViewer } from "@/lib/orderApprovalVisibility";
import { attachActiveInvoiceFieldsToOrder } from "@/lib/activeInvoiceForOrder";
import { fetchOrderDelhiveryLrs } from "@/lib/fetchOrderDelhiveryLrs";

export const dynamic = "force-dynamic";

async function fetchOrderData(orderId) {
  const conn = await getDbConnection();

  const [orderRows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId],
  );

  if (orderRows.length === 0) return { orderDetails: null };

  let orderDetails = orderRows[0];
  orderDetails = await attachActiveInvoiceFieldsToOrder(conn, orderDetails);

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

  const { delhiveryLr, returnDelhiveryLr } = await fetchOrderDelhiveryLrs(
    conn,
    orderId,
    orderDetails,
  );

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
  const orderId = parseInt(order_id);
  if (isNaN(orderId)) notFound();

  const payload = await getSessionPayload();
  let userRole = payload?.role || payload?.userRole || "";
  if (payload?.username) {
    const connAuth = await getDbConnection();
    const [roleRows] = await connAuth.execute(
      "SELECT userRole FROM rep_list WHERE username = ?",
      [payload.username],
    );
    userRole = roleRows[0]?.userRole || userRole;
  }

  const { orderDetails, items, statuses, gstin, quoteCustomerId, delhiveryLr, returnDelhiveryLr } =
    await fetchOrderData(orderId);

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
        delhiveryLr={delhiveryLr}
        returnDelhiveryLr={returnDelhiveryLr}
      />
    </div>
  );
}
