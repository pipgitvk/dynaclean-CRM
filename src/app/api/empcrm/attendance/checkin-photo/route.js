import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HR_ATTENDANCE_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = payload.role;
    const isHr =
      role != null && HR_ATTENDANCE_ROLES.includes(String(role));

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();
    const date = searchParams.get("date")?.trim()?.slice(0, 10);

    if (!username || !date) {
      return NextResponse.json(
        { message: "username and date are required" },
        { status: 400 }
      );
    }

    if (!isHr && payload.username !== username) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const db = await getDbConnection();
    const [rows] = await db.query(
      `SELECT checkin_photo
       FROM attendance_logs
       WHERE username = ? AND date = ?
       LIMIT 1`,
      [username, date]
    );

    const raw = rows[0]?.checkin_photo;
    const checkin_photo =
      raw != null && String(raw).trim() !== "" ? raw : null;

    return NextResponse.json({ checkin_photo });
  } catch (error) {
    console.error("checkin-photo GET:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
