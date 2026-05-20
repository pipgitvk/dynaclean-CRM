import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    const { FB_VERIFY_TOKEN, FB_PAGE_ID, FB_PAGE_TOKEN, FB_LEAD_FORM_ID } = await request.json();

    if (!FB_VERIFY_TOKEN || !FB_PAGE_ID || !FB_PAGE_TOKEN || !FB_LEAD_FORM_ID) {
      return NextResponse.json(
        { message: "All fields are required." },
        { status: 400 }
      );
    }

    const payload = await getSessionPayload(request);
    const updated_by = payload?.username || "system";

    const connection = await getDbConnection();

    // Insert new row into FB_credentials table
    const sql = `
      INSERT INTO FB_credentials (FB_VERIFY_TOKEN, FB_PAGE_ID, FB_PAGE_TOKEN, FB_LEAD_FORM_ID)
      VALUES (?, ?, ?, ?)
    `;
    await connection.execute(sql, [FB_VERIFY_TOKEN, FB_PAGE_ID, FB_PAGE_TOKEN, FB_LEAD_FORM_ID]);

    await connection.end();

    return NextResponse.json(
      { message: "Credentials saved successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to save FB credentials:", error);
    return NextResponse.json(
      { message: "Failed to save credentials.", error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const connection = await getDbConnection();

    // Fetch latest row from FB_credentials table
    const [rows] = await connection.execute(
      "SELECT FB_VERIFY_TOKEN, FB_PAGE_ID, FB_PAGE_TOKEN, FB_LEAD_FORM_ID FROM FB_credentials ORDER BY created_at DESC LIMIT 1"
    );

    await connection.end();

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "No credentials found." },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error("Failed to fetch FB credentials:", error);
    return NextResponse.json(
      { message: "Failed to fetch credentials.", error: error.message },
      { status: 500 }
    );
  }
}
