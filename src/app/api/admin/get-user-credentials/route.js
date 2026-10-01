import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function POST(request) {
  console.log("--- API Route Execution Start ---");
  try {
    const { username, password } = await request.json();
    console.log("🟡 Login request received:", username);

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Step 1: Try emplist
    const [empRows] = await conn.execute(
      "SELECT * FROM emplist WHERE LOWER(username) = LOWER(?) and status = 1",
      [username.trim()]
    );

    let user = null;
    let sourceTable = "";

    if (empRows.length > 0) {
      user = empRows[0];
      sourceTable = "emplist";
    } else {
      // Step 2: Try rep_list
      const [repRows] = await conn.execute(
        "SELECT * FROM rep_list WHERE LOWER(username) = LOWER(?) and status = 1",
        [username.trim()]
      );
      if (repRows.length > 0) {
        user = repRows[0];
        sourceTable = "rep_list";
      }
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const dbPassword = user.password?.trim() || "";
    const inputPassword = password.trim();

    if (dbPassword !== inputPassword) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.userRole || user.role || "UNKNOWN" },
      JWT_SECRET,
      { expiresIn: "7d" } // longer session
    );

    // ✅ Return response with secure cookie
    const res = NextResponse.json({
      message: "Login successful",
      role: user.userRole || user.role || "UNKNOWN",
    });

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    console.log(`🎉 Login successful for ${username} from ${sourceTable}`);
    return res;
  } catch (error) {
    console.error("🔥 Error during login:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
