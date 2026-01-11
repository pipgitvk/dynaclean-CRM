import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
  const { username, password } = await req.json();
  const conn = await getDbConnection();

  const hashedPassword = await bcrypt.hash(password, 10);

  await conn.execute("UPDATE rep_list SET password = ? WHERE username = ?", [
    hashedPassword,
    username,
  ]);

  return NextResponse.json({ success: true });
}
