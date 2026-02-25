// /app/api/installations/upcoming/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

/**
 * API route for upcoming installations.
 *  - neworder (primary)
 *  - quotations (to get model(s) and item_name) via quote_number
 *
 * Highlights installations within 10 days and past expected delivery dates.
 */
export async function GET(req) {
  try {
    const query = `
      SELECT
        no.id,
        no.order_id,
        no.quote_number,
        GROUP_CONCAT(DISTINCT d.item_code SEPARATOR ', ') AS model,
        GROUP_CONCAT(DISTINCT d.item_name SEPARATOR ', ') AS name,
        no.delivery_location AS delivery_address,
        no.company_name,
        no.contact,
        no.created_by AS emp_name,
        DATE_FORMAT(no.delivery_date, '%Y-%m-%d') AS delivery_date,
        CASE 
          WHEN no.delivery_date < CURDATE() THEN 'overdue'
          WHEN no.delivery_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 'upcoming'
          ELSE 'scheduled'
        END AS installation_status,
        DATEDIFF(no.delivery_date, CURDATE()) AS days_until_installation
      FROM neworder no
       JOIN dispatch d ON d.quote_number COLLATE utf8mb3_unicode_ci = no.quote_number COLLATE utf8mb3_unicode_ci
       WHERE d.serial_no IS NOT NULL AND d.serial_no <> ''
       AND no.installation_status = 0
       AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
       AND (no.is_cancelled = 0 or no.is_cancelled IS NULL)
       AND no.delivery_date IS NOT NULL
       AND no.dispatch_status = 1
      AND (
        no.delivery_date < CURDATE() OR
        no.delivery_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY)
      )
      GROUP BY no.id
      ORDER BY days_until_installation ASC;
    `;

    const pool = await getDbConnection();
    const [rows] = await pool.query(query);

    return NextResponse.json({
      installations: rows,
      total: rows.length,
      totalPages: 1,
      currentPage: 1,
      pageSize: rows.length
    });
  } catch (error) {
    console.error("Error fetching upcoming installations:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch upcoming installations",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
