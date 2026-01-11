import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";



export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const serial_number = searchParams.get("serial_number");

    if (!serial_number) {
      return NextResponse.json({ message: "serial_number is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Use prepared statement to prevent SQL Injection
    const [rows] = await conn.execute("SELECT * FROM service_records WHERE serial_number = ?", [
      serial_number,
    ]);

        // await conn.end();

    return NextResponse.json({ records: rows });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
