import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getReportees } from "@/lib/reportingManager";

// GET: Fetch leaves (admin sees all, users see only their own, reporting manager sees reportees only)
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
    const status = searchParams.get("status");
    const usernameParam = searchParams.get("username");
    const mode = searchParams.get("mode");

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
    // Auto-migration: Add start_time and end_time columns if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN start_time time DEFAULT NULL COMMENT 'Leave start time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN end_time time DEFAULT NULL COMMENT 'Leave end time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }

    const referer = request.headers.get("referer") || "";
    const forceUserMode = referer.includes("user-dashboard");
    const forceAdminMode = referer.includes("admin-dashboard");
    const isRealAdmin = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"].includes(session.role);

    // Reporting manager mode: user has reportees and is fetching for approval
    const reportees = await getReportees(session.username);
    const isReportingManager = reportees.length > 0; // Also allow HR/HR HEAD to be RMs if they have reportees
    const requestingApprovalMode = mode === "approve" || referer.includes("leave-approvals");

    // If requesting approval mode but no reportees AND not an admin, return empty
    if (requestingApprovalMode && !isReportingManager && !isRealAdmin) {
      return NextResponse.json({
        success: true,
        leaves: [],
        isAdmin: false,
      });
    }

    const reportingManagerMode = requestingApprovalMode && isReportingManager;

    let isAdmin = forceAdminMode ? true : forceUserMode ? false : isRealAdmin;
    if (reportingManagerMode) isAdmin = true;

    let query = `
      SELECT el.*, ep.employment_status, ep.leave_policy 
      FROM employee_leaves el
      LEFT JOIN employee_profiles ep ON el.username = ep.username
      WHERE 1=1
    `;
    const params = [];

    if (reportingManagerMode) {
      const placeholders = reportees.map(() => "?").join(", ");
      query += ` AND el.username IN (${placeholders})`;
      // Include self-submitted leaves only (employee submitted their own leave OR legacy NULL).
      // HR/admin-added leaves on behalf (created_by != username OR created_by is HR username) go to superadmin only.
      query += ` AND (el.created_by IS NULL OR el.created_by = el.username)`;
      params.push(...reportees);
    } else if (!isAdmin) {
      query += ` AND el.username = ?`;
      params.push(session.username);
    } else if (isAdmin && usernameParam) {
      query += ` AND el.username = ?`;
      params.push(usernameParam);
    }

    if (status) {
      query += ` AND el.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY el.created_at DESC`;

    const [leaves] = await conn.execute(query, params);

    // Parse leave_policy JSON
    leaves.forEach((leave) => {
      try {
        leave.leave_policy = leave.leave_policy
          ? JSON.parse(leave.leave_policy)
          : {};
      } catch {
        leave.leave_policy = {};
      }
    });

    return NextResponse.json({
      success: true,
      leaves,
      isAdmin
    });
  } catch (error) {
    console.error("Error fetching leaves:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}


// POST: Create new leave application
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    let { leave_type, from_date, to_date, reason, is_half_day, half_day_type, has_time_range, start_time, end_time, start_date_time, end_date_time } = body;

    // If combined datetime strings provided (e.g. "2026-09-10T14:30"), prefer them.
    // Unambiguous: time + date together. Extract date & time parts for DB columns.
    if (start_date_time) {
      const m = String(start_date_time).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
      if (m) {
        if (!from_date || has_time_range) from_date = m[1];
        start_time = m[2];
        has_time_range = true;
      }
    }
    if (end_date_time) {
      const m = String(end_date_time).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
      if (m) {
        if (!to_date || has_time_range) to_date = m[1];
        end_time = m[2];
        has_time_range = true;
      }
    }

    // Validation
    if (!leave_type || !from_date || !to_date || !reason) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }

    // If time range toggle is on, both times must be provided
    if (has_time_range) {
      if (!start_time || !end_time) {
        return NextResponse.json(
          { success: false, error: "Start time and End time are required when time range is enabled" },
          { status: 400 }
        );
      }
      if (start_time >= end_time) {
        return NextResponse.json(
          { success: false, error: "Start time must be before End time" },
          { status: 400 }
        );
      }
    } else {
      // When toggle is off, keep times NULL in DB
    }

    // Half-day specific validation
    const isHalfDay = !!is_half_day;
    if (isHalfDay && half_day_type && !["1st_half", "2nd_half"].includes(half_day_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid half_day_type. Must be '1st_half' or '2nd_half'" },
        { status: 400 }
      );
    }

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
    // Auto-migration: Add start_time and end_time columns if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN start_time time DEFAULT NULL COMMENT 'Leave start time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN end_time time DEFAULT NULL COMMENT 'Leave end time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }

    // Fetch user's profile to get leave policy, date of joining, and empId
    const [profiles] = await conn.execute(
      `SELECT id, empId, full_name, employment_status, leave_policy, date_of_joining FROM employee_profiles WHERE username = ?`,
      [session.username]
    );

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "Employee profile not found. Please contact HR." },
        { status: 404 }
      );
    }

    const profile = profiles[0];
    // Use empId from profile if session doesn't have it
    const empId = session.empId || profile.empId;

    if (!empId) {
      return NextResponse.json(
        { success: false, error: "Employee ID not found in profile. Please contact HR." },
        { status: 400 }
      );
    }

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

    // Calculate total days (half-day = 0.5 unless time range given, stored as decimal)
    let totalDays;
    if (isHalfDay) {
      // If time range provided for half-day, calculate actual fraction
      if (has_time_range && start_time && end_time) {
        try {
          const [schedRows] = await conn.execute(
            `SELECT checkin_time, checkout_time FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
            [session.username]
          );
          const timeToMinutes = (t) => {
            if (!t) return null;
            const parts = String(t).split(":");
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          };
          const workStart = timeToMinutes(schedRows[0]?.checkin_time) ?? 9 * 60;
          const workEnd   = timeToMinutes(schedRows[0]?.checkout_time) ?? 18 * 60;
          const workDayMinutes = workEnd - workStart;
          const fromDate = new Date(from_date);
          const toDate   = new Date(to_date);
          const dateDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
          const leaveStartMin = timeToMinutes(start_time);
          const leaveEndMin   = timeToMinutes(end_time);

          if (leaveStartMin !== null && leaveEndMin !== null && workDayMinutes > 0) {
            let coveredMinutes;
            if (dateDiff === 1) {
              coveredMinutes = Math.max(0, Math.min(leaveEndMin, workEnd) - Math.max(leaveStartMin, workStart));
            } else {
              const firstDayMin = Math.max(0, workEnd - Math.max(leaveStartMin, workStart));
              const lastDayMin  = Math.max(0, Math.min(leaveEndMin, workEnd) - workStart);
              const middleDays  = dateDiff - 2;
              coveredMinutes = firstDayMin + lastDayMin + middleDays * workDayMinutes;
            }
            totalDays = parseFloat((coveredMinutes / workDayMinutes).toFixed(1));
            totalDays = Math.max(0.5, Math.min(totalDays, dateDiff));
          } else {
            totalDays = 0.5;
          }
        } catch {
          totalDays = 0.5;
        }
      } else {
        totalDays = 0.5;
      }
    } else {
      const fromDate = new Date(from_date);
      const toDate = new Date(to_date);
      const dateDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
      if (dateDiff <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid date range" },
          { status: 400 }
        );
      }

      // If start_time and end_time are provided, adjust total_days:
      // - start_time belongs to from_date (leave starts mid-day)
      // - end_time belongs to to_date (leave ends mid-day)
      // We subtract the fraction of the first day before start_time
      // and the fraction of the last day after end_time,
      // based on a standard 9-hour working day (09:00 - 18:00 = 540 min).
      if (has_time_range && start_time && end_time) {
        try {
          // Fetch employee's schedule for accurate work window
          const [schedRows] = await conn.execute(
            `SELECT checkin_time, checkout_time FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
            [session.username]
          );
          const timeToMinutes = (t) => {
            if (!t) return null;
            const parts = String(t).split(":");
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          };

          // Work window: use schedule if available, else default 9:00 - 18:00
          const workStart = timeToMinutes(schedRows[0]?.checkin_time) ?? 9 * 60;   // 540
          const workEnd   = timeToMinutes(schedRows[0]?.checkout_time) ?? 18 * 60; // 1080
          const workDayMinutes = workEnd - workStart; // e.g. 540 min

          const leaveStartMin = timeToMinutes(start_time); // start_time on from_date
          const leaveEndMin   = timeToMinutes(end_time);   // end_time on to_date

          if (leaveStartMin !== null && leaveEndMin !== null && workDayMinutes > 0) {
            if (dateDiff === 1) {
              // Same day: fraction = (leaveEnd - leaveStart) / workDay
              const coveredMin = Math.max(0, Math.min(leaveEndMin, workEnd) - Math.max(leaveStartMin, workStart));
              totalDays = parseFloat((coveredMin / workDayMinutes).toFixed(1));
            } else {
              // Multi-day:
              // First day: from leaveStart to workEnd
              const firstDayMin  = Math.max(0, workEnd - Math.max(leaveStartMin, workStart));
              // Last day:  from workStart to leaveEnd
              const lastDayMin   = Math.max(0, Math.min(leaveEndMin, workEnd) - workStart);
              // Middle full days
              const middleDays   = dateDiff - 2;
              const totalMinutes = firstDayMin + lastDayMin + middleDays * workDayMinutes;
              totalDays = parseFloat((totalMinutes / workDayMinutes).toFixed(1));
            }
            // Safety: must be at least 0.5 and at most dateDiff
            totalDays = Math.max(0.5, Math.min(totalDays, dateDiff));
          } else {
            totalDays = dateDiff;
          }
        } catch {
          // Non-fatal: fall back to date diff
          totalDays = dateDiff;
        }
      } else {
        totalDays = dateDiff;
      }
    }

    // Skip validation for unpaid leave (always available) or half-day (0.5 day, minimal impact)
    if (leave_type !== 'unpaid' && !isHalfDay) {
      // Check if leave type is enabled for this employee
      const leaveTypeKey = `${leave_type}_enabled`;
      if (!leavePolicy[leaveTypeKey]) {
        return NextResponse.json(
          {
            success: false,
            error: `${leave_type} leave is not enabled for your profile. Please contact HR.`
          },
          { status: 400 }
        );
      }

      // Check if on probation and trying to apply for paid or sick leave
      if ((leave_type === 'paid' || leave_type === 'sick') && profile.employment_status === 'probation') {
        return NextResponse.json(
          {
            success: false,
            error: `${leave_type} leave is not available during probation period. Please use unpaid leave or contact HR.`
          },
          { status: 400 }
        );
      }

      // Calculate already taken leaves of this type
      const [takenLeaves] = await conn.execute(
        `SELECT COALESCE(SUM(total_days), 0) as taken 
         FROM employee_leaves 
         WHERE username = ? 
         AND leave_type = ? 
         AND status = 'approved'
         AND YEAR(from_date) = YEAR(CURDATE())`,
        [session.username, leave_type]
      );

      const takenCount = Number(takenLeaves[0].taken || 0);
      const allowedKey = `${leave_type}_allowed`;
      const maxAllowed = Number(leavePolicy[allowedKey] || 0);
      
      // Calculate accrued leaves based on custom accrual start date, date of joining, and employment status
      const accruedAllowed = Number(calculateAccruedLeaves(
        profile.date_of_joining,
        leavePolicy.accrual_start_date,
        maxAllowed,
        profile.employment_status,
        leave_type
      ));

      console.log('Leave validation debug:', {
        leave_type,
        takenCount,
        totalDays,
        accruedAllowed,
        available: accruedAllowed - takenCount,
        condition: takenCount + totalDays > accruedAllowed
      });

      // Check if requesting leave exceeds available balance
      if (takenCount + totalDays > accruedAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient ${leave_type} leave balance. Available: ${accruedAllowed - takenCount} days, Requested: ${totalDays} days`
          },
          { status: 400 }
        );
      }
    }

    // Auto-detect half_day_type from start_time vs employee's lunch break time
    let resolvedHalfDayType = half_day_type || null;
    if (isHalfDay) {
      try {
        const [schedRows] = await conn.execute(
          `SELECT break_lunch FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
          [session.username]
        );
        const lunchTime = schedRows[0]?.break_lunch; // "HH:MM:SS"

        const timeToMinutes = (t) => {
          if (!t) return null;
          const parts = String(t).split(":");
          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        };
        // Fallback lunch = 13:00 if schedule row missing or break_lunch not set
        const lunchMin = lunchTime ? timeToMinutes(lunchTime) : 13 * 60;
        const startMin = timeToMinutes(start_time); // from form (if provided)
        const endMin = timeToMinutes(end_time);

        if (startMin !== null && lunchMin !== null) {
          // start_time is after or at lunch → 2nd half
          resolvedHalfDayType = startMin >= lunchMin ? "2nd_half" : "1st_half";
        } else if (endMin !== null && lunchMin !== null) {
          // end_time is at or before lunch → 1st half
          resolvedHalfDayType = endMin <= lunchMin ? "1st_half" : "2nd_half";
        }
        // If neither start_time nor end_time provided, keep whatever user sent
      } catch (schedErr) {
        console.error("Could not auto-detect half_day_type:", schedErr);
        // Non-fatal — fall back to whatever was sent by client
      }
    }

    // Insert leave application
    // leave_type stays as user selected (paid/sick/casual/unpaid)
    // is_half_day flag separately indicates if it's a half-day duration
    const finalLeaveType = leave_type;
    const finalStartTime = has_time_range ? start_time : null;
    const finalEndTime = has_time_range ? end_time : null;
    const [result] = await conn.execute(
      `INSERT INTO employee_leaves 
       (username, empId, full_name, leave_type, from_date, to_date, start_time, end_time, total_days, is_half_day, half_day_type, reason, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.username,
        empId,
        profile.full_name || session.username,
        finalLeaveType,
        from_date,
        to_date,
        finalStartTime,
        finalEndTime,
        totalDays,
        isHalfDay ? 1 : 0,
        isHalfDay ? resolvedHalfDayType : null,
        reason,
        session.username
      ]
    );

    // Send email notification to HR
    try {
      // Fetch user's stored email credentials
      const [emailCreds] = await conn.execute(
        `SELECT smtp_host, smtp_port, smtp_user, smtp_pass 
         FROM email_credentials 
         WHERE username = ?`,
        [session.username]
      );

      if (emailCreds.length > 0) {
        const creds = emailCreds[0];

        // Dynamic import to avoid issues if nodemailer isn't used elsewhere
        const nodemailer = await import('nodemailer');

        const transporter = nodemailer.createTransport({
          host: creds.smtp_host || 'smtp.gmail.com',
          port: creds.smtp_port || 587,
          secure: creds.smtp_port === 465, // true for 465, false for other ports
          auth: {
            user: creds.smtp_user,
            pass: creds.smtp_pass,
          },
        });

        const hrEmail = 'hr@dynacleanindustries.com'; // Or fetch from env/config
        const tlEmail = 'tl@dynacleanindustries.com'; // Or fetch from env/config

        await transporter.sendMail({
          from: `"${profile.full_name || session.username}" <${creds.smtp_user}@dynacleanindustries.com>`,
          to: hrEmail,
          cc: tlEmail,
          subject: `New ${isHalfDay ? "Half-Day " : ""}Leave Application: ${profile.full_name || session.username} - ${leave_type.toUpperCase()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New ${isHalfDay ? "Half-Day " : ""}Leave Application</h2>
              <p>A new leave application has been submitted and requires your attention.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #f9fafb;">
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">Employee</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">${profile.full_name || session.username} (${empId})</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Leave Type</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">${leave_type.toUpperCase()}${isHalfDay ? ` — Half-Day (${half_day_type === "1st_half" ? "1st Half / Morning" : "2nd Half / Afternoon"})` : ""}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Duration</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">
                    ${new Date(from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${!isHalfDay ? ` To ${new Date(to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ""}
                    ${finalStartTime && finalEndTime ? `<br><span style="color:#111827; font-weight:600;">Time:</span> ${finalStartTime} — ${finalEndTime}` : ""}
                    <br>
                    <span style="color: #666; font-size: 0.9em;">(${isHalfDay ? "0.5 days" : `${totalDays} days`})</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Reason</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">${reason}</td>
                </tr>
              </table>

              <div style="margin-top: 30px; text-align: center;">
                <p>Please log in to the HR dashboard to approve or reject this request.</p>
                <a href="https://app.dynacleanindustries.com/empcrm/admin-dashboard/leave" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to HR Dashboard</a>
              </div>
            </div>
          `,
        });
      } else {
        console.warn(`No email credentials found for user ${session.username}. Skipping email notification.`);
      }
    } catch (emailError) {
      console.error("Error sending leave application email:", emailError);
      // Warning but don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: "Leave application submitted successfully",
      leaveId: result.insertId
    });
  } catch (error) {
    console.error("Error creating leave application:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH: Update leave status (approve/reject) - Admin/HR or Reporting Manager
export async function PATCH(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is SUPERADMIN or Reporting Manager
    const isSuperAdmin = session.role === "SUPERADMIN";
    const reportees = await getReportees(session.username);
    const isReportingManager = reportees.length > 0;

    if (!isSuperAdmin && !isReportingManager) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only SUPERADMIN or Reporting Manager can approve/reject leaves." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leaveId, status, rejection_reason, acknowledgement_remark, revert_acknowledgement } = body;

    if (!leaveId || (!status && !revert_acknowledgement)) {
      return NextResponse.json(
        { success: false, error: "Leave ID and status are required" },
        { status: 400 }
      );
    }

    if (status && !["approved", "rejected", "acknowledge"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be 'approved', 'rejected', or 'acknowledge'" },
        { status: 400 }
      );
    }

    if (status === "rejected" && !rejection_reason) {
      return NextResponse.json(
        { success: false, error: "Rejection reason is required" },
        { status: 400 }
      );
    }

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
    // Auto-migration: Add start_time and end_time columns if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN start_time time DEFAULT NULL COMMENT 'Leave start time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN end_time time DEFAULT NULL COMMENT 'Leave end time of day (HH:MM)'`);
    } catch (e) { /* ignore */ }
    // Auto-migration: Add acknowledgement_remark column if not exists
    try {
      await conn.execute(`ALTER TABLE employee_leaves ADD COLUMN acknowledgement_remark longtext DEFAULT NULL COMMENT 'Remark/comment provided by the person acknowledging the leave'`);
    } catch (e) { /* ignore */ }

    const [leaveRows] = await conn.execute(`SELECT * FROM employee_leaves WHERE id = ?`, [leaveId]);
    const leave = leaveRows[0];
    if (!leave) {
      return NextResponse.json({ success: false, error: "Leave not found" }, { status: 404 });
    }

    // Acknowledge: allowed on any status (pending/approved/rejected) as long as not already acknowledged
    if (status === "acknowledge") {
      if (leave.acknowledged_at) {
        return NextResponse.json(
          { success: false, error: "Leave already acknowledged." },
          { status: 400 }
        );
      }
    }

    // Revert acknowledgement: clear acknowledgement fields
    if (revert_acknowledgement) {
      await conn.execute(
        `UPDATE employee_leaves
         SET acknowledged_at = NULL, acknowledged_by = NULL, acknowledgement_remark = NULL
         WHERE id = ?`,
        [leaveId]
      );
      if (conn.release) conn.release();

      return NextResponse.json({
        success: true,
        message: "Acknowledgement reverted successfully",
        reverted: true,
      });
    }

    // Reporting manager can only approve their reportees' leaves, but SUPERADMIN can approve any
    if (!isSuperAdmin && !reportees.includes(leave.username)) {
      return NextResponse.json(
        { success: false, error: "Access denied. You can only approve leaves of your reportees." },
        { status: 403 }
      );
    }
    const [emailRows] = await conn.execute(`SELECT * FROM email_credentials WHERE username = ?`, [leave.username]);
    const email = emailRows[0];

    if (status === "acknowledge") {
      // Acknowledge action: keep existing status, just mark acknowledgment with optional remark
      await conn.execute(
        `UPDATE employee_leaves
         SET acknowledged_at = NOW(), acknowledged_by = ?, acknowledgement_remark = ?
         WHERE id = ?`,
        [session.username, acknowledgement_remark || null, leaveId]
      );
      if (conn.release) conn.release();

      return NextResponse.json({
        success: true,
        message: "Leave acknowledged successfully",
        acknowledged: true,
      });
    }

    // ─── Smart leave day calculation on approval ────────────────────────────────
    // When approving a paid / sick / casual / half-day leave that has start_time / end_time,
    // recalculate total_days (0.5 or original) based on:
    //   1. start_time / end_time vs employee's lunch break window
    //   2. actual check-in in attendance_logs vs half_day_checkin_time
    // If leave_type is paid and balance is insufficient → convert to unpaid.
    let overrideLeaveType = leave.leave_type;
    let overrideTotalDays = leave.is_half_day == 1 ? 0.5 : (Number(leave.total_days) || 1);
    let overrideIsHalfDay = leave.is_half_day == 1 ? 1 : 0;

    const isApprovedNonUnpaid =
      status === "approved" &&
      ["paid", "sick", "casual", "half-day"].includes(leave.leave_type);

    if (isApprovedNonUnpaid) {
      try {
        // 1. Calculate date span — multi-day (>1 day) leaves use POST-calculated total_days as-is
        //    because start_time/end_time fractions for first/last day are already handled at create time.
        const fromD = new Date(leave.from_date);
        const toD = new Date(leave.to_date);
        const dateDiff = Math.ceil((toD - fromD) / (1000 * 60 * 60 * 24)) + 1;
        const isSingleDay = dateDiff === 1;

        // 2. Fetch employee attendance schedule for lunch break info
        const [schedRows] = await conn.execute(
          `SELECT break_lunch, lunch_duration_minutes, half_day_checkin_time
           FROM employee_attendance_schedule
           WHERE username = ? LIMIT 1`,
          [leave.username]
        );
        const sched = schedRows[0] || null;

        // Helper: convert "HH:MM:SS" or "HH:MM" TIME string → total minutes from midnight
        const timeToMinutes = (t) => {
          if (!t) return null;
          const parts = String(t).split(":");
          return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        };

        let computedDays = overrideTotalDays; // start with original (POST-time calculated value)

        // Smart heuristics (time-based + checkin-based) ONLY apply to single-day full leaves
        // that are NOT already marked as half-day in DB (user explicitly selected half-day).
        // Multi-day leaves already have correct total_days from POST creation (first/last day fractions).
        if (isSingleDay && sched && leave.is_half_day != 1) {
          const lunchStartMin = timeToMinutes(sched.break_lunch);
          const lunchDuration = Number(sched.lunch_duration_minutes) || 30;
          const lunchEndMin = lunchStartMin !== null ? lunchStartMin + lunchDuration : null;
          const halfDayCheckinMin = timeToMinutes(sched.half_day_checkin_time);

          // ── A. start_time / end_time based calculation ──
          const startMin = timeToMinutes(leave.start_time);
          const endMin = timeToMinutes(leave.end_time);

          if (lunchStartMin !== null && (startMin !== null || endMin !== null)) {
            let isHalfByTime = false;

            // If start_time is AFTER lunch start → 2nd-half leave → half day
            if (startMin !== null && startMin > lunchStartMin) {
              isHalfByTime = true;
            }
            // If end_time is AT OR BEFORE lunch start → 1st-half leave → half day
            if (endMin !== null && endMin <= lunchStartMin) {
              isHalfByTime = true;
            }
            // If start_time is AFTER lunch end AND end_time covers only post-lunch → half day
            if (startMin !== null && lunchEndMin !== null && startMin >= lunchEndMin) {
              isHalfByTime = true;
            }

            if (isHalfByTime) {
              computedDays = 0.5;
            }
          }

          // ── B. Attendance check-in based calculation ──
          // Check attendance_logs for the leave's from_date (only single-day, so this IS the leave day)
          if (halfDayCheckinMin !== null) {
            const leaveDate = leave.from_date instanceof Date
              ? leave.from_date.toISOString().slice(0, 10)
              : String(leave.from_date).slice(0, 10);

            const startMin = timeToMinutes(leave.start_time);
            const endMin = timeToMinutes(leave.end_time);

            const [logRows] = await conn.execute(
              `SELECT checkin_time FROM attendance_logs
               WHERE username = ? AND DATE(checkin_time) = ? LIMIT 1`,
              [leave.username, leaveDate]
            );

            if (logRows.length > 0 && logRows[0].checkin_time) {
              const checkinDate = new Date(logRows[0].checkin_time);
              const checkinMin = checkinDate.getHours() * 60 + checkinDate.getMinutes();

              // If employee checked in at or after half_day_checkin_time → they worked half day
              if (checkinMin >= halfDayCheckinMin) {
                computedDays = 0.5;
              }
              // If checked in well before half_day_checkin_time → full day (override time-based half)
              else if (startMin === null && endMin === null) {
                // No start/end time provided; use only checkin signal
                computedDays = 1;
              }
            }
          }
        }

        // Clamp to at most the original requested days
        computedDays = Math.min(computedDays, overrideTotalDays);
        overrideIsHalfDay = computedDays < 1 ? 1 : 0;

        // ── C. For paid leave: check balance ──
        if (leave.leave_type === "paid") {
          // Get accrual start date from employee_profiles
          const [profRows] = await conn.execute(
            `SELECT leave_policy FROM employee_profiles WHERE username = ? LIMIT 1`,
            [leave.username]
          );
          const leavePolicy = profRows[0]?.leave_policy
            ? (typeof profRows[0].leave_policy === "string"
                ? JSON.parse(profRows[0].leave_policy)
                : profRows[0].leave_policy)
            : null;

          const accrualStartDate = leavePolicy?.accrual_start_date || null;
          const paidPerMonth = Number(leavePolicy?.paid_leaves_per_month) || 1.5;

          let accrued = 0;
          if (accrualStartDate) {
            const start = new Date(accrualStartDate);
            const now = new Date();
            // Count completed months from accrual start up to now
            const monthsElapsed =
              (now.getFullYear() - start.getFullYear()) * 12 +
              (now.getMonth() - start.getMonth());
            accrued = Math.max(0, monthsElapsed) * paidPerMonth;
          }

          // Sum all approved paid leave days (excluding this leave)
          const [usedRows] = await conn.execute(
            `SELECT COALESCE(SUM(total_days), 0) AS used
             FROM employee_leaves
             WHERE username = ? AND leave_type = 'paid' AND status = 'approved' AND id != ?`,
            [leave.username, leaveId]
          );
          const usedDays = Number(usedRows[0]?.used) || 0;
          const balance = accrued - usedDays;

          if (balance < computedDays) {
            // Not enough paid leave → convert to unpaid
            overrideLeaveType = "unpaid";
          }
        }

        overrideTotalDays = computedDays;
      } catch (smartErr) {
        console.error("Smart leave day calculation failed (non-fatal):", smartErr);
        // Fall back to original values — don't block approval
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // Update leave status (approve / reject), with smart-calculated total_days / leave_type
    await conn.execute(
      `UPDATE employee_leaves 
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?,
           total_days = ?, leave_type = ?, is_half_day = ?
       WHERE id = ?`,
      [status, session.username, rejection_reason || null,
       status === "approved" ? overrideTotalDays : (Number(leave.total_days) || 1),
       status === "approved" ? overrideLeaveType : leave.leave_type,
       status === "approved" ? overrideIsHalfDay : (leave.is_half_day == 1 ? 1 : 0),
       leaveId]
    );

    // If approving unpaid leave (full-day or half-day that was converted), create salary deduction
    // Use the final resolved values (overrideLeaveType / overrideTotalDays / overrideIsHalfDay)
    const finalLeaveType = status === "approved" ? overrideLeaveType : leave.leave_type;
    const finalTotalDays = status === "approved" ? overrideTotalDays : (Number(leave.total_days) || 1);
    const finalIsHalfDay = status === "approved" ? overrideIsHalfDay : (leave.is_half_day == 1 ? 1 : 0);

    if (status === "approved" && finalLeaveType === "unpaid") {
      try {
        const username = leave.username;
        const totalDays = finalTotalDays; // use smart-calculated days (may be 0.5 for half-day)
        if (username && totalDays > 0) {
          // Fetch active salary structure
          const [structRows] = await conn.execute(
            `SELECT basic_salary, hra, transport_allowance, medical_allowance, special_allowance, bonus, gross_salary
             FROM employee_salary_structure
             WHERE username = ? AND is_active = 1
             ORDER BY effective_from DESC
             LIMIT 1`,
            [username]
          );

          if (structRows.length > 0) {
            const s = structRows[0];
            const g = s.gross_salary;
            const monthly =
              g !== null && g !== undefined && g !== "" && Number.isFinite(Number(g))
                ? Number(g)
                : Number(s.basic_salary || 0) +
                  Number(s.hra || 0) +
                  Number(s.transport_allowance || 0) +
                  Number(s.medical_allowance || 0) +
                  Number(s.special_allowance || 0) +
                  Number(s.bonus || 0);
            const perDay = monthly / 26;
            const amount = Math.round(perDay * totalDays);

            // Ensure deduction type exists for unpaid leave
            const [typeRows] = await conn.execute(
              `SELECT id FROM salary_deduction_types WHERE deduction_code = 'UNPAID_LEAVE' LIMIT 1`
            );
            let deductionTypeId = typeRows[0]?.id;
            if (!deductionTypeId) {
              const [insType] = await conn.execute(
                `INSERT INTO salary_deduction_types (deduction_name, deduction_code, calculation_type, is_mandatory, is_active)
                 VALUES ('Unpaid Leave', 'UNPAID_LEAVE', 'fixed', 0, 1)`
              );
              deductionTypeId = insType.insertId;
            }

            // Upsert: if an active unpaid leave deduction overlaps from_date, skip duplicate
            const effFrom = leave.from_date;
            const effTo = leave.to_date;
            const [existing] = await conn.execute(
              `SELECT id FROM employee_salary_deductions 
               WHERE username = ? AND deduction_type_id = ? AND is_active = 1 
               AND (effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?))`,
              [username, deductionTypeId, effFrom, effFrom]
            );

            if (existing.length === 0) {
              await conn.execute(
                `INSERT INTO employee_salary_deductions 
                 (username, deduction_type_id, amount, percentage, effective_from, effective_to, reason, created_by)
                 VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
                [username, deductionTypeId, amount, effFrom, effTo, `Unpaid Leave: ${finalTotalDays} day(s)`, session.username]
              );
            }
          }
        }
      } catch (payErr) {
        console.error("Auto-deduction on unpaid leave approval failed:", payErr);
      }
    }

    // Send email notification to Employee about status change
    try {
      // Fetch service/HR account credentials from DB
      // We look for 'hr@dynacleanindustries.com' or fallback to 'hr' username
      const [emailCreds] = await conn.execute(
        `SELECT smtp_host, smtp_port, smtp_user, smtp_pass 
         FROM email_credentials 
         WHERE smtp_user IN ('hr')
         ORDER BY id DESC LIMIT 1`
      );

      let transporterConfig;

      if (emailCreds.length > 0) {
        const creds = emailCreds[0];
        transporterConfig = {
          host: creds.smtp_host,
          port: creds.smtp_port,
          secure: creds.smtp_port === 465,
          auth: {
            user: creds.smtp_user,
            pass: creds.smtp_pass,
          },
          sender: creds.smtp_user
        };
      } else {
        // Fallback to env vars if DB entry missing
        transporterConfig = {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          sender: process.env.SMTP_USER
        };
      }

      const recipientEmail = email.smtp_user; // Trying username as email

      // Only send if recipient exists
      if (recipientEmail) {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport(transporterConfig);

        const statusColor = status === 'approved' ? '#28a745' : '#dc3545';
        const statusText = status.toUpperCase();

        await transporter.sendMail({
          from: `"Dynaclean HR" <${transporterConfig.sender}@dynacleanindustries.com>`,
          to: `${recipientEmail}@dynacleanindustries.com`,
          subject: `Leave Application ${statusText}`,
          html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h2 style="color: ${statusColor}; margin: 0;">Leave Application ${statusText}</h2>
                </div>
                
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 5px solid ${statusColor};">
                  <p style="margin-top: 0;">Your leave application has been <strong style="color: ${statusColor}">${statusText}</strong>.</p>
                  
                  <table style="width: 100%; margin-top: 15px;">
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; width: 100px; color: #555;">Type:</td>
                      <td style="padding: 8px 0;">${leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #555;">Dates:</td>
                      <td style="padding: 8px 0;">
                        ${new Date(leave.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} 
                        - 
                        ${new Date(leave.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                    ${status === 'rejected' && rejection_reason ? `
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #dc2626; vertical-align: top;">Rejection Reason:</td>
                      <td style="padding: 8px 0; color: #dc2626;">${rejection_reason}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="padding: 8px 0; font-weight: bold; color: #555;">Reviewed By:</td>
                      <td style="padding: 8px 0;">${session.username}</td>
                    </tr>
                  </table>
                </div>

                <div style="margin-top: 20px; font-size: 12px; color: #888; text-align: center;">
                  <p>This is an automated message from Dynaclean HR System.</p>
                </div>
              </div>
            `
        });
      }
    } catch (emailError) {
      console.error("Error sending leave status update email:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: `Leave ${status} successfully`
    });
  } catch (error) {
    console.error("Error updating leave status:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete leave application (only if pending)
export async function DELETE(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leaveId = searchParams.get("id");

    if (!leaveId) {
      return NextResponse.json(
        { success: false, error: "Leave ID is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Check if leave belongs to user and is pending
    const [leaves] = await conn.execute(
      `SELECT * FROM employee_leaves WHERE id = ? AND username = ? AND status = 'pending'`,
      [leaveId, session.username]
    );

    if (leaves.length === 0) {
      return NextResponse.json(
        { success: false, error: "Leave not found or cannot be deleted" },
        { status: 404 }
      );
    }

    await conn.execute(`DELETE FROM employee_leaves WHERE id = ?`, [leaveId]);

    return NextResponse.json({
      success: true,
      message: "Leave application deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting leave:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
