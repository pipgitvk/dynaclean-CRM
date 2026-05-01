// app/api/customers-data/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  buildOwnershipWhere,
  getScopedUsername,
  isSuperAdminRole,
} from "@/lib/dataScope";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

function isHrPrivilegedCustomersRole(role) {
  const r = normalizeRoleKey(role || "");
  return r === "HR" || r === "HR HEAD" || r === "HR EXECUTIVE";
}

export async function GET(req) {
  const conn = await getDbConnection();

  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(payload.role || payload.userRole || "");
    const username = getScopedUsername(payload);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "table";

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const leadCampaign = searchParams.get("leadCampaign");
    const status = searchParams.get("status");
    const employeeName = searchParams.get("employeeName");
    const stage = searchParams.get("stage");
    const contactedTimeFilter = searchParams.get("contactedTimeFilter");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSizeRaw = parseInt(searchParams.get("pageSize") || "50", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw || 50, 10), 200);

    const [employeeRows] = await conn.execute(
      `SELECT username FROM rep_list where status = 1 `
    );
    let employees = employeeRows.map((row) => row.username);

    // Employee filter dropdown:
    // SUPERADMIN + HR roles can filter by any rep; everyone else should only see themselves.
    if (!isSuperAdminRole(role) && !isHrPrivilegedCustomersRole(role)) {
      employees = username ? [username] : [];
    }

    let whereClause = " WHERE 1=1";
    const params = [];

    if (startDate && endDate) {
      const startDateTime = `${startDate} 00:00:00`;
      const endDateTime = `${endDate} 23:59:59`;

      whereClause += " AND date_created BETWEEN ? AND ?";
      params.push(startDateTime, endDateTime);
    }

    if (leadCampaign && leadCampaign !== "all") {
      whereClause += " AND lead_campaign = ?";
      params.push(leadCampaign);
    }
    if (status && status !== "all") {
      whereClause += " AND status = ?";
      params.push(status);
    }
    if (stage && stage !== "all") {
      whereClause += " AND stage = ?";
      params.push(stage);
    }

    // Data visibility:
    // SUPERADMIN + HR roles → all rows
    // everyone else → only rows assigned/owned by them (or deny if username missing)
    if (!isSuperAdminRole(role) && !isHrPrivilegedCustomersRole(role)) {
      const ownership = buildOwnershipWhere({
        role,
        username,
        columns: ["lead_source", "sales_representative", "assigned_to"],
      });
      if (ownership.sql) {
        whereClause += ` AND ${ownership.sql}`;
        params.push(...ownership.params);
      }
    }

    // Optional employee filter (only within already-visible rows)
    if (employeeName && employeeName !== "all") {
      whereClause += " AND (lead_source = ? OR sales_representative = ? OR assigned_to = ?)";
      params.push(employeeName, employeeName, employeeName);
    }

    
    // search functionality (ID, phone, name, email - matches All Clients)
    const search = searchParams.get("search");

    if (search && search.trim()) {
      const like = `%${search.trim()}%`;

      whereClause += `
    AND (
      first_name LIKE ?
      OR last_name LIKE ?
      OR company LIKE ?
      OR email LIKE ?
      OR CAST(phone AS CHAR) LIKE ?
      OR CAST(customer_id AS CHAR) LIKE ?
      OR lead_source LIKE ?
      OR sales_representative LIKE ?
      OR assigned_to LIKE ?
    )
  `;

      params.push(like, like, like, like, like, like, like, like, like);
    }

    if (mode === "charts") {
      const statusSql =
        "SELECT status, COUNT(*) as count FROM customers" +
        whereClause +
        " GROUP BY status";
      const campaignSql =
        "SELECT lead_campaign as campaign, COUNT(*) as count FROM customers" +
        whereClause +
        " GROUP BY lead_campaign";
      const stageSql =
        "SELECT stage, COUNT(*) as count FROM customers" +
        whereClause +
        " GROUP BY stage";

      const [statusRows] = await conn.execute(statusSql, params);
      const [campaignRows] = await conn.execute(campaignSql, params);
      const [stageRows] = await conn.execute(stageSql, params);

      return NextResponse.json({
        employees,
        statusStats: statusRows,
        campaignStats: campaignRows,
        stageStats: stageRows,
      });
    }

    const countSql = "SELECT COUNT(*) as total FROM customers" + whereClause;
    const [countRows] = await conn.execute(countSql, params);
    const total = countRows[0]?.total || 0;
    const totalPages =
      total === 0 ? 1 : Math.max(Math.ceil(total / pageSize), 1);
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const dataSql =
      "SELECT c.customer_id, c.date_created, c.lead_campaign, c.first_name, c.company, c.status, c.lead_source, c.stage, " +
      "(SELECT MIN(cf.followed_date) FROM customers_followup cf WHERE cf.customer_id = c.customer_id) as contacted_time, " +
      "(SELECT cf.next_followup_date FROM customers_followup cf WHERE cf.customer_id = c.customer_id AND cf.next_followup_date IS NOT NULL ORDER BY cf.followed_date ASC LIMIT 1) as next_followup_time, " +
      "(SELECT COUNT(*) FROM customers_followup cf WHERE cf.customer_id = c.customer_id) as followup_count " +
      "FROM customers c" +
      whereClause +
      " ORDER BY c.date_created DESC LIMIT ? OFFSET ?";

    const dataParams = [...params, pageSize, offset];
    const [customerRows] = await conn.execute(dataSql, dataParams);

    // Apply contacted time filter in application layer
    let filteredCustomers = customerRows;
    if (contactedTimeFilter && contactedTimeFilter !== "all") {
      const timeLimits = {
        "1min": 1,
        "2min": 2,
        "3min": 3,
        "4min": 4,
        "5min": 5,
        "10min": 10,
        "15min": 15,
        "20min": 20,
        "30min": 30,
        "1hour": 60,
        "2hour": 120,
        "3hour": 180,
        "4hour": 240,
        "5hour": 300
      };
      
      if (contactedTimeFilter === "morethan5hour") {
        filteredCustomers = customerRows.filter(customer => {
          if (!customer.contacted_time || !customer.next_followup_time) return false;
          const diffMs = new Date(customer.next_followup_time) - new Date(customer.contacted_time);
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          return diffMinutes > 300;
        });
      } else if (timeLimits[contactedTimeFilter]) {
        const maxMinutes = timeLimits[contactedTimeFilter];
        filteredCustomers = customerRows.filter(customer => {
          if (!customer.contacted_time || !customer.next_followup_time) return false;
          const diffMs = new Date(customer.next_followup_time) - new Date(customer.contacted_time);
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          return diffMinutes <= maxMinutes;
        });
      }
    }

    return NextResponse.json({
      customers: filteredCustomers,
      employees,
      total,
      totalPages,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error("Database query error:", error);

    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
