// app/api/lead-distribution/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET: return current distribution (duplicate of /config but convenient here)
export async function GET() {
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    "SELECT username, priority, max_leads FROM lead_distribution ORDER BY priority ASC"
  );
  return NextResponse.json(rows);
}

// POST: create a row. Accepts JSON: { username, priority, max_leads }
export async function POST(req) {
  const contentType = req.headers.get("content-type") || "";
  const conn = await getDbConnection();

  // Backward compatibility: if multipart/form-data, keep previous bulk-save behavior
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const count = parseInt(formData.get("count"));

    const settings = [];
    for (let i = 0; i < count; i++) {
      const username = formData.get(`username_${i}`);
      const priority = parseInt(formData.get(`priority_${i}`));
      const maxLeads = parseInt(formData.get(`max_leads_${i}`));

      if (
        typeof username === "string" &&
        !Number.isNaN(priority) &&
        !Number.isNaN(maxLeads)
      ) {
        settings.push([username, priority, maxLeads]);
      }
    }

    await conn.execute("TRUNCATE TABLE lead_distribution");
    if (settings.length > 0) {
      await conn.query(
        "INSERT INTO lead_distribution (username, priority, max_leads) VALUES ?",
        [settings]
      );
    }

    return NextResponse.redirect(
      new URL("/admin-dashboard/lead-distribution", req.url)
    );
  }

  // JSON mode
  const body = await req.json();
  const { username, priority = 0, max_leads = 0 } = body || {};
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  await conn.execute(
    "INSERT INTO lead_distribution (username, priority, max_leads) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE priority = VALUES(priority), max_leads = VALUES(max_leads)",
    [username, Number(priority) || 0, Number(max_leads) || 0]
  );

  return NextResponse.json({ success: true });
}

// PUT: update a row by username
export async function PUT(req) {
  const conn = await getDbConnection();
  const body = await req.json();
  const { username, priority, max_leads } = body || {};
  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  await conn.execute(
    "UPDATE lead_distribution SET priority = ?, max_leads = ? WHERE username = ?",
    [Number(priority) || 0, Number(max_leads) || 0, username]
  );

  return NextResponse.json({ success: true });
}

// DELETE: remove a row by username
export async function DELETE(req) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  if (!username) {
    return NextResponse.json(
      { error: "username query param is required" },
      { status: 400 }
    );
  }

  await conn.execute("DELETE FROM lead_distribution WHERE username = ?", [
    username,
  ]);

  return NextResponse.json({ success: true });
}
