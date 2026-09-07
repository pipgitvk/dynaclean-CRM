import { NextResponse } from "next/server";
import { getSessionPayload } from "../../../lib/auth";
import { dbExecute, dbQuery } from "@/lib/db";

// GET - Fetch all terms and conditions
export async function GET(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await dbQuery(
      `SELECT id, title, terms_text, applicable_for, created_at, updated_at
       FROM terms_conditions
       ORDER BY updated_at DESC`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching terms and conditions:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create new terms and conditions
export async function POST(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { title, terms, applicable } = await request.json();

    if (!title || !terms) {
      return NextResponse.json(
        { success: false, error: "Title and terms are required" },
        { status: 400 }
      );
    }

    const result = await dbExecute(
      `INSERT INTO terms_conditions (title, terms_text, applicable_for, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [title, terms, JSON.stringify(applicable || {})]
    );

    return NextResponse.json({
      success: true,
      data: { id: result.insertId, title, terms_text: terms, applicable_for: applicable },
    });
  } catch (error) {
    console.error("Error creating terms and conditions:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update existing terms and conditions
export async function PUT(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, terms, applicable } = await request.json();

    if (!id || !title || !terms) {
      return NextResponse.json(
        { success: false, error: "ID, title and terms are required" },
        { status: 400 }
      );
    }

    const result = await dbExecute(
      `UPDATE terms_conditions
       SET title = ?, terms_text = ?, applicable_for = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, terms, JSON.stringify(applicable || {}), id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Terms and conditions not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id, title, terms_text: terms, applicable_for: applicable },
    });
  } catch (error) {
    console.error("Error updating terms and conditions:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete terms and conditions
export async function DELETE(request) {
  try {
    const session = await getSessionPayload();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    const result = await dbExecute(
      `DELETE FROM terms_conditions WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "Terms and conditions not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Terms and conditions deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting terms and conditions:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
