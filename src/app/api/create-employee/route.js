import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { username, email, gender, dob, password, number, userRole } = await request.json();

    // Basic validation
    if (!username || !email || !password ) {
      return NextResponse.json({ error: "Required fields are missing." }, { status: 400 });
    }

    const conn = await getDbConnection();
    const query = `
      INSERT INTO rep_list (username, email, gender, dob, password, number, userRole , status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [username, email, gender, dob, password, number, userRole, 1];
    
    const [result] = await conn.execute(query, values);
        // await conn.end();

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Failed to insert employee." }, { status: 500 });
    }

    return NextResponse.json({ message: "Employee created successfully.", empId: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Employee creation error:", error);
    return NextResponse.json({ error: "Failed to create employee." }, { status: 500 });
  }
}