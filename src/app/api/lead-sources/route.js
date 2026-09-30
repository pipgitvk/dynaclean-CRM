import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch unique lead sources from customers table
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await getDbConnection();

    // Fetch unique lead_source values from customers table, excluding null/empty values
    const [leadSources] = await connection.execute(
      `SELECT DISTINCT lead_source as username, lead_source as name 
       FROM customers 
       WHERE lead_source IS NOT NULL AND lead_source != '' 
       ORDER BY lead_source`
    );

    return NextResponse.json({ success: true, employees: leadSources });
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead sources" },
      { status: 500 }
    );
  }
}