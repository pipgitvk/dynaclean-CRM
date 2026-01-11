import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET: Fetch leaves (admin sees all, users see only their own)
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

    const conn = await getDbConnection();

    // Determine caller using referer
    const referer = request.headers.get("referer") || "";

    // Force mode based on URL
    const forceUserMode = referer.includes("user-dashboard");
    const forceAdminMode = referer.includes("admin-dashboard");

    // Actual admin role
    const isRealAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);

    // Final admin permission
    const isAdmin = forceAdminMode ? true : forceUserMode ? false : isRealAdmin;

    let query = `
      SELECT el.*, ep.employment_status, ep.leave_policy 
      FROM employee_leaves el
      LEFT JOIN employee_profiles ep ON el.username = ep.username
      WHERE 1=1
    `;
    const params = [];

    // If user-dashboard → show only logged-in user's leaves
    if (!isAdmin) {
      query += ` AND el.username = ?`;
      params.push(session.username);
    }

    // If admin-dashboard AND ?username= provided → filter specific user
    if (isAdmin && usernameParam) {
      query += ` AND el.username = ?`;
      params.push(usernameParam);
    }

    // Status filter
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
    const { leave_type, from_date, to_date, reason } = body;

    // Validation
    if (!leave_type || !from_date || !to_date || !reason) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Fetch user's profile to get leave policy and empId
    const [profiles] = await conn.execute(
      `SELECT id, empId, full_name, employment_status, leave_policy FROM employee_profiles WHERE username = ?`,
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

    // Calculate total days
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);
    const totalDays = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid date range" },
        { status: 400 }
      );
    }

    // Skip validation for unpaid leave - it's always available
    if (leave_type !== 'unpaid') {
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

      const takenCount = takenLeaves[0].taken || 0;
      const allowedKey = `${leave_type}_allowed`;
      const allowedCount = leavePolicy[allowedKey] || 0;

      // Check if requesting leave exceeds available balance
      if (takenCount + totalDays > allowedCount) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient ${leave_type} leave balance. Available: ${allowedCount - takenCount} days, Requested: ${totalDays} days`
          },
          { status: 400 }
        );
      }
    }

    // Insert leave application
    const [result] = await conn.execute(
      `INSERT INTO employee_leaves 
       (username, empId, full_name, leave_type, from_date, to_date, total_days, reason) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.username,
        empId,
        profile.full_name || session.username,
        leave_type,
        from_date,
        to_date,
        totalDays,
        reason
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
          subject: `New Leave Application: ${profile.full_name || session.username} - ${leave_type.toUpperCase()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New Leave Application</h2>
              <p>A new leave application has been submitted and requires your attention.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #f9fafb;">
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">Employee</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">${profile.full_name || session.username} (${empId})</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Leave Type</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">${leave_type.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Duration</td>
                  <td style="padding: 12px; border: 1px solid #e5e7eb;">
                    ${new Date(from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} To ${new Date(to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    <br>
                    <span style="color: #666; font-size: 0.9em;">(${totalDays} days)</span>
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

// PATCH: Update leave status (approve/reject) - Admin only
export async function PATCH(request) {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin/HR
    const isAdmin = ["SUPERADMIN", "HR HEAD", "HR"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only HR/Admin can approve/reject leaves." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leaveId, status, rejection_reason } = body;

    if (!leaveId || !status) {
      return NextResponse.json(
        { success: false, error: "Leave ID and status are required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be 'approved' or 'rejected'" },
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

    // Fetch leave details for possible payroll action
    const [leaveRows] = await conn.execute(`SELECT * FROM employee_leaves WHERE id = ?`, [leaveId]);
    const leave = leaveRows[0];
    const [emailRows] = await conn.execute(`SELECT * FROM email_credentials WHERE username = ?`, [leave.username]);
    const email = emailRows[0];

    // Update leave status
    await conn.execute(
      `UPDATE employee_leaves 
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
       WHERE id = ?`,
      [status, session.username, rejection_reason || null, leaveId]
    );

    // If approving unpaid leave, create salary deduction based on 26-day divisor
    if (status === "approved" && leave?.leave_type === "unpaid") {
      try {
        const username = leave.username;
        const totalDays = Number(leave.total_days || 0);
        if (username && totalDays > 0) {
          // Fetch active salary structure
          const [structRows] = await conn.execute(
            `SELECT basic_salary, hra, transport_allowance, medical_allowance, special_allowance, bonus
             FROM employee_salary_structure
             WHERE username = ? AND is_active = 1
             ORDER BY effective_from DESC
             LIMIT 1`,
            [username]
          );

          if (structRows.length > 0) {
            const s = structRows[0];
            const monthly = Number(s.basic_salary || 0) + Number(s.hra || 0) + Number(s.transport_allowance || 0) + Number(s.medical_allowance || 0) + Number(s.special_allowance || 0) + Number(s.bonus || 0);
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
                [username, deductionTypeId, amount, effFrom, effTo, `Unpaid Leave: ${totalDays} day(s)`, session.username]
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
