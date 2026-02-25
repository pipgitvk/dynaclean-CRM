// app/api/attendance/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
  try {

    console.log(`Fetching all attendance logs for admin view.`);

    const db = await getDbConnection();
    console.log("Database connection established.");

    // Query to fetch all attendance logs
    const [rows] = await db.query(
      `SELECT
      a.date,
      a.username,
      a.checkin_time,
      a.checkout_time,
      a.break_morning_start,
      a.break_morning_end,
      a.break_lunch_start,
      a.break_lunch_end,
      a.break_evening_start,
      a.break_evening_end,
      a.checkin_address,
      a.checkout_address
   FROM attendance_logs a
   INNER JOIN rep_list r
      ON a.username = r.username COLLATE utf8mb3_unicode_ci
   WHERE r.status = 1
   ORDER BY a.date DESC`
    );


    // Fetch holidays
    const [holidays] = await db.query(
      `SELECT holiday_date, title, description
       FROM holidays
       ORDER BY holiday_date DESC`
    );

    // Fetch all approved leaves
    const [leaves] = await db.query(
      `SELECT username, from_date, to_date, leave_type, reason
       FROM employee_leaves
       WHERE status = 'approved'
       ORDER BY from_date DESC`
    );

    // db.end();
    console.log("Database connection closed.");
    console.log("Fetched all attendance logs for admin view.");
    console.log(`this is the rows: ${JSON.stringify(rows)}`);
    console.log("this is the holidays", holidays);
    console.log("this is the approved leaves", leaves);

    return NextResponse.json({ attendance: rows, holidays, leaves });
  } catch (error) {
    console.error("Error fetching attendance logs:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}