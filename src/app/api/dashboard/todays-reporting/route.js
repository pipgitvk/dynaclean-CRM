import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getTodayYmdIST } from "@/lib/prospectCommitmentRules";
import { mysqlUpperBoundIstDayEnd } from "@/lib/timezone";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = payload.username;
    const connection = await getDbConnection();

    const today = getTodayYmdIST();
    const reportingThrough =
      mysqlUpperBoundIstDayEnd(today) ?? `${today} 23:59:59`;

    // Latest TL follow-up with reporting date on or before end of today (IST)
    const [rows] = await connection.execute(
      `SELECT COUNT(DISTINCT c.customer_id) as count 
       FROM customers c
       INNER JOIN (
         SELECT customer_id, MAX(id) as latest_id
         FROM TL_followups
         GROUP BY customer_id
       ) tlf_latest ON c.customer_id = tlf_latest.customer_id
       INNER JOIN TL_followups tlf ON tlf.id = tlf_latest.latest_id
       WHERE c.sales_representative = ? 
       AND tlf.next_followup_date IS NOT NULL
       AND tlf.next_followup_date <= ?`,
      [username, reportingThrough]
    );

    const count = rows[0]?.count || 0;

    return NextResponse.json({ count, success: true });
  } catch (error) {
    console.error("Error fetching today's reporting count:", error);
    return NextResponse.json(
      { error: "Failed to fetch today's reporting count" },
      { status: 500 }
    );
  }
}
