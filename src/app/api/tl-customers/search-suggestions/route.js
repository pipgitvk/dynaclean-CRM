import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  attachHeaderFollowupFields,
  latestEmployeeFollowupsByCustomerIds,
  latestTlFollowupsByCustomerIds,
} from "@/lib/customerHeaderSearchFollowup";

export const dynamic = "force-dynamic";

const PRIVILEGED_ROLES = new Set([
  "ADMIN",
  "SUPERADMIN",
  "TEAM LEADER",
  "DIRECTOR",
  "SERVICE HEAD",
]);

const MIN_QUERY_LEN = 2;

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = String(new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < MIN_QUERY_LEN) {
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
    const params = [q, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
    let scopeSql = "";
    if (!isPrivileged) {
      scopeSql = ` AND (c.assigned_to = ? OR c.lead_source = ?)`;
      params.push(username, username);
    }

    const [customers] = await conn.execute(
      `SELECT
         c.customer_id,
         c.first_name,
         c.last_name,
         c.company,
         c.phone,
         c.lead_source
       FROM customers c
       WHERE (
         c.customer_id = ?
         OR c.phone LIKE ?
         OR c.first_name LIKE ?
         OR c.last_name LIKE ?
         OR c.company LIKE ?
         OR c.gstin LIKE ?
       )
       ${scopeSql}
       ORDER BY c.date_created DESC
       LIMIT 12`,
      params,
    );

    if (!customers.length) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const customerIds = customers.map((c) => c.customer_id);
    const [tlById, empById] = await Promise.all([
      latestTlFollowupsByCustomerIds(conn, customerIds),
      latestEmployeeFollowupsByCustomerIds(conn, customerIds),
    ]);

    const suggestions = customers.map((c) => {
      const cid = String(c.customer_id);
      const tlf = tlById.get(cid) || {};
      const name =
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        c.company ||
        "";
      const merged = attachHeaderFollowupFields(
        {
          customer_id: c.customer_id,
          first_name: c.first_name,
          last_name: c.last_name,
          name,
          company: c.company || "",
          phone: c.phone || "",
          lead_source: c.lead_source || "",
          tl_next_followup: tlf.next_followup_date || null,
          tl_followed_by: tlf.followed_by || "",
        },
        tlf,
        empById.get(cid),
      );
      return {
        ...merged,
        last_note: merged.last_followup_note,
        last_note_at: merged.last_followup_at,
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
