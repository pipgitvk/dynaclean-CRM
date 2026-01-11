import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamLeader = searchParams.get("teamLeader");
    
    const connection = await getDbConnection();

    // Correct query: Show TL followups where the TL is monitoring customers assigned to other employees
    const query = `
      SELECT 
        c.customer_id,
        c.first_name,
        c.last_name,
        c.phone,
        c.company,
        c.products_interest,
        c.status,
        c.stage,
        c.lead_source,
        tlf.id as tl_followup_id,
        tlf.estimated_order_date,
        tlf.lead_quality_score,
        tlf.multi_tag,
        tlf.notes as tl_notes,
        tlf.next_followup_date,
        tlf.followed_date,
        tlf.created_at,
        tlf.assigned_employee
      FROM customers c
      INNER JOIN TL_followups tlf ON c.customer_id = tlf.customer_id
      WHERE tlf.followed_by = ?
        AND c.status != 'DENIED'
        AND tlf.id = (
          SELECT MAX(id) 
          FROM TL_followups 
          WHERE customer_id = c.customer_id
        )
      ORDER BY tlf.next_followup_date ASC, tlf.created_at DESC
    `;

    const [rows] = await connection.execute(query, [teamLeader]);

    return NextResponse.json({
      success: true,
      followups: rows
    });

  } catch (error) {
    console.error("Error fetching TL followups:", error);
    return NextResponse.json(
      { error: "Failed to fetch TL followups" },
      { status: 500 }
    );
  }
}
