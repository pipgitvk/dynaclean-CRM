import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const HR_SALARY_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive", "ACCOUNTANT", "PRODUCTION ACCOUNTANT"];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized access." }, { status: 401 });
    }

    const db = await getDbConnection();

    const targetUsername = username || payload.username;

    if (username && username !== payload.username) {
      if (!HR_SALARY_ROLES.includes(payload.role)) {
        return NextResponse.json({ message: "Unauthorized access." }, { status: 403 });
      }
    }

    const [history] = await db.query(`
      SELECT 
        ess.*,
        rl.username as employee_name,
        rl.email as employee_email,
        changer.username as changed_by_name
      FROM employee_salary_structure ess
      LEFT JOIN rep_list rl ON ess.username = rl.username
      LEFT JOIN rep_list changer ON ess.created_by = changer.username
      WHERE ess.username = ?
      ORDER BY ess.created_at DESC
    `, [targetUsername]);

    return NextResponse.json({
      success: true,
      history
    });
  } catch (error) {
    console.error("Error fetching salary history:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}
