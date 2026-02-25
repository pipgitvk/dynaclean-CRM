import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import Link from "next/link";
import {
  approveSpecialPrice,
  rejectSpecialPrice,
} from "./_actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminSpecialPricingPage({ searchParams }) {
  const payload = await getSessionPayload();

  if (!payload || payload.role !== "SUPERADMIN") {
    return (
      <div className="p-6 text-red-500">
        Unauthorized: only admin can view and approve special prices.
      </div>
    );
  }

  const searchParamsResolved = await searchParams;
  const pageParam = Number(searchParamsResolved?.page || 1) || 1;
  const currentPage = pageParam < 1 ? 1 : pageParam;

  const conn = await getDbConnection();

  const offset = (currentPage - 1) * PAGE_SIZE;

  const [rows] = await conn.execute(
    `
    SELECT
      sp.id,
      sp.customer_id,
      sp.product_id,
      sp.product_code,
      sp.special_price,
      sp.status,
      sp.set_by,
      sp.set_date,
      sp.approved_by,
      sp.approved_date,
      c.first_name,
      c.last_name,
      p.item_name,
      p.price_per_unit
    FROM special_price sp
    JOIN customers c ON sp.customer_id = c.customer_id
    JOIN products_list p ON sp.product_id = p.id
    ORDER BY sp.set_date DESC
    LIMIT ? OFFSET ?
  `,
    [PAGE_SIZE, offset],
  );

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM special_price`,
  );
  const totalCount = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const [statusRows] = await conn.execute(
    `SELECT status, COUNT(*) AS count FROM special_price GROUP BY status`,
  );

  const statusCounts = statusRows.reduce(
    (acc, row) => {
      const key = String(row.status || "").toLowerCase();
      const count = Number(row.count || 0);
      if (key === "approved") acc.approved += count;
      else if (key === "rejected") acc.rejected += count;
      else if (key === "pending") acc.pending += count;
      return acc;
    },
    { approved: 0, rejected: 0, pending: 0 },
  );

  return (
    <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Special Price Approvals</h1>
        <span className="text-sm text-gray-600">
          Total records: {totalCount}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-xs w-full">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="mt-1 text-2xl font-bold text-green-700">
            {statusCounts.approved}
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-xs w-full">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="mt-1 text-2xl font-bold text-yellow-700">
            {statusCounts.pending}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-xs w-full">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="mt-1 text-2xl font-bold text-red-700">
            {statusCounts.rejected}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-right">Original Price</th>
              <th className="p-3 text-right">Special Price</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-left">Set By</th>
              <th className="p-3 text-left">Set Date</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-4 text-center text-gray-500 text-sm"
                >
                  No special prices found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    {row.first_name} {row.last_name || ""}
                    <div className="text-xs text-gray-500">
                      ID: {row.customer_id}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{row.item_name}</div>
                    <div className="text-xs text-gray-500">
                      Code: {row.product_code}
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-600">
                    ₹ {row.price_per_unit}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    ₹ {row.special_price}
                  </td>
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

                      const approvedMeta =
                        isApproved && row.approved_by
                          ? `Approved by ${row.approved_by}${
                              row.approved_date
                                ? ` on ${new Date(
                                    row.approved_date,
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : null;

                      return (
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-3 py-1 rounded text-xs capitalize ${badgeClass}`}
                          >
                            {label}
                          </span>
                          {approvedMeta && (
                            <span className="text-[11px] text-gray-500">
                              {approvedMeta}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-sm">{row.set_by}</td>
                  <td className="p-3 text-xs text-gray-600">
                    {row.set_date
                      ? new Date(row.set_date).toLocaleString()
                      : "-"}
                  </td>
                  <td className="p-3 space-y-1">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin-dashboard/special-pricing/${row.customer_id}/${row.product_id}`}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Details
                      </Link>
                    </div>
                    {row.status === "pending" && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <form action={approveSpecialPrice}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="bg-green-600 text-white text-xs px-3 py-1 rounded"
                          >
                            Approve
                          </button>
                        </form>
                        <form action={rejectSpecialPrice}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="bg-red-600 text-white text-xs px-3 py-1 rounded"
                          >
                            Reject
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-between items-center p-4 border-t text-sm">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/admin-dashboard/special-pricing?page=${currentPage - 1}`}
                className="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/admin-dashboard/special-pricing?page=${currentPage + 1}`}
                className="px-3 py-1 border rounded hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

