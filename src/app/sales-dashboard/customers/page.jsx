import { getDbConnection } from "@/lib/db";
import CustomerTable from "./CustomerTable";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

/** Legacy filter slugs from older dropdown values — DB stores title-case labels */
const STATUS_QUERY_ALIASES = {
  verygud: "Very Good",
  average: "Average",
  poor: "Poor",
  denied: "Denied",
  old_reassign: "old_reassign",
};

function resolveStatusForQuery(raw) {
  if (!raw) return "";
  return STATUS_QUERY_ALIASES[raw] ?? raw;
}

export default async function CustomersPage({ searchParams }) {
  const searchParamsResolved = await searchParams;
  const {
    status: statusParam,
    stage,
    product,
    lead_campaign,
    search,
    date_from,
    date_to,
    sort,
    next_follow_date,
    employee,
    tags,
    filter,
    page = '1'
  } = searchParamsResolved;

  const status = resolveStatusForQuery(statusParam);

  const currentPage = parseInt(page);
  const pageSize = 50;
  const offset = (currentPage - 1) * pageSize;
  let totalRecords = 0;
  let totalPages = 1;

  let username = "Unknown";
  let userRole = null;
  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }
  username = payload.username;
  userRole = payload.role;

  const conn = await getDbConnection();

  const customerConditions = [];
  const customerParams = [];

  // Only filter by assigned fields if user is not ADMIN, SUPERADMIN, or SERVICE HEAD or TEAM LEADER or EA
  if (userRole !== "ADMIN" && userRole !== "SUPERADMIN" && userRole !== "SERVICE HEAD" && userRole !== "TEAM LEADER" && userRole !== "EA") {
    customerConditions.push("(c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)");
    customerParams.push(username, username, username);
  }

  // Employee filter (only for ADMIN, SUPERADMIN, TEAM LEADER, EA)
  if (employee && (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "TEAM LEADER" || userRole === "EA")) {
    customerConditions.push("(c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)");
    customerParams.push(employee, employee, employee);
  }

  let joinClause = "";
  const followupConditions = [];
  const followupParams = [];

  // Handle today_reporting filter - show customers with today's TL followup
  if (filter === "today_reporting") {
    const today = new Date().toISOString().split("T")[0];
    joinClause = `
      INNER JOIN (
        SELECT customer_id, MAX(id) as latest_id
        FROM TL_followups
        GROUP BY customer_id
      ) tlf_latest ON c.customer_id = tlf_latest.customer_id
      INNER JOIN TL_followups tlf ON tlf.id = tlf_latest.latest_id
    `;
    followupConditions.push("DATE(tlf.next_followup_date) = ?");
    followupParams.push(today);
  }

  // Build INNER JOIN for filtering by next_follow_date or tags
  if (next_follow_date || tags) {
    joinClause = `
      INNER JOIN (
        SELECT customer_id, multi_tag, next_followup_date
        FROM customers_followup
        WHERE time_stamp = (
          SELECT MAX(time_stamp) FROM customers_followup cf2
          WHERE cf2.customer_id = customers_followup.customer_id
        )
      ) cf_filter ON c.customer_id = cf_filter.customer_id
    `;

    if (next_follow_date) {
      followupConditions.push("DATE(cf_filter.next_followup_date) = ?");
      followupParams.push(next_follow_date);
    }

    if (tags) {
      followupConditions.push("cf_filter.multi_tag LIKE ?");
      followupParams.push(`%${tags}%`);
    }
  }

  if (status) {
    customerConditions.push("c.status = ?");
    customerParams.push(status);
  }
  if (stage) {
    customerConditions.push("c.stage = ?");
    customerParams.push(stage);
  }
  if (product) {
    customerConditions.push("c.products_interest = ?");
    customerParams.push(product);
  }
  if (lead_campaign) {
    customerConditions.push("c.lead_campaign = ?");
    customerParams.push(lead_campaign);
  }

  if (search) {
    const term = `%${search}%`;
    const fields = [
      "c.first_name",
      "c.last_name",
      "c.email",
      "c.phone",
      "c.address",
      "c.company",
      "c.lead_source",
      "c.status",
      "c.followup_notes",
      "c.communication_history",
      "c.products_interest",
      "c.sales_representative",
      "c.assigned_to",
      "c.tags",
      "c.notes",
      "c.date_created",
    ];
    customerConditions.push(
      `(${fields.map((field) => `${field} LIKE ?`).join(" OR ")})`
    );
    customerParams.push(...fields.map(() => term));
  }

  if (date_from && date_to) {
    customerConditions.push("c.date_created BETWEEN ? AND ?");
    customerParams.push(date_from, date_to);
  }

  // Combine all WHERE clauses
  let allWhereConditions = [...customerConditions];
  if (followupConditions.length > 0) {
    allWhereConditions.push(...followupConditions);
  }
  let whereClauseString = allWhereConditions.length > 0 
    ? allWhereConditions.join(" AND ") 
    : "1=1"; // Default to always true if no conditions

  // Construct final SQL query
  let sql = `
    SELECT
      c.customer_id,
      c.first_name,
      c.email,
      c.phone,
      c.status,
      c.stage,
      c.notes,
      c.date_created,
      c.lead_campaign,
      c.products_interest,
      COALESCE(${filter === "today_reporting" ? "tlf.multi_tag" : "cf.multi_tag"}, '') AS multi_tag,
      ${filter === "today_reporting" ? "tlf.next_followup_date" : "cf.next_followup_date"} AS next_follow_date,
      ${filter === "today_reporting" ? "tlf.notes" : "cf.notes"} AS latest_followup_notes
    FROM customers c
    ${filter === "today_reporting" ? "" : `
    LEFT JOIN (
      SELECT 
        customer_id,
        multi_tag,
        next_followup_date,
        notes,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY time_stamp DESC) AS rn
      FROM customers_followup
    ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
    `}
    ${joinClause}
    WHERE ${whereClauseString}
  `;

  let orderBy = "c.date_created DESC"; // default
  if (sort === "oldest") {
    orderBy = "c.date_created ASC";
  } else if (sort === "first_name") {
    orderBy = "c.first_name ASC";
  }

  // Combine all parameters for the execute function
  const allParams = [...customerParams, ...followupParams];

  console.log("SQL Query (with JOIN):", sql);
  console.log("SQL Params (with JOIN):", allParams);

  try {
    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM customers c
      ${joinClause}
      WHERE ${whereClauseString}
    `;
    const [countResult] = await conn.execute(countSql, allParams);
    totalRecords = countResult[0].total;
    totalPages = Math.ceil(totalRecords / pageSize);

    // Add ORDER BY and pagination
    sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const paginatedParams = [...allParams, pageSize, offset];

    const [rows] = await conn.execute(sql, paginatedParams);

    // Fetch employees for employee filter (only for roles that can see it)
    let employees = [];
    if (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "TEAM LEADER" || userRole === "EA") {
      const [employeeRows] = await conn.execute(
        `SELECT DISTINCT lead_source FROM customers WHERE lead_source IS NOT NULL ORDER BY lead_source`
      );
      employees = employeeRows.map((r) => r.lead_source);
    }

    return (
      <div className="p-6 max-w-7xl mx-auto text-gray-700 border">
        <h1 className="text-2xl font-bold mb-4">Customers</h1>
        <CustomerTable
          rows={rows}
          searchParams={searchParamsResolved}
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          pageSize={pageSize}
          userRole={userRole}
          employees={employees}
        />
      </div>
    );
  } catch (error) {
    console.error("Database query error:", error.message);

    return (
      <div className="p-6 text-red-600 font-semibold">
        ❌ Error fetching customers: {error.message}
      </div>
    );
  }
}
