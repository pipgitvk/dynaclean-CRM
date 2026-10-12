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
    
    // Auto-migration: Ensure 'half-day' value exists in leave_type ENUM
    try {
      await conn.execute(`ALTER TABLE employee_leaves MODIFY COLUMN leave_type enum('sick','paid','casual','unpaid','half-day') NOT NULL`);
    } catch (e) { /* ignore - already applied */ }
    // Auto-migration: Add acknowledgment columns if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN acknowledged_at timestamp NULL DEFAULT NULL COMMENT 'Acknowledgment timestamp (SuperAdmin/ReportingManager)'`);
    } catch (e) { /* ignore */ }
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN acknowledged_by varchar(255) DEFAULT NULL COMMENT 'Username who acknowledged the leave'`);
    } catch (e) { /* ignore */ }
    
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
    const calculateAccruedLeaves = (joiningDate, accrualStartDate, maxAllowed, employmentStatus, leaveType) => {
      // Use custom accrual start date if provided, otherwise use date of joining
      const effectiveDate = accrualStartDate || joiningDate;
      
      if (!effectiveDate) return maxAllowed;
      
      const doj = new Date(effectiveDate);
      const today = new Date();
      
      // No accrual during probation
      if (employmentStatus === 'probation') {
        return 0;
      }
      
      // Sick leave shows full amount immediately (no monthly accrual)
      if (leaveType === 'sick') {
        return maxAllowed;
      }
      
      // Paid leave accrues monthly based on the day of the accrual start date
      const accrualDay = doj.getDate();
      const currentDay = today.getDate();

      // Calculate full months difference
      const monthsDiff = (today.getFullYear() - doj.getFullYear()) * 12 + (today.getMonth() - doj.getMonth());

      let accrued = monthsDiff;

      // Add 1 if current day is on or after the accrual day (first month counts if day reached)
      if (currentDay >= accrualDay) {
        accrued += 1;
      }

      // Cap at max allowed
      accrued = Math.min(accrued, maxAllowed);

      return Math.max(0, accrued);
    };

    // 🛠️ BACKFILL: Fix corrupt half-day records (legacy bugs stored total_days=0 OR 1 instead of 0.5)
    // This permanently corrects DB rows so SUM(total_days) matches expected 0.5 per half-day record.
    try {
      const [fixedInfo] = await conn.execute(
        `UPDATE employee_leaves 
         SET total_days = 0.5 
         WHERE username = ? 
           AND is_half_day = 1 
           AND (total_days IS NULL OR total_days != 0.5)`,
        [username]
      );
      if (fixedInfo.affectedRows > 0) {
        console.log(`[stats-backfill] Normalized ${fixedInfo.affectedRows} half-day records → total_days=0.5 for user ${username}`);
      }
    } catch (bfErr) {
      console.warn("[stats-backfill] Could not apply half-day total_days fix:", bfErr.message);
    }

    // Fetch leave statistics for current year
    // is_half_day=0: full leaves grouped by leave_type
    // is_half_day=1: half-day leaves (any leave_type) grouped separately
    // Note: total_days values are already backfilled above. As a display-level safety net,
    // for every half-day row we still clamp per-day contribution to a minimum of 0.5.
    const [rawStats] = await conn.execute(
      `SELECT 
        leave_type,
        is_half_day,
        COUNT(*) AS row_count,
        SUM(CASE WHEN status = 'approved' THEN total_days ELSE 0 END) as taken,
        SUM(CASE WHEN status = 'pending' THEN total_days ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN total_days ELSE 0 END) as rejected
       FROM employee_leaves 
       WHERE username = ? 
       AND YEAR(from_date) = YEAR(CURDATE())
       GROUP BY leave_type, is_half_day`,
      [username]
    );

    // 🔒 Display layer safety: For half-day groups, normalize SUM to row_count × 0.5
    // regardless of what total_days is stored in DB. Ratio of taken/pending/rejected
    // is preserved from the DB sums.
    const stats = rawStats.map(s => {
      const isHalf = s.is_half_day == 1;
      if (!isHalf) return s;
      const halfRowCount = Number(s.row_count || 0);
      const expectedTotal = halfRowCount * 0.5;
      const dbTotal = Number(s.taken || 0) + Number(s.pending || 0) + Number(s.rejected || 0);

      if (dbTotal <= 0) {
        // No valid DB sums — fall back to assuming taken = expectedTotal (same as before)
        return { ...s, taken: expectedTotal, pending: 0, rejected: 0 };
      }

      // Scale each status pro-rata so overall sum equals row_count × 0.5
      const ratio = expectedTotal / dbTotal;
      return {
        ...s,
        taken:    Number((Number(s.taken    || 0) * ratio).toFixed(2)),
        pending:  Number((Number(s.pending  || 0) * ratio).toFixed(2)),
        rejected: Number((Number(s.rejected || 0) * ratio).toFixed(2)),
      };
    });

    // Build leave summary — combine full-day (1 day each) + half-day (0.5 day each) leaves per type
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
        profile.employment_status,
        type
      );
      
      // Count BOTH full-day AND half-day rows for the same leave_type
      const typeRows = stats.filter(s => s.leave_type === type);
      const taken    = typeRows.reduce((sum, s) => sum + Number(s.taken    || 0), 0);
      const pending  = typeRows.reduce((sum, s) => sum + Number(s.pending  || 0), 0);
      const rejected = typeRows.reduce((sum, s) => sum + Number(s.rejected || 0), 0);
      // Allow negative available so user can see how far they've overdrawn (no Math.max(0,x))
      const rawAvailable = accruedAllowed - taken;
      const available = Number.isFinite(rawAvailable) ? Number(rawAvailable.toFixed(2)) : 0;
      
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

    // Count unpaid leaves (full-day + half-day)
    const unpaidRows = stats.filter(s => s.leave_type === "unpaid");
    const unpaidLeaves = {
      type: "unpaid",
      enabled: true,
      taken: unpaidRows.reduce((sum, s) => sum + Number(s.taken || 0), 0),
      pending: unpaidRows.reduce((sum, s) => sum + Number(s.pending || 0), 0),
      rejected: unpaidRows.reduce((sum, s) => sum + Number(s.rejected || 0), 0),
    };

    // Count half-day leaves — all rows where is_half_day=1, any leave_type
    const halfDayRows = stats.filter(s => s.is_half_day == 1);
    const halfDayLeaves = {
      type: 'half-day',
      enabled: true,
      taken:   halfDayRows.reduce((sum, s) => sum + Number(s.taken || 0),   0),
      pending: halfDayRows.reduce((sum, s) => sum + Number(s.pending || 0), 0),
      rejected:halfDayRows.reduce((sum, s) => sum + Number(s.rejected || 0),0),
    };

    return NextResponse.json({
      success: true,
      employment_status: profile.employment_status,
      accrual_start_date: leavePolicy.accrual_start_date || null,
      leaveSummary,
      unpaidLeaves,
      halfDayLeaves,
      totalApprovedDays: stats.reduce((sum, s) => sum + Number(s.taken || 0),   0),
      totalPendingDays:  stats.reduce((sum, s) => sum + Number(s.pending || 0), 0)
    });
  } catch (error) {
    console.error("Error fetching leave stats:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
