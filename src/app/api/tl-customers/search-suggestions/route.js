import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PRIVILEGED_ROLES = new Set([
  "ADMIN",
  "SUPERADMIN",
  "TEAM LEADER",
  "DIRECTOR",
  "SERVICE HEAD",
]);

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = String(new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 1) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const conn = await getDbConnection();
    const role = String(payload.role ?? payload.userRole ?? "")
      .trim()
      .toUpperCase();
    const username = String(payload.username ?? "").trim();
    const isPrivileged = PRIVILEGED_ROLES.has(role);
    const isEA = role === "EA";

    const searchTerm = `%${q}%`;
    const params = [q, searchTerm, searchTerm, searchTerm, searchTerm];
    let scopeSql = "";
    if (!isPrivileged) {
      if (isEA) {
        scopeSql = ` AND (c.assigned_to = ? OR c.lead_source = ?)`;
        params.push(username, username);
      } else {
        scopeSql = ` AND (c.assigned_to = ? OR c.lead_source = ?)`;
        params.push(username, username);
      }
    }

    const [rows] = await conn.execute(
      `SELECT
         c.customer_id,
         c.first_name,
         c.last_name,
         c.company,
         c.phone,
         c.lead_source,
         tlf.followed_date AS tl_followed_date,
         tlf.next_followup_date AS tl_next_followup,
         tlf.notes AS tl_notes,
         tlf.followed_by AS tl_followed_by
       FROM customers c
       LEFT JOIN (
         SELECT customer_id, followed_date, next_followup_date, notes, followed_by,
                ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
         FROM TL_followups
       ) tlf ON c.customer_id = tlf.customer_id AND tlf.rn = 1
       WHERE (
         c.customer_id = ?
         OR c.phone LIKE ?
         OR c.first_name LIKE ?
         OR c.last_name LIKE ?
         OR c.company LIKE ?
       )
       ${scopeSql}
       ORDER BY c.date_created DESC
       LIMIT 12`,
      params,
    );

    const suggestions = rows.map((row) => {
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        row.company ||
        "";
      return {
        customer_id: row.customer_id,
        name,
        company: row.company || "",
        phone: row.phone || "",
        lead_source: row.lead_source || "",
        tl_followed_date: row.tl_followed_date || null,
        tl_next_followup: row.tl_next_followup || null,
        tl_notes: row.tl_notes || "",
        tl_followed_by: row.tl_followed_by || "",
      };
    });

    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    console.error("tl-customers search-suggestions:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
