import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import AddSpecialPriceModal from "@/components/specialPrice/AddSpecialPriceModal";
import RequestDealerPriceModal from "@/components/specialPrice/RequestDealerPriceModal";
import DeleteButton from "@/components/specialPrice/DeleteButton";
import CustomerSpecialPriceTable from "@/components/specialPrice/CustomerSpecialPriceTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomerSpecialPrice({ params }) {
  const { customerId } = await params;

  const payload = await getSessionPayload();
  if (!payload) return null;

  let conn;
  try {
    conn = await getDbConnection();
  } catch (dbErr) {
    console.error("[special-pricing] DB connection error:", dbErr);
    return (
      <div className="p-6 text-red-600">
        Database connection failed. Please try again later.
      </div>
    );
  }

  let customerInfo = null;
  let rows = [];

  try {
    // Fetch customer info for header strip
    const [customerRows] = await conn.execute(
      `SELECT customer_id, first_name, last_name, phone FROM customers WHERE customer_id = ? LIMIT 1`,
      [customerId],
    );

    customerInfo = customerRows.length
      ? {
          id: customerRows[0].customer_id,
          name: `${customerRows[0].first_name || ""} ${customerRows[0].last_name || ""}`.trim(),
          phone: customerRows[0].phone || "",
        }
      : null;

    const [rowsResult] = await conn.execute(
      `
    SELECT 
      sp.product_id,
      sp.special_price,
      sp.price_term,
      sp.status,
      sp.set_by,
      sp.approved_by,
      sp.set_date,
      sp.approved_date,
      p.item_name,
      p.price_per_unit,
      p.item_code,
      p.product_number,
      COALESCE(pi.image_path, NULL) AS image_path,
      p.product_image,
      u.username AS set_by_name
    FROM special_price sp
    LEFT JOIN products_list p ON sp.product_id = p.id
    LEFT JOIN (
      SELECT item_code, MIN(image_path) AS image_path
      FROM product_images
      GROUP BY item_code
    ) pi ON BINARY pi.item_code = BINARY p.item_code
    LEFT JOIN customers c ON sp.customer_id = c.customer_id
    LEFT JOIN rep_list u ON BINARY sp.set_by = BINARY u.username
    WHERE sp.customer_id = ?
    ORDER BY sp.set_date DESC
    `,
      [customerId]
    );
    rows = rowsResult;
  } catch (err) {
    console.error("[special-pricing] Query error:", err);
    return (
      <div className="p-6">
        <div className="text-red-600 font-medium mb-2">
          Failed to load special prices
        </div>
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
          {err?.message || String(err)}
        </pre>
        <Link
          href={`/admin-dashboard/view-customer/${customerId}`}
          className="inline-block mt-4 text-blue-600 hover:underline"
        >
          ← Back to customer
        </Link>
      </div>
    );
  }

  const maskedPhone =
    customerInfo && customerInfo.phone
      ? (() => {
          const raw = String(customerInfo.phone);
          if (raw.length <= 4) return raw;
          const last4 = raw.slice(-4);
          return `XXXX-XXXX-${last4}`;
        })()
      : "-";

  return (
    <div className="p-6">

      <div className="flex justify-between items-center mb-6">
        
        <div className="flex gap-3 items-center">
           <Link
    href={`/admin-dashboard/view-customer/${customerId}`}
    className="bg-yellow-600 text-white px-4 py-2 rounded">Back</Link>   
          <h1 className="text-2xl font-bold">
          Customer Special Prices
        </h1>
      
 
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <RequestDealerPriceModal customerId={customerId} />
          <AddSpecialPriceModal customerId={customerId} />
        </div>
      </div>

      {customerInfo && (
        <div className="mb-4 bg-white border rounded-lg p-4 text-sm text-gray-700">
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="font-semibold">Customer ID: </span>
              <span>{customerInfo.id}</span>
            </div>
            <div>
              <span className="font-semibold">Customer Name: </span>
              <span>{customerInfo.name || "-"}</span>
            </div>
            <div>
              <span className="font-semibold">Mobile: </span>
              <span>{maskedPhone}</span>
            </div>
          </div>
        </div>
      )}

      <CustomerSpecialPriceTable
        customerId={customerId}
        customerName={customerInfo?.name || ""}
        rows={rows.map((row) => ({
          ...row,
          set_date: row.set_date ? String(row.set_date) : null,
          approved_date: row.approved_date ? String(row.approved_date) : null,
        }))}
      />
    </div>
  );
}
