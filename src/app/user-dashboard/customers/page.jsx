import { getDbConnection } from "@/lib/db";
import CustomerTable from "./CustomerTable";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export default async function CustomersPage({ searchParams }) {
  const searchParamsResolved = await searchParams;
  const {
    status,
    stage,
    product,
    lead_campaign,
    search,
    date_from,
    date_to,
    sort,
    next_follow_date,
    employee,
    page = '1'
  } = searchParamsResolved;

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

  // Only filter by assigned fields if user is not ADMIN, SUPERADMIN, or SERVICE HEAD or TEAM LEADER
  if (userRole !== "ADMIN" && userRole !== "SUPERADMIN" && userRole !== "SERVICE HEAD" && userRole !== "TEAM LEADER") {
    customerConditions.push("(c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)");
    customerParams.push(username, username, username);
  }

  // Employee filter (only for ADMIN, SUPERADMIN, TEAM LEADER)
  if (employee && (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "TEAM LEADER")) {
    customerConditions.push("(c.lead_source = ? OR c.sales_representative = ? OR c.assigned_to = ?)");
    customerParams.push(employee, employee, employee);
  }

  let joinClause = "";
  const followupConditions = [];
  const followupParams = [];
  let followupSelectFields = ""; // NEW: To conditionally add fields from joined table

  // --- Start: Build conditions for customers_followup table if next_follow_date is present ---
  if (next_follow_date) {
    // If filtering by next_follow_date, we must JOIN
    joinClause = `
      INNER JOIN customers_followup cf ON c.customer_id = cf.customer_id
    `;
    // Add the filter condition for the followup date
    followupConditions.push("DATE(cf.next_followup_date) = ?"); // Confirmed column name
    followupParams.push(next_follow_date);

    // If joined, also select the fields from the joined table
    followupSelectFields = `
      , cf.next_followup_date AS next_follow_date
      , cf.notes AS latest_followup_notes_from_followup_table -- Changed alias to avoid conflict, adjust as needed
      -- You can add other fields from customers_followup here, like cf.followed_date, cf.followed_by, etc.
    `;
  } else {
    followupSelectFields = ", c.next_follow_date"; // Assume customers table has this for initial display
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
      c.products_interest
      ${followupSelectFields} -- This inserts the conditional select statement
    FROM customers c
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
    if (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "TEAM LEADER") {
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
