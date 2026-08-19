import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import { getReportees } from "@/lib/reportingManager";

/**
 * GET /api/empcrm/manager-expenses
 * 
 * Returns all expenses submitted by employees reporting to the current user.
 * Only accessible by users who have reportees (managers/team leaders).
 * 
 * Response format:
 * {
 *   success: boolean,
 *   data: [
 *     {
 *       id: number,
 *       username: string,
 *       TravelDate: string (YYYY-MM-DD),
 *       FromLocation: string,
 *       Tolocation: string,
 *       distance: number,
 *       description: string,
 *       person_name: string,
 *       person_contact: string,
 *       ConveyanceMode: string,
 *       TicketCost: number,
 *       HotelCost: number,
 *       MealsCost: number,
 *       OtherExpenses: number,
 *       attachments: string (comma-separated URLs),
 *       approval_status: string ('Pending' | 'Approved' | 'Rejected'),
 *       created_at: string (ISO timestamp),
 *       updated_at: string (ISO timestamp)
 *     }
 *   ],
 *   error?: string
 * }
 */
export async function GET(req) {
  try {
    // Get session payload
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const managerUsername = tokenPayload.username;

    // Get query parameters for date filtering
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Get list of employees reporting to this manager
    const reportees = await getReportees(managerUsername);

    if (reportees.length === 0) {
      // Manager has no reportees
      return NextResponse.json({
        success: true,
        data: [],
        message: "No employees reporting to you",
      });
    }

    // Query expenses from all reportees
    const conn = await getDbConnection();

    // Build placeholders for IN clause
    const placeholders = reportees.map(() => "?").join(",");

    // Build dynamic WHERE clause for date filtering
    let whereClause = `WHERE username IN (${placeholders})`;
    const queryParams = [...reportees];

    if (fromDate) {
      whereClause += ` AND TravelDate >= ?`;
      queryParams.push(fromDate);
    }

    if (toDate) {
      whereClause += ` AND TravelDate <= ?`;
      queryParams.push(toDate);
    }

    const [expenses] = await conn.execute(
      `SELECT 
        ID as id,
        username,
        TravelDate,
        FromLocation,
        Tolocation,
        distance,
        description,
        person_name,
        person_contact,
        ConveyanceMode,
        TicketCost,
        HotelCost,
        MealsCost,
        OtherExpenses,
        attachments,
        approval_status,
        approved_by,
        approved_amount,
        approval_date
       FROM expenses 
       ${whereClause}
       ORDER BY ID DESC`,
      queryParams
    );

    return NextResponse.json({
      success: true,
      data: expenses || [],
    });
  } catch (error) {
    console.error("Error fetching manager expenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch expenses",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/empcrm/manager-expenses/approve
 * 
 * Approve or reject an expense. Only accessible by the manager of the employee.
 */
export async function POST(req) {
  try {
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const managerUsername = tokenPayload.username;
    const body = await req.json();
    const { expenseId, status, remarks } = body;

    if (!expenseId || !status) {
      return NextResponse.json(
        { success: false, error: "Missing expenseId or status" },
        { status: 400 }
      );
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Use 'Approved' or 'Rejected'" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Fetch the expense to verify it belongs to a reportee
    const [expenseRows] = await conn.execute(
      `SELECT username FROM expenses WHERE ID = ? LIMIT 1`,
      [expenseId]
    );

    if (!expenseRows || expenseRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    const employeeUsername = expenseRows[0].username;

    // Verify this employee reports to the current user
    const reportees = await getReportees(managerUsername);
    if (!reportees.includes(employeeUsername)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: This expense does not belong to your team" },
        { status: 403 }
      );
    }

    // Update expense status
    await conn.execute(
      `UPDATE expenses 
       SET approval_status = ?
       WHERE ID = ?`,
      [status, expenseId]
    );

    return NextResponse.json({
      success: true,
      message: `Expense ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error("Error updating expense status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update expense",
      },
      { status: 500 }
    );
  }
}
