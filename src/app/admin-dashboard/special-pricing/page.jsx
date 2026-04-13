import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { isUnknownApprovalNoteColumnError } from "@/lib/specialPriceApprovalNoteColumn";
import Link from "next/link";
import SpecialPriceDetailsModal from "@/components/specialPrice/SpecialPriceDetailsModal";
import { updateSpecialPrice, deleteSpecialPrice } from "./_actions";
import SpecialPriceApproveRejectButtons from "@/components/specialPrice/SpecialPriceApproveRejectButtons";
import SpecialPricingSearch from "./SpecialPricingSearch";
import StatusFilter from "./StatusFilter";

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
  const searchQuery = String(searchParamsResolved?.search || "").trim();
  const statusFilter = String(searchParamsResolved?.status || "").toLowerCase().trim();

  const conn = await getDbConnection();

  const offset = (currentPage - 1) * PAGE_SIZE;

  let whereClause = "";
  const whereParams = [];
  const conditions = [];

  if (searchQuery) {
    const like = `%${searchQuery}%`;
    conditions.push(`(
      c.first_name LIKE ? OR
      c.last_name LIKE ? OR
      p.item_name LIKE ? OR
      sp.product_code LIKE ? OR
      sp.status LIKE ?
    )`);
    whereParams.push(like, like, like, like, like);
  }

  if (statusFilter && ["approved", "rejected", "pending"].includes(statusFilter)) {
    conditions.push("LOWER(TRIM(sp.status)) = ?");
    whereParams.push(statusFilter);
  }

  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(" AND ")}`;
  }

  const listSqlBase = `
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
      NOTE_PLACEHOLDER
      c.first_name,
      c.last_name,
      p.item_name,
      p.price_per_unit,
      p.product_image
    FROM special_price sp
    JOIN customers c ON sp.customer_id = c.customer_id
    JOIN products_list p ON sp.product_id = p.id
    ${whereClause}
    ORDER BY sp.set_date DESC
    LIMIT ? OFFSET ?
  `;
  const listParams = [...whereParams, PAGE_SIZE, offset];

  let rows;
  try {
    const sql = listSqlBase.replace(
      "NOTE_PLACEHOLDER",
      "sp.approval_note,\n      ",
    );
    const result = await conn.execute(sql, listParams);
    rows = result[0];
  } catch (e) {
    if (!isUnknownApprovalNoteColumnError(e)) throw e;
    const sql = listSqlBase.replace("NOTE_PLACEHOLDER", "");
    const result = await conn.execute(sql, listParams);
    rows = result[0];
  }

  const [countRows] = await conn.execute(
    `
      SELECT COUNT(*) AS total
      FROM special_price sp
      JOIN customers c ON sp.customer_id = c.customer_id
      JOIN products_list p ON sp.product_id = p.id
      ${whereClause}
    `,
    whereParams,
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
    <div className="p-4 sm:p-6 space-y-4 overflow-x-hidden min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Special Price Approvals</h1>
        <span className="text-sm text-gray-600">
          Total records: {totalCount}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4 w-full">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-green-700">
            {statusCounts.approved}
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 w-full">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-yellow-700">
            {statusCounts.pending}
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 w-full">
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="mt-1 text-xl sm:text-2xl font-bold text-red-700">
            {statusCounts.rejected}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:gap-4">
        <SpecialPricingSearch
          initialSearch={searchQuery}
          suggestions={rows.map((row) => ({
            id: row.id,
            customerName: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
            productName: row.item_name,
            productCode: row.product_code,
          }))}
        />
        <StatusFilter initialStatus={statusFilter} />
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden min-w-0">
        <div
          className="overflow-x-scroll w-full min-w-0 touch-pan-x"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Image</th>
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-right">Original Price</th>
                <th className="p-3 text-right">Special Price</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-left">Set By</th>
                <th className="p-3 text-left">Set Date</th>
                <th className="p-3 text-left min-w-[160px] sm:sticky sm:right-0 sm:bg-gray-100 sm:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-center text-gray-500 text-sm"
                  >
                    {searchQuery || statusFilter ? "No data found" : "No special prices found."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const status = (row.status || "").toLowerCase();
                  const isApproved = status === "approved";
                  const isRejected = status === "rejected";
                  const badgeClass = isApproved
                    ? "bg-green-100 text-green-700"
                    : isRejected
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700";
                  const label = isApproved ? "approved" : isRejected ? "rejected" : "pending";
                  const approvedMeta =
                    isApproved && row.approved_by
                      ? `Approved by ${row.approved_by}${
                          row.approved_date
                            ? ` on ${new Date(row.approved_date).toLocaleString()}`
                            : ""
                        }`
                      : null;
                  const rejectedMeta =
                    isRejected && row.approved_by
                      ? `Rejected by ${row.approved_by}${
                          row.approved_date
                            ? ` on ${new Date(row.approved_date).toLocaleString()}`
                            : ""
                        }`
                      : null;

                  return (
                    <tr key={row.id} className="border-t">
                      <td className="p-3">
                        {row.first_name} {row.last_name || ""}
                        <div className="text-xs text-gray-500">
                          ID: {row.customer_id}
                        </div>
                      </td>
                      <td className="p-3">
                        {row.product_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.product_image}
                            alt={row.item_name || "Product"}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">No image</span>
                        )}
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
                          {rejectedMeta && (
                            <span className="text-[11px] text-gray-500">
                              {rejectedMeta}
                            </span>
                          )}
                          {(isApproved || isRejected) && row.approval_note && (
                            <div className="text-[11px] text-gray-700 max-w-[min(240px,28vw)] text-center leading-snug border-t border-gray-200/80 pt-1.5 mt-0.5">
                              <span className="font-semibold text-gray-600">
                                Note:{" "}
                              </span>
                              <span className="whitespace-pre-wrap break-words">
                                {row.approval_note}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">{row.set_by}</td>
                      <td className="p-3 text-xs text-gray-600">
                        {row.set_date
                          ? new Date(row.set_date).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-3 space-y-2 min-w-[160px] sm:sticky sm:right-0 sm:bg-white sm:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-wrap gap-2">
                          <SpecialPriceDetailsModal
                            details={{
                              id: row.id,
                              customerId: row.customer_id,
                              customerName: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
                              productName: row.item_name,
                              productCode: row.product_code,
                              originalPrice: row.price_per_unit,
                              specialPrice: row.special_price,
                              status: row.status,
                              setBy: row.set_by,
                              setDate: row.set_date,
                              approvedBy: row.approved_by,
                              approvedDate: row.approved_date,
                              approvalNote: row.approval_note,
                            }}
                            onUpdate={updateSpecialPrice}
                            onDelete={deleteSpecialPrice}
                          />
                        </div>
                        {!isApproved && !isRejected && (
                          <SpecialPriceApproveRejectButtons id={row.id} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t text-sm">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/admin-dashboard/special-pricing?${new URLSearchParams({
                  ...(searchQuery && { search: searchQuery }),
                  ...(statusFilter && { status: statusFilter }),
                  page: String(currentPage - 1),
                }).toString()}`}
                className="px-3 py-1.5 border rounded hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/admin-dashboard/special-pricing?${new URLSearchParams({
                  ...(searchQuery && { search: searchQuery }),
                  ...(statusFilter && { status: statusFilter }),
                  page: String(currentPage + 1),
                }).toString()}`}
                className="px-3 py-1.5 border rounded hover:bg-gray-50"
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

