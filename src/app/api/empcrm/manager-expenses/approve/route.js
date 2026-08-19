import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import { getReportees } from "@/lib/reportingManager";

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
    const { expenseId, status, remarks, approvedAmount } = body;

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

    // Validate approved amount for Approved status
    if (status === "Approved" && (!approvedAmount || parseFloat(approvedAmount) <= 0)) {
      return NextResponse.json(
        { success: false, error: "Valid approved amount is required for approval" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Fetch the expense to verify it belongs to a reportee
    const [expenseRows] = await conn.execute(
      `SELECT username, TicketCost, HotelCost, MealsCost, OtherExpenses FROM expenses WHERE ID = ? LIMIT 1`,
      [expenseId]
    );

    if (!expenseRows || expenseRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    const employeeUsername = expenseRows[0].username;
    
    // Calculate total amount for validation
    const totalAmount = 
      Number(expenseRows[0].TicketCost || 0) +
      Number(expenseRows[0].HotelCost || 0) +
      Number(expenseRows[0].MealsCost || 0) +
      Number(expenseRows[0].OtherExpenses || 0);

    // Verify approved amount doesn't exceed total
    if (status === "Approved" && parseFloat(approvedAmount) > totalAmount) {
      return NextResponse.json(
        { success: false, error: `Approved amount cannot exceed total expense amount of ₹${totalAmount.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Verify this employee reports to the current user
    const reportees = await getReportees(managerUsername);
    if (!reportees.includes(employeeUsername)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: This expense does not belong to your team" },
        { status: 403 }
      );
    }

    // Get current date for approval
    const approvalDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Update expense status with approved_amount and approval_date
    if (status === "Approved") {
      await conn.execute(
        `UPDATE expenses 
         SET approval_status = ?, approved_by = ?, approved_amount = ?, approval_date = ?
         WHERE ID = ?`,
        [status, managerUsername, parseFloat(approvedAmount), approvalDate, expenseId]
      );
    } else {
      // For Rejected, update description with remarks if provided
      if (remarks && remarks.trim()) {
        await conn.execute(
          `UPDATE expenses 
           SET approval_status = ?, approved_by = ?, description = CONCAT(COALESCE(description, ''), '\n\nRejection Remarks: ', ?)
           WHERE ID = ?`,
          [status, managerUsername, remarks.trim(), expenseId]
        );
      } else {
        await conn.execute(
          `UPDATE expenses 
           SET approval_status = ?, approved_by = ?
           WHERE ID = ?`,
          [status, managerUsername, expenseId]
        );
      }
    }

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
