// app/api/followups/route.js
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  const { from, to, commMode, leadSource } = await req.json();

  const conn =await getDbConnection();

  let sql = `
    SELECT
      cf.customer_id, cf.name, c.company,
      cf.followed_date, cf.next_followup_date, cf.comm_mode,
      (SELECT notes FROM customers_followup
        WHERE customer_id = cf.customer_id
          AND DATE(followed_date) = DATE(?)
        ORDER BY followed_date DESC LIMIT 1
      ) AS selected_date_notes,
      (SELECT notes FROM customers_followup
        WHERE customer_id = cf.customer_id
        ORDER BY followed_date DESC LIMIT 1
      ) AS max_current_date_notes
    FROM customers_followup cf
    JOIN customers c ON cf.customer_id = c.customer_id
    WHERE 1=1
  `;
  const params = [from];

  if (to) {
    sql += ` AND DATE(cf.followed_date) BETWEEN ? AND ?`;
    params.push(from, to);
  } else {
    sql += ` AND DATE(cf.followed_date) = ?`;
    params.push(from);
  }

  if (leadSource) {
    sql += ` AND c.lead_source = ?`;
    params.push(leadSource);
  }

  if (commMode) {
    sql += ` AND cf.comm_mode = ?`;
    params.push(commMode);
  }

  sql += ` GROUP BY cf.customer_id ORDER BY cf.followed_date ASC`;

  const [rows] = await conn.execute(sql, params);
      // await conn.end();

  return Response.json(rows);
}
