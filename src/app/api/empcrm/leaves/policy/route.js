import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/empcrm/leaves/policy?username=foo
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!username) {
      return NextResponse.json({ success: false, message: "username is required" }, { status: 400 });
    }

    const db = await getDbConnection();
    const [rows] = await db.query(
      "SELECT leave_policy FROM employee_profiles WHERE username = ? LIMIT 1",
      [username]
    );

    let policy = null;
    if (rows.length > 0 && rows[0].leave_policy) {
      try {
        policy = JSON.parse(rows[0].leave_policy);
      } catch (e) {
        policy = null;
      }
    }

    // Normalize defaults
    policy = {
      sick_enabled: policy?.sick_enabled ?? true,
      paid_enabled: policy?.paid_enabled ?? true,
      sick_allowed: Number(policy?.sick_allowed ?? 0),
      paid_allowed: Number(policy?.paid_allowed ?? 0),
    };

    return NextResponse.json({ success: true, policy });
  } catch (err) {
    console.error("GET leave policy error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/empcrm/leaves/policy { username, sick_allowed, paid_allowed, sick_enabled?, paid_enabled? }
export async function PATCH(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username, sick_allowed, paid_allowed, sick_enabled = true, paid_enabled = true } = body || {};

    if (!username) {
      return NextResponse.json({ success: false, message: "username is required" }, { status: 400 });
    }

    const policy = JSON.stringify({
      sick_enabled: Boolean(sick_enabled),
      paid_enabled: Boolean(paid_enabled),
      sick_allowed: Number(sick_allowed ?? 0),
      paid_allowed: Number(paid_allowed ?? 0),
    });

    const db = await getDbConnection();
    await db.query(
      "UPDATE employee_profiles SET leave_policy = ? WHERE username = ?",
      [policy, username]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH leave policy error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}


