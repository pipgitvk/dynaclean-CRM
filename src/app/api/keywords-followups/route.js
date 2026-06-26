import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET followups for a specific keyword
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword_id = searchParams.get("keyword_id");

    if (!keyword_id) {
      return NextResponse.json(
        { message: "keyword_id parameter is required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      `SELECT id, keyword_id, followup_date, page, rank, status, notes, created_at, updated_at 
       FROM keywords_followups 
       WHERE keyword_id = ? 
       ORDER BY followup_date DESC`,
      [keyword_id]
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch followups:", error);
    return NextResponse.json(
      { message: "Failed to fetch followups.", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new followup
export async function POST(request) {
  try {
    const { keyword_id, followup_date, page, rank, status, notes } = await request.json();

    if (!keyword_id) {
      return NextResponse.json(
        { message: "keyword_id is required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Check if keyword exists
    const [keyword] = await connection.execute(
      "SELECT id FROM keywords WHERE id = ?",
      [keyword_id]
    );

    if (keyword.length === 0) {
      return NextResponse.json(
        { message: "Keyword not found." },
        { status: 404 }
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO keywords_followups (keyword_id, followup_date, page, rank, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [keyword_id, followup_date || null, page || null, rank != null ? parseInt(rank) : 0, status || "pending", notes || null]
    );

    return NextResponse.json(
      {
        message: "Followup added successfully.",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create followup:", error);
    return NextResponse.json(
      { message: "Failed to create followup.", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update followup
export async function PUT(request) {
  try {
    const { id, followup_date, page, rank, status, notes } = await request.json();

    if (!id) {
      return NextResponse.json(
        { message: "ID is required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [existing] = await connection.execute(
      "SELECT * FROM keywords_followups WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Followup not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      `UPDATE keywords_followups 
       SET followup_date = ?, page = ?, rank = ?, status = ?, notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [followup_date || null, page || null, rank != null ? parseInt(rank) : 0, status || "pending", notes || null, id]
    );

    return NextResponse.json(
      { message: "Followup updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update followup:", error);
    return NextResponse.json(
      { message: "Failed to update followup.", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete followup
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
      "SELECT * FROM keywords_followups WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Followup not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      "DELETE FROM keywords_followups WHERE id = ?",
      [id]
    );

    return NextResponse.json(
      { message: "Followup deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete followup:", error);
    return NextResponse.json(
      { message: "Failed to delete followup.", error: error.message },
      { status: 500 }
    );
  }
}
