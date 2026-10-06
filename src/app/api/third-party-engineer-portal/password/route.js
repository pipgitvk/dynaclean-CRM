import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { requireThirdPartyEngineerPortalSession } from "@/lib/thirdPartyEngineerPortalAuth";
import {
  hashThirdPartyEngineerPassword,
  verifyThirdPartyEngineerPassword,
} from "@/lib/thirdPartyEngineerPassword";

export async function PUT(req) {
  try {
    const auth = await requireThirdPartyEngineerPortalSession();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const currentPassword = String(body?.current_password || "");
    const newPassword = String(body?.new_password || "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "current_password and new_password are required" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT password FROM third_party_service_engineers WHERE engineer_id = ? AND status = 'active' LIMIT 1`,
      [auth.engineerId]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!verifyThirdPartyEngineerPassword(currentPassword, rows[0].password)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    await conn.execute(
      `UPDATE third_party_service_engineers SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE engineer_id = ?`,
      [hashThirdPartyEngineerPassword(newPassword), auth.engineerId]
    );

    return NextResponse.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("third-party-engineer-portal password:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
