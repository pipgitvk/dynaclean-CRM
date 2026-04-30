import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getReportees, getReportingManagerForEmployee } from "@/lib/reportingManager";
import { ensureProxySubmitterColumn } from "@/lib/attendanceRegularizationPending";
import fs from "fs/promises";
import path from "path";

/** `log_date` YYYY-MM-DD + HTML time → MySQL DATETIME */
function combineDateAndWallTime(logDate, timeStr) {
  const datePart = String(logDate).slice(0, 10);
  const raw = String(timeStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !raw) return null;
  const parts = raw.split(":");
  const h = String(parts[0] ?? "0").padStart(2, "0");
  const m = String(parts[1] ?? "0").padStart(2, "0");
  const s =
    parts[2] != null && String(parts[2]).trim() !== ""
      ? String(parts[2]).trim().padStart(2, "0")
      : "00";
  return `${datePart} ${h}:${m}:${s}`;
}

export async function POST(req) {
  try {
    console.log("Starting regularization request submission...");
    
    const session = await getSessionPayload();
    if (!session?.username) {
      console.log("Unauthorized: No session username");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Session username:", session.username);

    const formData = await req.formData();
    const employee = formData.get("employee");
    const date = formData.get("date");
    const checkin_time = formData.get("checkin_time");
    const checkout_time = formData.get("checkout_time");
    const reason = formData.get("reason");
    const attachment = formData.get("attachment");

    console.log("Form data:", { employee, date, checkin_time, checkout_time, reason: reason?.substring(0, 50) });

    if (!employee || !date || !reason?.trim()) {
      console.log("Validation failed: Missing required fields");
      return NextResponse.json({ error: "Employee, date, and reason are required" }, { status: 400 });
    }

    const checkinTrim =
      checkin_time != null && String(checkin_time).trim() !== ""
        ? String(checkin_time).trim()
        : "";
    const checkoutTrim =
      checkout_time != null && String(checkout_time).trim() !== ""
        ? String(checkout_time).trim()
        : "";
    if (!checkinTrim || !checkoutTrim) {
      return NextResponse.json(
        { error: "Check-in and check-out times are both required" },
        { status: 400 }
      );
    }

    const proposedCheckinDt = combineDateAndWallTime(date, checkinTrim);
    const proposedCheckoutDt = combineDateAndWallTime(date, checkoutTrim);
    if (!proposedCheckinDt || !proposedCheckoutDt) {
      return NextResponse.json(
        { error: "Invalid date or time format" },
        { status: 400 }
      );
    }

    // Verify the employee is assigned to this reporting manager
    const reportees = await getReportees(session.username);
    console.log("Reportees:", reportees);
    
    if (!reportees.includes(employee)) {
      console.log("Employee not assigned to reporting manager");
      return NextResponse.json({ error: "Employee not assigned to you" }, { status: 403 });
    }

    const conn = await getDbConnection();
    console.log("Database connection established");

    // Try different column names for attendance logs
    let attendanceRows = [];
    let currentAttendance = null;
    
    try {
      [attendanceRows] = await conn.execute(
        `SELECT checkin_time, checkout_time FROM attendance_logs 
         WHERE username = ? AND DATE(date) = ?`,
        [employee, date]
      );
      currentAttendance = attendanceRows.length > 0 ? attendanceRows[0] : null;
    } catch (e1) {
      console.log("Trying alternative date column...");
      try {
        [attendanceRows] = await conn.execute(
          `SELECT checkin_time, checkout_time FROM attendance_logs 
           WHERE username = ? AND DATE(attendance_date) = ?`,
          [employee, date]
        );
        currentAttendance = attendanceRows.length > 0 ? attendanceRows[0] : null;
      } catch (e2) {
        console.log("Getting latest attendance record without date filter...");
        [attendanceRows] = await conn.execute(
          `SELECT checkin_time, checkout_time FROM attendance_logs 
           WHERE username = ? ORDER BY id DESC LIMIT 1`,
          [employee]
        );
        currentAttendance = attendanceRows.length > 0 ? attendanceRows[0] : null;
      }
    }

    console.log("Current attendance:", currentAttendance);

    // If no attendance record found, create a dummy record for regularization
    if (!currentAttendance) {
      console.log("No attendance record found, creating dummy record for regularization");
      currentAttendance = {
        checkin_time: null,
        checkout_time: null
      };
    }

    const submittersManager = await getReportingManagerForEmployee(session.username);
    console.log("Submitter's reporting manager (must approve):", submittersManager);
    if (!submittersManager) {
      return NextResponse.json(
        {
          error:
            "Your reporting manager must be assigned in Employees before you can submit regularization for your team.",
        },
        { status: 400 }
      );
    }

    // Handle file attachment
    let attachmentUrl = null;
    if (attachment && attachment.size > 0) {
      console.log("Processing attachment...");
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", "regularization");
        await fs.mkdir(uploadDir, { recursive: true });
        
        const timestamp = Date.now();
        const filename = `${timestamp}-${attachment.name}`;
        const filePath = path.join(uploadDir, filename);
        
        const buffer = Buffer.from(await attachment.arrayBuffer());
        await fs.writeFile(filePath, buffer);
        
        attachmentUrl = `/uploads/regularization/${filename}`;
        console.log("Attachment saved:", attachmentUrl);
      } catch (fileError) {
        console.error("Error saving attachment:", fileError);
        // Continue without attachment
      }
    }

    console.log("Inserting regularization request...");
    const useProxyColumn = await ensureProxySubmitterColumn(conn);
    const insertCols = useProxyColumn
      ? `(username, proxy_submitter_username, log_date, original_checkin_time, original_checkout_time,
        proposed_checkin_time, proposed_checkout_time, reason, attachment_url, status)`
      : `(username, log_date, original_checkin_time, original_checkout_time,
        proposed_checkin_time, proposed_checkout_time, reason, attachment_url, status)`;
    const insertVals = useProxyColumn
      ? `(?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      : `(?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;
    const insertParams = useProxyColumn
      ? [
          employee,
          session.username,
          date,
          currentAttendance.checkin_time,
          currentAttendance.checkout_time,
          proposedCheckinDt,
          proposedCheckoutDt,
          reason.trim(),
          attachmentUrl,
        ]
      : [
          employee,
          date,
          currentAttendance.checkin_time,
          currentAttendance.checkout_time,
          proposedCheckinDt,
          proposedCheckoutDt,
          reason.trim(),
          attachmentUrl,
        ];

    const [result] = await conn.execute(
      `INSERT INTO attendance_regularization_requests ${insertCols} VALUES ${insertVals}`,
      insertParams
    );

    console.log("Request inserted successfully:", result.insertId);

    return NextResponse.json({ 
      success: true, 
      message: "Regularization request submitted successfully",
      requestId: result.insertId
    });

  } catch (error) {
    console.error("Error submitting regularization request:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}
