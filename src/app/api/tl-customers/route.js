import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search"); // Can be customer_id, phone, or name
    const employee = searchParams.get("employee"); // Filter by employee
    const status = searchParams.get("status");
    const stage = searchParams.get("stage");
    const lead_campaign = searchParams.get("lead_campaign");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const connection = await getDbConnection();

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
        tlf.status as tl_status,
        tlf.notes as tl_notes,
        tlf.next_followup_date as tl_next_followup,
        tlf.followed_date as tl_followed_date
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, next_followup_date, followed_date, notes, followed_by,
        ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY time_stamp DESC) as rn
        FROM customers_followup
      ) cf ON c.customer_id = cf.customer_id AND cf.rn = 1
      LEFT JOIN (
        SELECT customer_id, id, estimated_order_date, lead_quality_score, multi_tag, status, notes, next_followup_date, followed_date,
        ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
        FROM TL_followups
      ) tlf ON c.customer_id = tlf.customer_id AND tlf.rn = 1
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

    // Filter by lead_campaign
    if (lead_campaign) {
      query += ` AND c.lead_campaign = ?`;
      params.push(lead_campaign);
    }

    // ✅ Date range filter (based on customer creation date)
    if (fromDate && toDate) {
    query += ` AND c.date_created BETWEEN ? AND ?`;
    params.push(`${fromDate} 00:00:00`, `${toDate} 23:59:59`);
  } else if (fromDate) {
    query += ` AND c.date_created >= ?`;
    params.push(`${fromDate} 00:00:00`);
  } else if (toDate) {
    query += ` AND c.date_created <= ?`;
    params.push(`${toDate} 23:59:59`);
  }

    query += ` ORDER BY c.date_created DESC LIMIT 500`;

    const [customers] = await connection.execute(query, params);

    return NextResponse.json({ success: true, customers });
  } catch (error) {
    console.error("Error fetching TL customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
