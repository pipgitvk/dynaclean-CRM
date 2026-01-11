import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.query("SELECT DISTINCT username as lead_source FROM rep_list WHERE userRole IN ('Back Office', 'Sales', 'SALES HEAD') AND (status =  1) AND username != 'admin';");
    // await conn.end();

    const sources = rows.map((r) => r.lead_source);
    return NextResponse.json(sources);
  } catch (err) {
    console.error("Error fetching lead sources:", err);
    return NextResponse.json([], { status: 500 });
  }
}
