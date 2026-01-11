import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    let username = "Unknown";

    // If token exists, try to decode it
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        username = decoded.username || "Unknown";
      } catch (error) {
        console.error("JWT decode failed", error);
        return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
      }
    } else {
      console.log("No token found");
      return NextResponse.json({ success: false, error: "No token found" }, { status: 401 });
    }

    console.log("Fetching reps list...");

    // Get DB connection and fetch the list of reps except the current user
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`
      SELECT username 
      FROM rep_list 
      WHERE username != ? 
      ORDER BY username
    `, [username]);
        // await conn.end();

    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
  }
}
