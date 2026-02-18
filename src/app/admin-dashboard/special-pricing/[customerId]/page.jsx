import Link from "next/link";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerSpecialPrice({ params }) {
  const { customerId } = await params;

  const payload = await getSessionPayload();
  console.log("Hello Payload",payload);
  
  if (!payload) return null;

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `
    SELECT 
      sp.special_price,
      p.item_name,
      p.price_per_unit
    FROM special_price sp
    LEFT JOIN products_list p ON sp.product_id = p.id
    WHERE sp.customer_id = ?
    ORDER BY sp.set_date DESC
    `,
    [Number(customerId)]
  );

  return (
    <div className="p-6">

      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Customer Special Prices
        </h1>

        <Link
          href="/admin-dashboard/special-pricing"
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition"
        >
          ← Back
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded">
          No special prices available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3 border-b">Product Name</th>
                <th className="text-right p-3 border-b">Original Price</th>
                <th className="text-right p-3 border-b">Special Price</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 transition"
                >
                  <td className="p-3 border-b">
                    {row.item_name}
                  </td>

                  <td className="p-3 border-b text-right">
                    ₹ {row.price_per_unit}
                  </td>

                  <td className="p-3 border-b text-right font-semibold text-green-600">
                    ₹ {row.special_price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
