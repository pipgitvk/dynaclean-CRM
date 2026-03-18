import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    let username = "Unknown";

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

    const conn = await getDbConnection();
    let rows;
    if (search.length >= 2) {
      const like = `%${search}%`;
      [rows] = await conn.execute(
        `SELECT username FROM rep_list WHERE username != ? AND username LIKE ? ORDER BY username LIMIT 20`,
        [username, like]
      );
    } else {
      [rows] = await conn.execute(
        `SELECT username FROM rep_list WHERE username != ? ORDER BY username`,
        [username]
      );
    }

    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
  }
}
