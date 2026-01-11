// src/app/api/targets/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute("SELECT * FROM target");
    

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch targets:", error);
    return NextResponse.json({ message: "Failed to fetch targets.", error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, target, target_start_date, target_end_date } = await request.json();

    if (!id || !target || !target_start_date || !target_end_date) {
      return NextResponse.json(
        { message: "ID, target, start date, and end date are required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Check if target exists
    const [existing] = await connection.execute(
      "SELECT * FROM target WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Target not found." },
        { status: 404 }
      );
    }

    // Update the target
    const sql = `
      UPDATE target 
      SET target = ?, target_start_date = ?, target_end_date = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const values = [target, target_start_date, target_end_date, id];

    await connection.execute(sql, values);

    return NextResponse.json(
      { message: "Target updated successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update target:", error);
    return NextResponse.json(
      { message: "Failed to update target.", error: error.message },
      { status: 500 }
    );
  }
}