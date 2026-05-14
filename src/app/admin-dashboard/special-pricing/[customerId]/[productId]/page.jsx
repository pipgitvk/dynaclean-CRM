import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { isUnknownApprovalNoteColumnError } from "@/lib/specialPriceApprovalNoteColumn";
import { redirect } from "next/navigation";
import { deleteSpecialPrice, updateSpecialPrice } from "../../_actions";
import SpecialPriceApproveRejectButtons from "@/components/specialPrice/SpecialPriceApproveRejectButtons";

export const dynamic = "force-dynamic";

export default async function ProductSpecialPrice({ params }) {
  const { customerId, productId } = await params;

  const payload = await getSessionPayload();
   console.log("Hello Payload",payload);
  if (!payload || payload.role !== "SUPERADMIN") {
    return <div className="p-6 text-red-500">Unauthorized</div>;
  }

  const conn = await getDbConnection();

  const detailSql = `
    SELECT 
      sp.id,
      sp.special_price,
      sp.status,
      sp.set_date,
      sp.approved_by,
      sp.approved_date,
      NOTE_PLACEHOLDER
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
  `;
  const detailParams = [Number(customerId), Number(productId)];

  let rows;
  try {
    const sql = detailSql.replace(
      "NOTE_PLACEHOLDER",
      "sp.approval_note,\n      ",
    );
    const result = await conn.execute(sql, detailParams);
    rows = result[0];
  } catch (e) {
    if (!isUnknownApprovalNoteColumnError(e)) throw e;
    const sql = detailSql.replace("NOTE_PLACEHOLDER", "");
    const result = await conn.execute(sql, detailParams);
    rows = result[0];
  }

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
        <p className="flex flex-col gap-1">
          <span>
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
          </span>
          {data.status === "approved" && data.approved_by && data.approved_date && (
            <span className="text-xs text-gray-600 ml-6">
              Approved by {data.approved_by} on{" "}
              {new Date(data.approved_date).toLocaleString()}
            </span>
          )}
          {data.status === "rejected" && data.approved_by && data.approved_date && (
            <span className="text-xs text-gray-600 ml-6">
              Rejected by {data.approved_by} on{" "}
              {new Date(data.approved_date).toLocaleString()}
            </span>
          )}
          {(data.status === "approved" || data.status === "rejected") &&
            data.approval_note && (
              <span className="text-xs text-gray-700 ml-6 block mt-2 pt-2 border-t border-gray-200 w-full max-w-xl">
                <strong className="text-gray-600">Note</strong>
                <div className="whitespace-pre-wrap mt-0.5">
                  {data.approval_note}
                </div>
              </span>
            )}
        </p>
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
        <div className="mt-6">
          <SpecialPriceApproveRejectButtons id={data.id} variant="page" />
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
