import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import {
  ensureLoginTimeRestrictionColumn,
  updateLoginTimeRestriction,
} from "@/lib/ensureLoginTimeRestrictionColumn";

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
    if (!["SUPERADMIN", "DIRECTOR"].includes(String(role).toUpperCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const username = body?.username;
    const enabled = body?.login_time_restriction_enabled;

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (enabled !== 0 && enabled !== 1) {
      return NextResponse.json(
        { error: "login_time_restriction_enabled must be 0 or 1" },
        { status: 400 }
      );
    }

    await ensureLoginTimeRestrictionColumn();
    const conn = await getDbConnection();

    const repResult = await updateLoginTimeRestriction(
      conn,
      "rep_list",
      enabled,
      username
    );
    const empResult = await updateLoginTimeRestriction(
      conn,
      "emplist",
      enabled,
      username
    );

    if (repResult.affectedRows === 0 && empResult.affectedRows === 0) {
      const [empRows] = await conn.execute(
        `SELECT username FROM emplist WHERE username = ?`,
        [username]
      );
      const [repRows] = await conn.execute(
        `SELECT username FROM rep_list WHERE username = ?`,
        [username]
      );
      if (empRows.length === 0 && repRows.length === 0) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
    }

    return NextResponse.json({
      success: true,
      message: enabled === 1
        ? "Login time restriction enabled (09:00–19:00 IST)"
        : "Login time restriction disabled",
      login_time_restriction_enabled: enabled,
    });
  } catch (error) {
    console.error("Set login time restriction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update login time restriction" },
      { status: 500 }
    );
  }
}
