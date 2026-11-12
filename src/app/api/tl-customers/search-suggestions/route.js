import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { pickLatestNoteForSearch } from "@/lib/tlSearchSuggestionNote";

export const dynamic = "force-dynamic";

const PRIVILEGED_ROLES = new Set([
  "ADMIN",
  "SUPERADMIN",
  "TEAM LEADER",
  "DIRECTOR",
  "SERVICE HEAD",
]);

const MIN_QUERY_LEN = 2;

function latestByCustomerId(rows, idKey = "customer_id") {
  const map = new Map();
  for (const row of rows || []) {
    const id = row[idKey];
    if (id == null) continue;
    map.set(String(id), row);
  }
  return map;
}

async function latestTlFollowupsByCustomerIds(conn, customerIds) {
  if (!customerIds.length) return new Map();
  const placeholders = customerIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT t.customer_id, t.notes, t.followed_date, t.created_at,
            t.next_followup_date, t.followed_by
     FROM TL_followups t
     INNER JOIN (
       SELECT customer_id, MAX(created_at) AS max_created
       FROM TL_followups
       WHERE customer_id IN (${placeholders})
       GROUP BY customer_id
     ) latest
       ON t.customer_id = latest.customer_id AND t.created_at = latest.max_created`,
    customerIds,
  );
  return latestByCustomerId(rows);
}

async function latestCfFollowupsByCustomerIds(conn, customerIds) {
  if (!customerIds.length) return new Map();
  const placeholders = customerIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT t.customer_id, t.notes, t.followed_date, t.time_stamp
     FROM customers_followup t
     INNER JOIN (
       SELECT customer_id, MAX(time_stamp) AS max_ts
       FROM customers_followup
       WHERE customer_id IN (${placeholders})
       GROUP BY customer_id
     ) latest
       ON t.customer_id = latest.customer_id AND t.time_stamp = latest.max_ts`,
    customerIds,
  );
  return latestByCustomerId(rows);
}

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
    const params = [q, searchTerm, searchTerm, searchTerm, searchTerm];
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
    const [tlById, cfById] = await Promise.all([
      latestTlFollowupsByCustomerIds(conn, customerIds),
      latestCfFollowupsByCustomerIds(conn, customerIds),
    ]);

    const suggestions = customers.map((c) => {
      const cid = String(c.customer_id);
      const tlf = tlById.get(cid) || {};
      const cf = cfById.get(cid) || {};
      const row = {
        customer_id: c.customer_id,
        first_name: c.first_name,
        last_name: c.last_name,
        company: c.company,
        phone: c.phone,
        lead_source: c.lead_source,
        tl_followed_date: tlf.followed_date || null,
        tl_created_at: tlf.created_at || null,
        tl_next_followup: tlf.next_followup_date || null,
        tl_notes: tlf.notes || "",
        tl_followed_by: tlf.followed_by || "",
        cf_notes: cf.notes || "",
        cf_followed_date: cf.followed_date || null,
        cf_time_stamp: cf.time_stamp || null,
      };
      const name =
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        c.company ||
        "";
      const { last_note, last_note_at } = pickLatestNoteForSearch(row);
      return {
        customer_id: c.customer_id,
        name,
        company: c.company || "",
        phone: c.phone || "",
        lead_source: c.lead_source || "",
        tl_followed_date: row.tl_followed_date,
        tl_next_followup: row.tl_next_followup,
        tl_notes: row.tl_notes,
        tl_followed_by: row.tl_followed_by,
        last_note,
        last_note_at,
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
