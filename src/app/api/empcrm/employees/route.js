import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET: Fetch all employees from rep_list
export async function GET() {
  try {
    const conn = await getDbConnection();

    const [employees] = await conn.execute(
      `SELECT 
        username, 
        empId, 
        email, 
        userRole,
        status,
        userDepartment 
      FROM rep_list 
      where status = 1
      ORDER BY username ASC`
    );

    return NextResponse.json({
      success: true,
      employees
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
