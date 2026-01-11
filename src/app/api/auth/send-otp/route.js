import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

const otpStore = new Map(); // In-memory for simplicity. Use Redis in production.

export async function POST(req) {
  const { username } = await req.json();
  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT email FROM rep_list WHERE username = ?",
    [username]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const email = rows[0].email;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(username, otp); // store temporarily

  console.log(`🔐 OTP for ${username}:`, otp); // Replace with actual email send logic

  return NextResponse.json({ success: true });
}
