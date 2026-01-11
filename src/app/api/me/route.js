// app/api/me/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function GET() {
  // ✅ Await cookies() (important in App Router)
  // const cookieStore = await cookies();
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;

    // ✅ Create MySQL connection
    const conn = await getDbConnection();

    // ✅ Query user from both tables
    const [rows] = await conn.execute(
      `
      SELECT username, email, empId, userRole FROM emplist WHERE username = ?
      UNION
      SELECT username, email, empId, userRole FROM rep_list WHERE username = ?
      `,
      [username, username]
    );

        // await conn.end();

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]); // ✅ Return user details
  } catch (err) {
    console.error("JWT decode or DB error:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
