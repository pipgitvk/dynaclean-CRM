import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { isUnknownApprovalNoteColumnError } from "@/lib/specialPriceApprovalNoteColumn";
import { updateSpecialPrice, deleteSpecialPrice } from "./_actions";
import SpecialPricingFilterBar from "./SpecialPricingFilterBar";
import AdminSpecialPricingTable from "./AdminSpecialPricingTable";
import { SPECIAL_PRICE_PENDING_CONDITION } from "@/lib/specialPriceDefaults";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminSpecialPricingPage({ searchParams }) {
  const payload = await getSessionPayload();

  if (!payload || !["SUPERADMIN", "DIRECTOR"].includes(String(payload.role).toUpperCase())) {
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
  const typeFilter = String(searchParamsResolved?.type || "").toLowerCase().trim();
  const priceTypeFilter = String(searchParamsResolved?.priceType || "")
    .toLowerCase()
    .trim();

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
      CASE 
        WHEN sp.item_type = 'product' THEN p.item_name
        ELSE sl.item_name
      END LIKE ? OR
      sp.product_code LIKE ? OR
      sp.status LIKE ? OR
      sp.price_type LIKE ?
    )`);
    whereParams.push(like, like, like, like, like, like);
  }

  if (statusFilter === "pending") {
    conditions.push(SPECIAL_PRICE_PENDING_CONDITION);
  } else if (statusFilter && ["approved", "rejected"].includes(statusFilter)) {
    conditions.push("LOWER(TRIM(sp.status)) = ?");
    whereParams.push(statusFilter);
  }

  if (typeFilter && ["product", "spare"].includes(typeFilter)) {
    conditions.push("sp.item_type = ?");
    whereParams.push(typeFilter);
  }

  if (priceTypeFilter === "dealer") {
    conditions.push(
      "LOWER(TRIM(IFNULL(sp.price_type, ''))) IN ('dealer price', 'dealer')",
    );
  } else if (priceTypeFilter === "special") {
    conditions.push(
      "LOWER(TRIM(IFNULL(sp.price_type, ''))) NOT IN ('dealer price', 'dealer')",
    );
  }

  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(" AND ")}`;
  }

  // ✅ Fetch all items from unified special_price table
  // spare_id is stored in product_id column, item_type differentiates them
  const listSqlBase = `
    SELECT
      sp.id,
      sp.customer_id,
      sp.item_type,
      sp.product_id,
      sp.product_code,
      sp.special_price,
      sp.price_type,
      sp.price_term,
      sp.status,
      sp.set_by,
      sp.set_date,
      sp.approved_by,
      sp.approved_date,
      NOTE_PLACEHOLDER
      c.first_name,
      c.last_name,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.item_name
        ELSE p.item_name
      END AS item_name,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.sale_price
        ELSE p.price_per_unit
      END AS price_per_unit,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.last_negotiation_price
        ELSE p.last_negotiation_price
      END AS last_negotiation_price,
      CASE 
        WHEN sp.item_type = 'spare' THEN sl.image
        ELSE p.product_image
      END AS product_image,
      CASE WHEN sp.item_type = 'product' THEN p.dp ELSE NULL END AS stock_dp,
      CASE WHEN sp.item_type = 'product' THEN p.dp_no_warranty ELSE NULL END AS stock_dp_no_warranty,
      u.username AS set_by_name
    FROM special_price sp
    JOIN customers c ON sp.customer_id = c.customer_id
    LEFT JOIN products_list p ON sp.item_type = 'product' AND sp.product_id = p.id
    LEFT JOIN spare_list sl ON sp.item_type = 'spare' AND sp.product_id = sl.id
    LEFT JOIN rep_list u ON BINARY sp.set_by = BINARY u.username
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

  // ✅ Get total count
  const [countRows] = await conn.execute(
    `
      SELECT COUNT(*) AS total
      FROM special_price sp
      JOIN customers c ON sp.customer_id = c.customer_id
      LEFT JOIN products_list p ON sp.item_type = 'product' AND sp.product_id = p.id
      LEFT JOIN spare_list sl ON sp.item_type = 'spare' AND sp.product_id = sl.id
      ${whereClause}
    `,
    whereParams,
  );
  const totalCount = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Same pending rule as the admin dashboard card: visible rows that are not approved/rejected.
  const [statusRows] = await conn.execute(
    `SELECT
       SUM(CASE WHEN LOWER(TRIM(IFNULL(sp.status, ''))) = 'approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN LOWER(TRIM(IFNULL(sp.status, ''))) = 'rejected' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN ${SPECIAL_PRICE_PENDING_CONDITION} THEN 1 ELSE 0 END) AS pending
     FROM special_price sp
     JOIN customers c ON sp.customer_id = c.customer_id`,
  );

  const statusCounts = {
    approved: Number(statusRows[0]?.approved || 0),
    rejected: Number(statusRows[0]?.rejected || 0),
    pending: Number(statusRows[0]?.pending || 0),
  };

  const [suggestionRows] = await conn.execute(`
    SELECT
      c.first_name,
      c.last_name,
      CASE
        WHEN sp.item_type = 'spare' THEN sl.item_name
        ELSE p.item_name
      END AS item_name,
      sp.product_code,
      sp.price_type,
      sp.status
    FROM special_price sp
    JOIN customers c ON sp.customer_id = c.customer_id
    LEFT JOIN products_list p ON sp.item_type = 'product' AND sp.product_id = p.id
    LEFT JOIN spare_list sl ON sp.item_type = 'spare' AND sp.product_id = sl.id
    ORDER BY sp.set_date DESC
    LIMIT 400
  `);

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

      <SpecialPricingFilterBar
        initialSearch={searchQuery}
        initialStatus={statusFilter}
        initialType={typeFilter}
        initialPriceType={priceTypeFilter}
        suggestions={suggestionRows.map((row) => ({
          customerName: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
          productName: row.item_name,
          productCode: row.product_code,
          priceType: row.price_type,
          status: row.status,
        }))}
      />

      <AdminSpecialPricingTable
        rows={rows.map((row) => ({
          ...row,
          set_date: row.set_date ? String(row.set_date) : null,
          approved_date: row.approved_date ? String(row.approved_date) : null,
        }))}
        currentPage={currentPage}
        totalPages={totalPages}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        priceTypeFilter={priceTypeFilter}
        updateSpecialPrice={updateSpecialPrice}
        deleteSpecialPrice={deleteSpecialPrice}
      />
    </div>
  );
}

