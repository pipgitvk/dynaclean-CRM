import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbConnection } from "@/lib/db";
import { getCurrentISTTime } from "@/lib/timezone";


const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function POST(request) {
  console.log("--- API Route Execution Start ---");

  const conn = await getDbConnection();
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Get client IP address
  let ip =
    request.ip ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  // Helper to record activity
  const recordActivity = async (username, role, status, message) => {
    try {
      await conn.execute(
        "INSERT INTO login_activity (username, ip_address, user_agent, status, role, message) VALUES (?, ?, ?, ?, ?, ?)",
        [username, ip, userAgent, status, role, message],
      );
    } catch (err) {
      console.error("Failed to record login activity:", err);
    }
  };

  try {
    const { username, password } = await request.json();
    console.log("🟡 Login request received:", username);

    if (!username || !password) {
      return NextResponse.json(
        { error: "Missing credentials" },
        { status: 400 },
      );
    }

    // --- 1. Time-based Restriction (9:00 AM - 7:00 PM IST) ---
    const { hour, minute } = getCurrentISTTime();
    const currentTimeMinutes = hour * 60 + minute;
    const startRange = 9 * 60; // 9:00 AM
    const endRange = 19 * 60; // 7:00 PM

    if (username !== "admin" && username !== "VK") {
      if (currentTimeMinutes < startRange || currentTimeMinutes > endRange) {
        await recordActivity(
          username,
          "UNKNOWN",
          "FAILED",
          `Login attempted outside allowed hours (09:00 - 19:00 IST). Current IST time: ${hour}:${minute}`,
        );
        return NextResponse.json(
          { error: "Login allowed only between 09:00 and 19:00 IST" },
          { status: 403 },
        );
      }
    }

    // Step 1: Try emplist
    const [empRows] = await conn.execute(
      "SELECT * FROM emplist WHERE LOWER(username) = LOWER(?) and status = 1",
      [username.trim()],
    );

    let user = null;
    let sourceTable = "";
    console.log(`🔍 Checking emplist for user: ${username}`);

    if (empRows.length > 0) {
      user = empRows[0];
      sourceTable = "emplist";
    } else {
      // Step 2: Try rep_list
      const [repRows] = await conn.execute(
        "SELECT * FROM emplist WHERE LOWER(username) = LOWER(?) ",
        [username.trim()],
      );
      
      if (repRows.length > 0) {
        user = [repRows][0][0];
        sourceTable = "rep_list";
      }
    
    }
    

    if (!user) {
      await recordActivity(username, "UNKNOWN", "FAILED", "User not found");
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const userRole = user.userRole || user.role || "UNKNOWN";
    const dbPassword = user.password || "";
    const inputPassword = password.trim();
   

    if (dbPassword !== inputPassword) {
      await recordActivity(username, userRole, "FAILED", "Incorrect password");
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 },
      );
    }

    // --- 2. IP-based Restriction with Toggle ---
    const isIpRestrictionEnabled = user.ip_restriction_enabled === 1;
    const allowedIpsString = user.allowed_ips || "";

    if (isIpRestrictionEnabled && allowedIpsString.trim() !== "") {
      const allowedIps = allowedIpsString.split(",").map((i) => i.trim());
      // Check if current IP matches any allowed IP
      if (!allowedIps.includes(ip)) {
        await recordActivity(
          username,
          userRole,
          "FAILED",
          `IP restriction enforced. Attempt from unauthorized IP: ${ip}`,
        );
        return NextResponse.json(
          { error: "Login from this IP is not allowed" },
          { status: 403 },
        );
      }
    }
console.log('✅ User ',user);
    // ✅ Generate JWT
    const token = jwt.sign(
      {
        id: user.id || user.client_index || user.empId,
        username: user.username,
        role: userRole,
      },
      JWT_SECRET,
      { expiresIn: "7d" }, // longer session
    );

    // ✅ Return response with secure cookie
    const res = NextResponse.json({
      message: "Login successful",
      role: userRole,
    });

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    console.log(`🎉 Login successful for ${username} from ${sourceTable}`);
    await recordActivity(
      username,
      userRole,
      "SUCCESS",
      `Login successful from IP: ${ip}`,
    );
    return res;
  } catch (error) {
    console.error("🔥 Error during login:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

