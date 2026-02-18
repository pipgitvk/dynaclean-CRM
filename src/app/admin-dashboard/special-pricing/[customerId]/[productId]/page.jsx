import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { redirect } from "next/navigation";
import { approveSpecialPrice, deleteSpecialPrice, rejectSpecialPrice, updateSpecialPrice } from "../../_actions";

export const dynamic = "force-dynamic";

export default async function ProductSpecialPrice({ params }) {
  const { customerId, productId } = await params;

  const payload = await getSessionPayload();
   console.log("Hello Payload",payload);
  if (!payload || payload.role !== "SUPERADMIN") {
    return <div className="p-6 text-red-500">Unauthorized</div>;
  }

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    `
    SELECT 
      sp.id,
      sp.special_price,
      sp.status,
      sp.set_date,
      sp.approved_date,
      u.username AS approved_user,
      c.first_name,
      c.last_name,
      p.item_name,
      p.price_per_unit,
      p.gst_rate
    FROM special_price sp
    JOIN customers c ON sp.customer_id = c.customer_id
    JOIN products_list p ON sp.product_id = p.id
    LEFT JOIN emplist u ON sp.approved_by = u.id
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
      <h1 className="text-2xl font-bold mb-6">
        Admin – Special Price
      </h1>

      {/* Info Card */}
      <div className="bg-gray-100 p-4 rounded mb-6 space-y-1">
        <p><strong>Customer:</strong> {data.first_name} {data.last_name}</p>
        <p><strong>Product:</strong> {data.item_name}</p>
        <p><strong>Original Price:</strong> ₹ {data.price_per_unit}</p>
        <p><strong>Special Price:</strong> ₹ {data.special_price}</p>
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

        {data.approved_user && (
          <p className="text-sm text-gray-600">
            Approved by {data.approved_user} on{" "}
            {new Date(data.approved_date).toLocaleString()}
          </p>
        )}
      </div>

      {/* UPDATE FORM */}
      <form action={updateSpecialPrice} className="space-y-4">
        <input type="hidden" name="id" value={data.id} />

        <div>
          <label className="block font-medium mb-1">
            Update Special Price
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

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Update
        </button>
      </form>

      {/* APPROVE / REJECT */}
      {data.status === "pending" && (
        <div className="flex gap-4 mt-6">
          <form action={approveSpecialPrice}>
            <input type="hidden" name="id" value={data.id} />
            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Approve
            </button>
          </form>

          <form action={rejectSpecialPrice}>
            <input type="hidden" name="id" value={data.id} />
            <button className="bg-red-600 text-white px-4 py-2 rounded">
              Reject
            </button>
          </form>
        </div>
      )}

      {/* DELETE */}
      <form action={deleteSpecialPrice} className="mt-6">
        <input type="hidden" name="id" value={data.id} />
        <button className="bg-red-600 text-white px-4 py-2 rounded">
          Delete
        </button>
      </form>
    </div>
  );
}
