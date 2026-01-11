// app/api/customers-data/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  const conn = await getDbConnection();

  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (payload.role || "").toUpperCase().trim();
    const username = payload.username || null;
    const privilegedRoles = ["ADMIN", "SUPERADMIN", "TEAM LEADER", "HR"];
    const isPrivileged = privilegedRoles.includes(role);

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "table";

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const leadCampaign = searchParams.get("leadCampaign");
    const status = searchParams.get("status");
    const employeeName = searchParams.get("employeeName");
    const stage = searchParams.get("stage");
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSizeRaw = parseInt(searchParams.get("pageSize") || "50", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw || 50, 10), 200);

    const [employeeRows] = await conn.execute(
      `SELECT username FROM rep_list where status = 1 `
    );
    let employees = employeeRows.map((row) => row.username);

    // For non-privileged users (e.g. sales), restrict employee list to themselves
    if (!isPrivileged && username) {
      employees = [username];
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

    // Role-based scoping and employee filter
    if (!isPrivileged && username) {
      // Non-privileged users only see their own customers, regardless of filter
      whereClause +=
        " AND (lead_source = ? OR sales_representative = ?)";
      params.push(username, username);
    } else if (employeeName && employeeName !== "all") {
      // Admin-style filter: match on any of the responsible columns
      whereClause +=
        " AND (lead_source = ? OR sales_representative = ?)";
      params.push(employeeName, employeeName);
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

    const countSql =
      "SELECT COUNT(*) as total FROM customers" + whereClause;
    const [countRows] = await conn.execute(countSql, params);
    const total = countRows[0]?.total || 0;
    const totalPages = total === 0 ? 1 : Math.max(Math.ceil(total / pageSize), 1);
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const dataSql =
      "SELECT customer_id, date_created, lead_campaign, first_name, company, status, lead_source, stage from customers" +
      whereClause +
      " ORDER BY date_created DESC LIMIT ? OFFSET ?";

    const dataParams = [...params, pageSize, offset];
    const [customerRows] = await conn.execute(dataSql, dataParams);

    return NextResponse.json({
      customers: customerRows,
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