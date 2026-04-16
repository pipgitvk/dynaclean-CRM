import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import TLCustomersTable from "@/app/user-dashboard/tl-customers/TLCustomersTable";
import Link from "next/link";
import {
  SQL_EFFECTIVE_NEXT_FOLLOWUP,
  SQL_LATEST_CHRONOLOGICAL_NEXT_FOLLOWUP,
} from "@/lib/tlEffectiveNextFollowupSql";

export const dynamic = "force-dynamic";

export default async function AdminTLCustomersPage({ searchParams }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return <div className="p-8 text-red-600">Unauthorized</div>;
  }

  const searchParamsResolved = await searchParams;
  const {
    search,
    employee,
    status,
    stage,
    tag,
    nextFromDate,
    nextToDate,
    lead_campaign,
    page = "1",
    tlOnly = "true",
  } = searchParamsResolved;

  const currentPage = parseInt(page);
  const pageSize = 50; // Number of records per page
  const offset = (currentPage - 1) * pageSize;
  const showTLOnly = tlOnly === "true";
  const sqlNextForDateFilter = showTLOnly
    ? SQL_LATEST_CHRONOLOGICAL_NEXT_FOLLOWUP
    : SQL_EFFECTIVE_NEXT_FOLLOWUP;

  const conn = await getDbConnection();

  // Build query to fetch customers with their latest followup info
  let query = `
    SELECT
      c.*,
      cf.next_followup_date as latest_next_followup,
      cf.followed_date as latest_followed_date,
      cf.notes as latest_notes,
      cf.followed_by as latest_followed_by,
      tlf.id as tl_followup_id,
      tlf.estimated_order_date,
      tlf.lead_quality_score,
      tlf.multi_tag,
      tlf.notes as tl_notes,
      tlf.next_followup_date as tl_next_followup,
      tlf.followed_date as tl_followed_date,
      tlf.followed_by as tl_followed_by,
      ${showTLOnly ? "fu.followup_start_at" : "NULL AS followup_start_at"}
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, next_followup_date, followed_date, notes, followed_by,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY time_stamp DESC) as rn
      FROM customers_followup
    ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
    LEFT JOIN (
      SELECT customer_id, id, estimated_order_date, lead_quality_score, multi_tag, notes, next_followup_date, followed_date, followed_by,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
      FROM TL_followups
    ) tlf ON c.customer_id = tlf.customer_id AND tlf.rn = 1
    ${showTLOnly ? `LEFT JOIN (
      SELECT customer_id, MIN(dt) AS followup_start_at
      FROM (
        SELECT customer_id, created_at AS dt FROM TL_followups
        UNION ALL
        SELECT customer_id, time_stamp AS dt FROM customers_followup
      ) earliest_fu
      GROUP BY customer_id
    ) fu ON fu.customer_id = c.customer_id` : ""}
    WHERE 1=1
  `;

  const params = [];

  // Search by customer_id, phone, or name
  if (search) {
    query += ` AND (c.customer_id = ? OR c.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(search, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Filter by employee (lead_source)
  if (employee) {
    query += ` AND c.lead_source = ?`;
    params.push(employee);
  }

  // Filter by status
  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }

  // Filter by stage
  if (stage) {
    query += ` AND c.stage = ?`;
    params.push(stage);
  }

  // Filter by tag
  if (tag) {
    if (tag === "N/A") {
      query += ` AND (tlf.multi_tag IS NULL OR tlf.multi_tag = '')`;
    } else {
      query += ` AND tlf.multi_tag LIKE ?`;
      params.push(`%${tag}%`);
    }
  }

  // When ON: show only customers that have TL_followups rows
  if (showTLOnly) {
    query += ` AND tlf.customer_id IS NOT NULL`;
  }

  // Next follow-up date filter must match the column: TL mode → GREATEST; else → effective
  if (nextFromDate && nextToDate) {
    query += ` AND ${sqlNextForDateFilter} BETWEEN ? AND ?`;
    params.push(`${nextFromDate} 00:00:00`, `${nextToDate} 23:59:59`);
  } else if (nextFromDate) {
    query += ` AND ${sqlNextForDateFilter} >= ?`;
    params.push(`${nextFromDate} 00:00:00`);
  } else if (nextToDate) {
    query += ` AND ${sqlNextForDateFilter} <= ?`;
    params.push(`${nextToDate} 23:59:59`);
  }

  // Filter by lead_campaign
  if (lead_campaign) {
    query += ` AND c.lead_campaign = ?`;
    params.push(lead_campaign);
  }

  // Get total count for pagination (without LIMIT)
  let countQuery = query.replace(
    /SELECT[\s\S]*?FROM customers c/,
    "SELECT COUNT(*) as total FROM customers c",
  );
  const [countResult] = await conn.execute(countQuery, params);
  const totalRecords = countResult[0].total;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Add pagination to main query
  query += ` ORDER BY c.date_created DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  const [customers] = await conn.execute(query, params);

  // Fetch ALL customers for KPI calculations (just essential fields)
  let kpiQuery = `
    SELECT
      c.customer_id,
      c.status,
      c.stage,
      tlf.multi_tag,
      tlf.next_followup_date as tl_next_followup,
      tlf.followed_date as tl_followed_date,
      tlf.customer_id as tl_customer_id,
      cf.next_followup_date as latest_next_followup,
      cf.followed_date as latest_followed_date
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, next_followup_date, followed_date,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY time_stamp DESC) as rn
      FROM customers_followup
    ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
    LEFT JOIN (
      SELECT customer_id, multi_tag, next_followup_date, followed_date,
      ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
      FROM TL_followups
    ) tlf ON c.customer_id = tlf.customer_id AND tlf.rn = 1
    WHERE 1=1
  `;

  const kpiParams = [];

  // Apply same filters for KPI data
  if (search) {
    kpiQuery += ` AND (c.customer_id = ? OR c.phone LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.company LIKE ?)`;
    const searchTerm = `%${search}%`;
    kpiParams.push(search, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (employee) {
    kpiQuery += ` AND c.lead_source = ?`;
    kpiParams.push(employee);
  }

  if (status) {
    kpiQuery += ` AND c.status = ?`;
    kpiParams.push(status);
  }

  if (stage) {
    kpiQuery += ` AND c.stage = ?`;
    kpiParams.push(stage);
  }

  if (tag) {
    if (tag === "N/A") {
      kpiQuery += ` AND (tlf.multi_tag IS NULL OR tlf.multi_tag = '')`;
    } else {
      kpiQuery += ` AND tlf.multi_tag LIKE ?`;
      kpiParams.push(`%${tag}%`);
    }
  }

  if (showTLOnly) {
    kpiQuery += ` AND tlf.customer_id IS NOT NULL`;
  }

  if (nextFromDate && nextToDate) {
    kpiQuery += ` AND ${sqlNextForDateFilter} BETWEEN ? AND ?`;
    kpiParams.push(`${nextFromDate} 00:00:00`, `${nextToDate} 23:59:59`);
  } else if (nextFromDate) {
    kpiQuery += ` AND ${sqlNextForDateFilter} >= ?`;
    kpiParams.push(`${nextFromDate} 00:00:00`);
  } else if (nextToDate) {
    kpiQuery += ` AND ${sqlNextForDateFilter} <= ?`;
    kpiParams.push(`${nextToDate} 23:59:59`);
  }

  if (lead_campaign) {
    kpiQuery += ` AND c.lead_campaign = ?`;
    kpiParams.push(lead_campaign);
  }

  const [allCustomersForKPI] = await conn.execute(kpiQuery, kpiParams);

  const isSuperAdmin = String(payload.role ?? payload.userRole ?? "")
    .trim()
    .toUpperCase() === "SUPERADMIN";

  // Fetch employees for only sales role
  const [employees] = await conn.execute(
    `SELECT DISTINCT username, username as name FROM rep_list WHERE userRole IN ('SALES') AND status = 1 ORDER BY username`,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          TL Customer Management (Admin)
        </h1>
        <Link
          href="/admin-dashboard/tl-customers/bulk-follow-uploads"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium"
        >
          Bulk Follow Uploads
        </Link>
      </div>

      <TLCustomersTable
        customers={customers}
        allCustomersForKPI={allCustomersForKPI}
        employees={employees}
        searchParams={searchParamsResolved}
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        isAdmin={true}
        tlOnly={showTLOnly}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
