import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET: Fetch leave statistics
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
    const username = searchParams.get("username") || session.username;
    
    const conn = await getDbConnection();
    
    // Check if user is admin/HR
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    
    // If not admin, only allow viewing own stats
    if (!isAdmin && username !== session.username) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }
    
    // Fetch user's profile to get leave policy and date of joining
    const [profiles] = await conn.execute(
      `SELECT employment_status, leave_policy, date_of_joining FROM employee_profiles WHERE username = ?`,
      [username]
    );

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee profile not found" },
        { status: 404 }
      );
    }

    const profile = profiles[0];
    let leavePolicy = {};
    
    try {
      leavePolicy = profile.leave_policy ? JSON.parse(profile.leave_policy) : {};
    } catch {
      leavePolicy = {};
    }

    // Calculate accrued leaves based on date of joining or custom accrual start date
    const calculateAccruedLeaves = (joiningDate, accrualStartDate, maxAllowed, employmentStatus) => {
      // Use custom accrual start date if provided, otherwise use date of joining
      const effectiveDate = accrualStartDate || joiningDate;
      
      if (!effectiveDate) return maxAllowed;
      
      const doj = new Date(effectiveDate);
      const today = new Date();
      
      // If on probation, no paid leave accrual
      if (employmentStatus === 'probation') {
        return 0;
      }
      
      // Calculate complete months since effective date
      const monthsDiff = (today.getFullYear() - doj.getFullYear()) * 12 + (today.getMonth() - doj.getMonth());
      
      // Accrue 1 day per month, capped at maxAllowed
      const accrued = Math.min(monthsDiff, maxAllowed);
      
      return Math.max(0, accrued);
    };

    // Fetch leave statistics for current year
    const [stats] = await conn.execute(
      `SELECT 
        leave_type,
        SUM(CASE WHEN status = 'approved' THEN total_days ELSE 0 END) as taken,
        SUM(CASE WHEN status = 'pending' THEN total_days ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN total_days ELSE 0 END) as rejected
       FROM employee_leaves 
       WHERE username = ? 
       AND YEAR(from_date) = YEAR(CURDATE())
       GROUP BY leave_type`,
      [username]
    );

    // Build leave summary
    const leaveTypes = ['sick', 'paid', 'casual'];
    const leaveSummary = leaveTypes.map(type => {
      const allowedKey = `${type}_allowed`;
      const enabledKey = `${type}_enabled`;
      const maxAllowed = leavePolicy[allowedKey] || 0;
      const enabled = leavePolicy[enabledKey] || false;
      
      // Calculate accrued leaves based on custom accrual start date, date of joining, and employment status
      const accruedAllowed = calculateAccruedLeaves(
        profile.date_of_joining,
        leavePolicy.accrual_start_date,
        maxAllowed,
        profile.employment_status
      );
      
      const statRecord = stats.find(s => s.leave_type === type);
      const taken = statRecord ? statRecord.taken : 0;
      const pending = statRecord ? statRecord.pending : 0;
      const rejected = statRecord ? statRecord.rejected : 0;
      const available = Math.max(0, accruedAllowed - taken);
      
      // Disable paid and sick leave during probation
      const isDisabledDueToProbation = (type === 'paid' || type === 'sick') && profile.employment_status === 'probation';
      
      return {
        type,
        enabled: enabled && !isDisabledDueToProbation,
        allowed: accruedAllowed,
        taken,
        pending,
        rejected,
        available
      };
    });

    // Count unpaid leaves
    const unpaidStats = stats.find(s => s.leave_type === 'unpaid');
    const unpaidLeaves = {
      type: 'unpaid',
      enabled: true,
      taken: unpaidStats ? unpaidStats.taken : 0,
      pending: unpaidStats ? unpaidStats.pending : 0,
      rejected: unpaidStats ? unpaidStats.rejected : 0
    };

    return NextResponse.json({
      success: true,
      employment_status: profile.employment_status,
      leaveSummary,
      unpaidLeaves,
      totalApprovedDays: stats.reduce((sum, s) => sum + (s.taken || 0), 0),
      totalPendingDays: stats.reduce((sum, s) => sum + (s.pending || 0), 0)
    });
  } catch (error) {
    console.error("Error fetching leave stats:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
