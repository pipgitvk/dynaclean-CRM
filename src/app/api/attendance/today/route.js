import { getDbConnection } from "@/lib/db";
import { getISTDateString } from "@/lib/istDateTime";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("impersonation_token")?.value || cookieStore.get("token")?.value;

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username") || payload.username;

    const connection = await getDbConnection();

    // Get today's attendance record from attendance_logs
    const todayDate = getISTDateString();

    const [rows] = await connection.execute(
      `SELECT 
        id, username, date, checkin_time, checkout_time,
        break_morning_start, break_morning_end,
        break_lunch_start, break_lunch_end,
        break_evening_start, break_evening_end
      FROM attendance_logs 
      WHERE username = ? AND date = ?
      ORDER BY date DESC
      LIMIT 1`,
      [username, todayDate]
    );

    const attendance = rows[0] || null;

    return Response.json({ attendance });
  } catch (error) {
    console.error("Error fetching attendance:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
