import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    // Check authorization - only admin or the user themselves
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(session.role);
    if (username !== session.username && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const conn = await getDbConnection();

    // Get employee profile to check accrual_start_date and paid_allowed
    const [profile] = await conn.execute(
      `SELECT leave_policy FROM employee_profiles WHERE username = ?`,
      [username]
    );

    let accrualStartDate = null;
    let paidAllowed = 0;

    if (profile && profile.length > 0) {
      try {
        const leavePolicy = typeof profile[0].leave_policy === 'string' 
          ? JSON.parse(profile[0].leave_policy) 
          : profile[0].leave_policy;
        accrualStartDate = leavePolicy?.accrual_start_date;
        paidAllowed = leavePolicy?.paid_allowed || 0;
      } catch (e) {
        console.log("Could not parse leave_policy");
      }
    }

    if (!accrualStartDate || paidAllowed === 0) {
      return NextResponse.json({
        success: true,
        ledger: [],
        summary: { totalCredit: 0, totalDebit: 0, balance: 0 },
        accrualStartDate
      });
    }

    // Fetch all paid leaves taken (used) - only those after accrual_start_date
    const leavesQuery = `
      SELECT 
        el.id,
        el.username,
        el.leave_type,
        el.from_date,
        el.to_date,
        el.total_days,
        el.status,
        el.reason,
        el.created_at
      FROM employee_leaves el
      WHERE el.username = ? AND el.leave_type = 'paid' AND el.status = 'approved'
      AND el.from_date >= ?
      ORDER BY el.from_date ASC
    `;

    const [leavesUsed] = await conn.execute(leavesQuery, [username, accrualStartDate]);

    // Fetch all unpaid leaves - approved, pending, and rejected (for ledger display)
    const unpaidLeavesQuery = `
      SELECT 
        el.id,
        el.username,
        el.leave_type,
        el.from_date,
        el.to_date,
        el.total_days,
        el.status,
        el.reason,
        el.created_at,
        el.rejection_reason
      FROM employee_leaves el
      WHERE el.username = ? AND el.leave_type = 'unpaid'
      ORDER BY el.from_date ASC
    `;

    const [unpaidLeaves] = await conn.execute(unpaidLeavesQuery, [username]);

    // Build ledger with monthly accruals
    const ledgerEntries = [];

    // Generate monthly accruals from accrual_start_date to today
    const startDate = new Date(accrualStartDate);
    const today = new Date();
    
    let currentDate = new Date(startDate);
    const monthlyAccruals = [];

    while (currentDate <= today) {
      const accrualMonth = new Date(currentDate);
      monthlyAccruals.push({
        date: accrualMonth,
        days: paidAllowed / 12 // Monthly accrual (divide annual by 12)
      });

      // Move to next month on the same day
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Add all monthly accruals
    monthlyAccruals.forEach(accrual => {
      ledgerEntries.push({
        type: "credit",
        date: accrual.date.toISOString().split('T')[0],
        days: Math.round(accrual.days * 100) / 100, // Round to 2 decimals
        description: `Monthly accrual (${accrual.date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`,
        entryType: "accrual"
      });
    });

    // Add debit (used) entries for paid leaves
    leavesUsed.forEach(leave => {
      ledgerEntries.push({
        type: "debit",
        date: leave.from_date,
        days: leave.total_days,
        description: `Paid Leave taken`,
        leaveId: leave.id,
        entryType: "usage",
        reason: leave.reason,
        leave_type: "paid",
        status: leave.status
      });
    });

    // Build unpaid leave ledger entries (debit only - no accrual)
    const unpaidLedgerEntries = unpaidLeaves.map(leave => ({
      type: "debit",
      date: leave.from_date,
      to_date: leave.to_date,
      days: leave.total_days,
      description: `Unpaid Leave (${leave.status})`,
      leaveId: leave.id,
      entryType: "usage",
      reason: leave.reason,
      leave_type: "unpaid",
      status: leave.status,
      rejection_reason: leave.rejection_reason
    }));

    // Calculate unpaid leave summary
    const unpaidSummary = {
      totalApproved: unpaidLeaves
        .filter(l => l.status === 'approved')
        .reduce((sum, l) => sum + l.total_days, 0),
      totalPending: unpaidLeaves
        .filter(l => l.status === 'pending')
        .reduce((sum, l) => sum + l.total_days, 0),
      totalRejected: unpaidLeaves
        .filter(l => l.status === 'rejected')
        .reduce((sum, l) => sum + l.total_days, 0),
      totalDays: unpaidLeaves.reduce((sum, l) => sum + l.total_days, 0)
    };

    // Sort by date
    const sortedLedger = ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalance = 0;
    const processedLedger = sortedLedger.map(entry => {
      if (entry.type === "credit") {
        runningBalance += entry.days;
      } else {
        runningBalance -= entry.days;
      }
      return {
        ...entry,
        runningBalance
      };
    });

    // Calculate summary
    const totalCredit = processedLedger
      .filter(e => e.type === "credit")
      .reduce((sum, e) => sum + e.days, 0);
    const totalDebit = processedLedger
      .filter(e => e.type === "debit")
      .reduce((sum, e) => sum + e.days, 0);
    const balance = totalCredit - totalDebit;

    // Sort unpaid entries by date
    const sortedUnpaidLedger = unpaidLedgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    return NextResponse.json({
      success: true,
      ledger: processedLedger,
      summary: {
        totalCredit: Math.round(totalCredit * 100) / 100,
        totalDebit: Math.round(totalDebit * 100) / 100,
        balance: Math.round(balance * 100) / 100
      },
      unpaidLedger: sortedUnpaidLedger,
      unpaidSummary,
      accrualStartDate
    });
  } catch (error) {
    console.error("Error fetching paid leave ledger:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
