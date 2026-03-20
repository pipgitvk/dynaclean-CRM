import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Fetch last TL follow-up for multiple customer_ids
// assigned_employee: same as TL Follow-up form — last follow-up's assigned_employee, else customers.lead_source; then display name from employee_profiles
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
      `SELECT 
        c.customer_id,
        c.lead_source,
        tlf.model,
        tlf.multi_tag,
        tlf.assigned_employee AS tlf_assigned,
        ROW_NUMBER() OVER (PARTITION BY c.customer_id ORDER BY tlf.created_at DESC) AS rn
       FROM customers c
       LEFT JOIN TL_followups tlf ON tlf.customer_id = c.customer_id
       WHERE c.customer_id IN (${placeholders})`,
      customer_ids
    );

    const byCid = {};
    for (const row of rows || []) {
      if (row.rn !== 1) continue;
      const cid = String(row.customer_id);
      const fromFollowup = row.tlf_assigned && String(row.tlf_assigned).trim();
      const fromLead = row.lead_source && String(row.lead_source).trim();
      const rawAssign = fromFollowup || fromLead || "";

      byCid[cid] = {
        model: row.model || "",
        multi_tag: row.multi_tag || "",
        assigned_employee_raw: rawAssign,
      };
    }

    const usernames = [...new Set(Object.values(byCid).map((v) => v.assigned_employee_raw).filter(Boolean))];
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
    for (const cid of customer_ids) {
      const sid = String(cid);
      const entry = byCid[sid];
      if (entry) {
        const raw = entry.assigned_employee_raw;
        result[sid] = {
          model: entry.model || "",
          multi_tag: entry.multi_tag || "",
          assigned_employee: raw ? (nameByUsername[raw] || raw) : "",
        };
      } else {
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
