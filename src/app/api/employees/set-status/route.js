import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );
    const role = payload?.role || "";
    if (role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const username = body?.username;
    const status = body?.status;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (status !== 0 && status !== 1) {
      return NextResponse.json({ error: "status must be 0 or 1" }, { status: 400 });
    }

    const actor = String(payload.username || "").toLowerCase();
    if (status === 0 && actor === String(username).toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `UPDATE rep_list SET status = ? WHERE username = ?`,
      [status, username]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: status === 1 ? "Employee activated" : "Employee deactivated",
      status,
    });
  } catch (error) {
    console.error("Set employee status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update status" },
      { status: 500 }
    );
  }
}
