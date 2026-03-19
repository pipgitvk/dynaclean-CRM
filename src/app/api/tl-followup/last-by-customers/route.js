import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Fetch last TL follow-up for multiple customer_ids
// Returns { "721037": { model, multi_tag, assigned_employee }, ... }
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customer_ids } = body;

    if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
      return NextResponse.json(
        { error: "customer_ids array is required" },
        { status: 400 }
      );
    }

    const placeholders = customer_ids.map(() => "?").join(",");
    const connection = await getDbConnection();

    const [rows] = await connection.execute(
      `SELECT customer_id, model, multi_tag, assigned_employee,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) as rn
       FROM TL_followups
       WHERE customer_id IN (${placeholders})`,
      customer_ids
    );

    const usernames = [...new Set((rows || []).map((r) => r.assigned_employee).filter(Boolean))];
    const nameByUsername = {};
    if (usernames.length > 0) {
      const ph = usernames.map(() => "?").join(",");
      const [nameRows] = await connection.execute(
        `SELECT username, full_name FROM employee_profiles WHERE username IN (${ph})`,
        usernames
      );
      for (const r of nameRows || []) {
        nameByUsername[r.username] = (r.full_name && String(r.full_name).trim()) || r.username;
      }
    }

    const result = {};
    for (const row of rows || []) {
      if (row.rn === 1 && row.customer_id != null) {
        const cid = String(row.customer_id);
        const username = row.assigned_employee || "";
        result[cid] = {
          model: row.model || "",
          multi_tag: row.multi_tag || "",
          assigned_employee: username ? (nameByUsername[username] || username) : "",
        };
      }
    }
    for (const cid of customer_ids) {
      const sid = String(cid);
      if (!result[sid]) {
        result[sid] = {
          model: "",
          multi_tag: "",
          assigned_employee: "",
        };
      }
    }

    return NextResponse.json({ success: true, lastFollowups: result });
  } catch (error) {
    console.error("Error fetching last follow-ups:", error);
    return NextResponse.json(
      { error: "Failed to fetch last follow-ups" },
      { status: 500 }
    );
  }
}
