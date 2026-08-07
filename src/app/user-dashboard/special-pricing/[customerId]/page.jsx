import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import AddSpecialPriceModal from "@/components/specialPrice/AddSpecialPriceModal";
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

    // ✅ Fetch both products and spares from single table
    // spare_id is stored in product_id column, item_type differentiates them
    const [rowsResult] = await conn.execute(
      `
    SELECT 
      sp.id,
      sp.product_id,
      sp.item_type,
      sp.special_price,
      sp.status,
      sp.set_by,
      sp.approved_by,
      sp.set_date,
      sp.approved_date,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.item_name
        ELSE p.item_name
      END AS item_name,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.sale_price
        ELSE p.price_per_unit
      END AS price_per_unit,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.spare_number
        ELSE p.item_code
      END AS item_code,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.model
        ELSE p.product_number
      END AS product_number,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.image
        ELSE COALESCE(pi.image_path, p.product_image)
      END AS image_path,
      u.username AS set_by_name
    FROM special_price sp
    LEFT JOIN products_list p ON sp.item_type = 'product' AND sp.product_id = p.id
    LEFT JOIN spare_list sl ON sp.item_type = 'spare' AND sp.product_id = sl.id
    LEFT JOIN (
      SELECT item_code, MIN(image_path) AS image_path
      FROM product_images
      GROUP BY item_code
    ) pi ON sp.item_type = 'product' AND BINARY pi.item_code = BINARY p.item_code
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
          href={`/user-dashboard/view-customer/${customerId}`}
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
    href={`/user-dashboard/view-customer/${customerId}`}
    className="bg-yellow-600 text-white px-4 py-2 rounded">Back</Link>   
          <h1 className="text-2xl font-bold">
          Customer Special Prices
        </h1>
      
 
        </div>
         <AddSpecialPriceModal customerId={customerId} />
      
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

      {rows.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded">
          No special prices available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Image</th>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Product/Spare</th>
                <th className="p-3 text-left">Product No/Model</th>
                <th className="p-3 text-right">Original Price</th>
                <th className="p-3 text-right">Special Price</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-left">Set By</th>
                <th className="p-3 text-left">Set Date</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const imageUrl = row.image_path || null;
                const itemId = row.item_type === 'product' ? row.product_id : row.spare_id;

                return (
                  <tr key={`${row.item_type}-${row.id}`} className="hover:bg-gray-50">
                    {/* Type Badge */}
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        row.item_type === 'product' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {row.item_type === 'product' ? 'Product' : 'Spare'}
                      </span>
                    </td>

                    {/* Image */}
                    <td className="p-3">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt={row.item_name || "Item"}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No image</span>
                      )}
                    </td>

                    {/* Code */}
                    <td className="p-3 text-sm text-gray-700">
                      {row.item_code || "-"}
                    </td>

                    {/* Product/Spare Name */}
                    <td className="p-3">{row.item_name}</td>

                    {/* Product No / Model */}
                    <td className="p-3 text-sm text-gray-700">
                      {row.product_number || "-"}
                    </td>

                    {/* Original */}
                    <td className="p-3 text-right text-gray-500">
                      ₹ {row.price_per_unit}
                    </td>

                    {/* Special Price */}
                    <td className="p-3 text-right font-semibold text-green-600">
                      ₹ {row.special_price}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center">
                      {(() => {
                        const status = (row.status || "").toLowerCase();
                        const isApproved = status === "approved";
                        const isRejected = status === "rejected";
                        const badgeClass = isApproved
                          ? "bg-green-100 text-green-700"
                          : isRejected
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700";

                        const label = isApproved
                          ? "approved"
                          : isRejected
                          ? "rejected"
                          : "pending";

                        return (
                          <span
                            className={`px-3 py-1 text-xs rounded-full capitalize ${badgeClass}`}
                          >
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Set By */}
                    <td className="p-3">
                      {row.set_by_name || row.set_by}
                    </td>

                    {/* Set Date */}
                    <td className="p-3 text-sm text-gray-500">
                      {new Date(row.set_date).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      {row.status === "approved" ? (
                        <span className="text-xs text-gray-400">
                          Approved
                        </span>
                      ) : (
                        <Link
                          href={`/user-dashboard/special-pricing/${customerId}/${row.item_type}-${row.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
