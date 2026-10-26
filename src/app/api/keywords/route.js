import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET all keywords
export async function GET() {
  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      `SELECT 
         k.id, k.keyword, k.page, k.rank, k.assigned_to, k.updated_at, k.created_at,
         lf.rank AS latest_followup_rank,
         lf.page AS latest_followup_page,
         lf.followup_date AS latest_followup_date
       FROM keywords k
       LEFT JOIN keywords_followups lf ON lf.id = (
         SELECT id FROM keywords_followups
         WHERE keyword_id = k.id
         ORDER BY followup_date DESC, created_at DESC
         LIMIT 1
       )
       ORDER BY k.updated_at DESC`
    );

    // Ensure numeric fields are proper numbers, not strings
    const normalized = rows.map((row) => ({
      ...row,
      rank: row.rank != null ? Number(row.rank) : null,
      latest_followup_rank: row.latest_followup_rank != null ? Number(row.latest_followup_rank) : null,
    }));

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch keywords:", error);
    return NextResponse.json(
      { message: "Failed to fetch keywords.", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new keyword
export async function POST(request) {
  try {
    const { keyword, page, rank, assigned_to } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { message: "Keyword is required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Check for duplicate keyword
    const [existing] = await connection.execute(
      "SELECT id FROM keywords WHERE LOWER(keyword) = LOWER(?)",
      [keyword]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { message: "This keyword already exists." },
        { status: 409 }
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO keywords (keyword, page, rank, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [keyword, page || null, rank || 0, assigned_to || null]
    );

    return NextResponse.json(
      {
        message: "Keyword added successfully.",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create keyword:", error);
    return NextResponse.json(
      { message: "Failed to create keyword.", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update keyword
export async function PUT(request) {
  try {
    const { id, keyword, page, rank, assigned_to } = await request.json();

    if (!id || !keyword) {
      return NextResponse.json(
        { message: "ID and keyword are required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    const [existing] = await connection.execute(
      "SELECT * FROM keywords WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Keyword not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      `UPDATE keywords 
       SET keyword = ?, page = ?, rank = ?, assigned_to = ?, updated_at = NOW()
       WHERE id = ?`,
      [keyword, page || null, rank || 0, assigned_to || null, id]
    );

    return NextResponse.json(
      { message: "Keyword updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update keyword:", error);
    return NextResponse.json(
      { message: "Failed to update keyword.", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete keyword
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
      "SELECT * FROM keywords WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Keyword not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      "DELETE FROM keywords WHERE id = ?",
      [id]
    );

    return NextResponse.json(
      { message: "Keyword deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete keyword:", error);
    return NextResponse.json(
      { message: "Failed to delete keyword.", error: error.message },
      { status: 500 }
    );
  }
}
