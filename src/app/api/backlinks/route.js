import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET all backlinks
export async function GET() {
  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      `SELECT id, website, keyword, email, followup_date, status, assigned_to, updated_at, created_at 
       FROM backlinks 
       ORDER BY updated_at DESC`
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch backlinks:", error);
    return NextResponse.json(
      { message: "Failed to fetch backlinks.", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new backlink
export async function POST(request) {
  try {
    const { website, keyword, email, followup_date, status, assigned_to } = await request.json();

    if (!website || !keyword) {
      return NextResponse.json(
        { message: "Website and keyword are required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [result] = await connection.execute(
      `INSERT INTO backlinks (website, keyword, email, followup_date, status, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [website, keyword, email || null, followup_date || null, status || "pending", assigned_to || null]
    );

    return NextResponse.json(
      {
        message: "Backlink added successfully.",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create backlink:", error);
    return NextResponse.json(
      { message: "Failed to create backlink.", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update backlink
export async function PUT(request) {
  try {
    const { id, website, keyword, email, followup_date, status, assigned_to } = await request.json();

    if (!id || !website || !keyword) {
      return NextResponse.json(
        { message: "ID, website, and keyword are required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [existing] = await connection.execute(
      "SELECT * FROM backlinks WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Backlink not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      `UPDATE backlinks 
       SET website = ?, keyword = ?, email = ?, followup_date = ?, status = ?, assigned_to = ?, updated_at = NOW()
       WHERE id = ?`,
      [website, keyword, email || null, followup_date || null, status || "pending", assigned_to || null, id]
    );

    return NextResponse.json(
      { message: "Backlink updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update backlink:", error);
    return NextResponse.json(
      { message: "Failed to update backlink.", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete backlink
export async function DELETE(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { message: "ID is required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [existing] = await connection.execute(
      "SELECT * FROM backlinks WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Backlink not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      "DELETE FROM backlinks WHERE id = ?",
      [id]
    );

    return NextResponse.json(
      { message: "Backlink deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete backlink:", error);
    return NextResponse.json(
      { message: "Failed to delete backlink.", error: error.message },
      { status: 500 }
    );
  }
}
