// app/api/dashboard-data/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(req.url);

  // Identify the logged-in user
  const session = await getSessionPayload();
  const username = session?.username || null;
  const role = session?.role || null;

  // Roles that can see data for all employees
  const privilegedRoles = ["ADMIN", "SUPERADMIN", "TEAM LEADER", "HR"];

  let selectedEmployee = searchParams.get("employee") || "all";
  if (!privilegedRoles.includes(role) && username) {
    // For non-privileged users (e.g. SALES), always restrict to their own username
    selectedEmployee = username;
  }

  const startDate = dayjs(searchParams.get("startDate")).format("YYYY-MM-DD HH:mm:ss");
  const endDate = dayjs(searchParams.get("endDate")).format("YYYY-MM-DD HH:mm:ss");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "Start and end dates are required." },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch employee list
    const employeeQuery = `SELECT username FROM rep_list where status = 1`;
    const [employeeRows] = await conn.execute(employeeQuery);
    let employees = employeeRows.map((row) => row.username);

    // Non-privileged users should only see themselves in the dropdown
    if (!privilegedRoles.includes(role) && username) {
      employees = employees.filter((u) => u === username);
      if (employees.length === 0) {
        employees = [username];
      }
    }

    // 2. Fetch Good Followups
    let followupsQuery = `
      SELECT
        cf.customer_id,
        c.first_name AS name,
        c.phone,
        c.lead_source,
        c.stage,
        cf.notes,
        cf.followed_date
      FROM
        customers_followup cf
      JOIN
        customers c ON cf.customer_id = c.customer_id
      WHERE
        cf.followed_date >= ?
        AND cf.followed_date <= ?
    `.trim();
    const followupsParams = [startDate, endDate];
    if (selectedEmployee !== "all") {
      followupsQuery += ` AND c.lead_source = ?`;
      followupsParams.push(selectedEmployee);
    }
    const [followups] = await conn.execute(followupsQuery, followupsParams);

    // 3. Fetch Quotations
    let quotationsQuery = `
      SELECT
        quote_number,
        customer_id,
        company_name,
        emp_name,
        ship_to,
        grand_total
      FROM quotations_records
      WHERE created_at >= ?
        AND created_at <= ?
    `.trim();
    const quotationsParams = [startDate, endDate];
    if (selectedEmployee !== "all") {
      quotationsQuery += ` AND emp_name = ?`;
      quotationsParams.push(selectedEmployee);
    }
    const [quotations] = await conn.execute(quotationsQuery, quotationsParams);

    // 4. Fetch New Orders
    let newOrdersQuery = `
      SELECT
        order_id,
        client_name,
        contact,
        company_name,
        created_by
      FROM neworder
      WHERE created_at >= ?
        AND created_at <= ?
    `.trim();
    const newOrdersParams = [startDate, endDate];
    if (selectedEmployee !== "all") {
      newOrdersQuery += ` AND created_by = ?`;
      newOrdersParams.push(selectedEmployee);
    }
    const [newOrders] = await conn.execute(newOrdersQuery, newOrdersParams);

    // 5. Fetch Demo Registrations
    let demosQuery = `
      SELECT
        customer_name,
        mobile,
        company,
        demo_date_time,
        demo_address,
        username,
        machine1,
        model1,
        machine2,
        model2,
        machine3,
        model3,
        demo_status
      FROM demoregistration
      WHERE created_at >= ?
        AND created_at <= ?
    `.trim();
    const demosParams = [startDate, endDate];
    if (selectedEmployee !== "all") {
      demosQuery += ` AND username = ?`;
      demosParams.push(selectedEmployee);
    }
    const [demos] = await conn.execute(demosQuery, demosParams);

    return NextResponse.json({
      employees,
      followups,
      quotations,
      newOrders,
      demos,
    });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}