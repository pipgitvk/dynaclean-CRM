import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(request) {
  let conn;
  try {
    const { username, newPassword } = await request.json();

    if (!username || !newPassword) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const pool = await getDbConnection();
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `UPDATE rep_list SET password = ? WHERE username = ?`,
      [newPassword, username]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "No representative found or no change was made." }, { status: 404 });
    }

    return NextResponse.json({ message: "Password updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  } finally {
    if (conn) {
      try {
        await conn.release();
      } catch (releaseError) {
        console.error("Error releasing connection:", releaseError);
      }
    }
  }
}