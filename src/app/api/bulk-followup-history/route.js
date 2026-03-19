import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const TABLE = "bulk_followup_upload_log";

// GET - Fetch bulk upload history
export async function GET() {
  try {
    const conn = await getDbConnection();

    // Ensure table exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uploaded_by VARCHAR(255) NOT NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        entries_count INT NOT NULL DEFAULT 0,
        entries_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await conn.execute(
      `SELECT id, uploaded_by, uploaded_at, entries_count, entries_json 
       FROM ${TABLE} 
       ORDER BY uploaded_at DESC 
       LIMIT 100`
    );

    const history = rows.map((r) => ({
      id: r.id,
      uploaded_by: r.uploaded_by,
      uploaded_at: r.uploaded_at,
      entries_count: r.entries_count,
      entries: r.entries_json ? (typeof r.entries_json === "string" ? JSON.parse(r.entries_json) : r.entries_json) : [],
    }));

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Error fetching bulk followup history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

// POST - Log a bulk upload
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { entries = [] } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "entries array is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uploaded_by VARCHAR(255) NOT NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        entries_count INT NOT NULL DEFAULT 0,
        entries_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const summary = entries.map((e) => ({
      customer_id: e.customer_id,
      model: e.model || "",
      notes: (e.notes || "").slice(0, 100),
      tags: e.multi_tag?.join(", ") || "",
      estimated_order_date: e.next_followup_date || e.estimated_order_date || "",
      assigned_employee: e.assigned_employee || "",
    }));

    await conn.execute(
      `INSERT INTO ${TABLE} (uploaded_by, uploaded_at, entries_count, entries_json) 
       VALUES (?, NOW(), ?, ?)`,
      [payload.username || payload.name || "unknown", entries.length, JSON.stringify(summary)]
    );

    return NextResponse.json({ success: true, message: "History logged" });
  } catch (error) {
    console.error("Error logging bulk followup:", error);
    return NextResponse.json(
      { error: "Failed to log history" },
      { status: 500 }
    );
  }
}
