import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { deleteSpecialPrice, updateSpecialPrice } from "../../_actions";

export const dynamic = "force-dynamic";

/* =========================
   PAGE
========================= */
export default async function ProductSpecialPrice({ params }) {
  const { customerId, productId } = await params;

  if (!customerId || !productId) {
    return <div className="p-6 text-red-500">Invalid URL</div>;
  }

  const payload = await getSessionPayload();
  if (!payload) return null;

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `
    SELECT 
      sp.special_price,
      sp.status,
      c.first_name,
      c.last_name,
      p.item_name,
      p.price_per_unit,
      p.gst_rate
    FROM special_price sp
    JOIN customers c ON sp.customer_id = c.customer_id
    JOIN products_list p ON sp.product_id = p.id
    WHERE sp.customer_id = ? AND sp.product_id = ?
    LIMIT 1
    `,
    [Number(customerId), Number(productId)]
  );

  const data = rows[0];

  if (!data) {
    return <div className="p-6 text-red-500">Special price not found</div>;
  }

  return (
    <div className="p-6 max-w-2xl">

       <div className="flex items-center justify-between mb-6 w-full">
        <h1 className="text-2xl font-bold mb-6">
        Edit Special Price
      </h1>
        <Link
          href={`/user-dashboard/special-pricing/${customerId}`}
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition"
        >
          ← Back
        </Link>
      </div>
      


      {/* Product Info */}
      <div className="bg-gray-100 p-4 rounded mb-6">
        <p><strong>Customer:</strong> {data.first_name} {data.last_name}</p>
        <p><strong>Product:</strong> {data.item_name}</p>
        <p><strong>Original Price:</strong> ₹ {data.price_per_unit}</p>
        <p><strong>GST:</strong> {data.gst_rate}%</p>
        <p>
          <strong>Status:</strong>{" "}
          <span
            className={`ml-2 px-2 py-1 rounded text-sm ${
              data.status === "approved"
                ? "bg-green-100 text-green-700"
                : data.status === "rejected"
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {data.status}
          </span>
        </p>
      </div>

      {data.status === "approved" ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          This special price is approved and cannot be edited. Please contact admin to change it.
        </div>
      ) : (
        <>
          {/* UPDATE FORM */}
          <form action={updateSpecialPrice} className="space-y-4">
            <input type="hidden" name="customer_id" value={customerId} />
            <input type="hidden" name="product_id" value={productId} />

            <div>
              <label className="block font-medium mb-1">
                Special Price
              </label>
              <input
                type="number"
                step="0.01"
                name="special_price"
                defaultValue={data.special_price}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Update Special Price
            </button>
          </form>

          {/* DELETE */}
          <form action={deleteSpecialPrice} className="mt-6">
            <input type="hidden" name="customer_id" value={customerId} />
            <input type="hidden" name="product_id" value={productId} />

            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Delete Special Price
            </button>
          </form>
        </>
      )}
    </div>
  );
}
