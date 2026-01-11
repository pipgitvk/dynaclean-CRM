import { getDbConnection } from "@/lib/db";
import { notFound } from "next/navigation";
import OrderDetailsClient from "./OrderDetailsClient";
import dayjs from "dayjs";

export const dynamic = "force-dynamic";

async function fetchOrderData(orderId) {
  const conn = await getDbConnection();

  const [orderRows] = await conn.execute(
    "SELECT * FROM neworder WHERE order_id = ?",
    [orderId]
  );

  if (orderRows.length === 0) return { orderDetails: null };

  const orderDetails = orderRows[0];

  const [items] = await conn.execute(
    "SELECT * FROM quotation_items WHERE quote_number = ?",
    [orderDetails.quote_number]
  );

  const [statusRows] = await conn.execute(
    "SELECT sales_status, account_status, admin_status, dispatch_status, delivery_status, installation_status FROM neworder WHERE order_id = ?",
    [orderId]
  );

  const statuses = statusRows[0];

  // Fetch GSTIN from quotations_records using quote_number
  let gstin = null;
  try {
    const [quoteRows] = await conn.execute(
      "SELECT gstin FROM quotations_records WHERE quote_number = ?",
      [orderDetails.quote_number]
    );
    gstin = quoteRows?.[0]?.gstin || null;
  } catch (_) {
    gstin = null;
  }

  // await conn.end();

  return {
    orderDetails,
    items,
    statuses,
    gstin,
  };
}

export default async function Page({ params }) {
  const orderId = parseInt(params.order_id);
  if (isNaN(orderId)) notFound();

  const { orderDetails, items, statuses, gstin } = await fetchOrderData(orderId);

  if (!orderDetails) {
    return (
      <div className="p-8 text-center text-red-600 text-xl">
        ❌ Order not found or invalid ID.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">View Order by Quotation</h1>
      <div className="mb-4 space-y-2">
        <div>
          <span className="font-medium">Client Delivery Date: </span>
          <span>
            {orderDetails.client_delivery_date
              ? dayjs(orderDetails.client_delivery_date).format("DD/MM/YYYY")
              : "NA"}
          </span>
        </div>
        <div>
          <span className="font-medium">Expected Delivery Date: </span>
          <span>
            {orderDetails.delivery_date
              ? dayjs(orderDetails.delivery_date).format("DD/MM/YYYY")
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
      />
    </div>
  );
}
