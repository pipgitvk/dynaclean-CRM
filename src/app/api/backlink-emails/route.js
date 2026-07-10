import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET all backlink emails
export async function GET() {
  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      `SELECT id, email, created_at 
       FROM backlink_emails 
       ORDER BY created_at DESC`
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch backlink emails:", error);
    return NextResponse.json(
      { message: "Failed to fetch emails.", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new backlink email
export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: "Email is required." },
        { status: 400 }
      );
    }

    const connection = await getDbConnection();

    // Check for duplicate email
    const [existing] = await connection.execute(
      "SELECT id FROM backlink_emails WHERE LOWER(email) = LOWER(?)",
      [email]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { message: "This email already exists." },
        { status: 409 }
      );
    }

    const [result] = await connection.execute(
      `INSERT INTO backlink_emails (email, created_at)
       VALUES (?, NOW())`,
      [email]
    );

    return NextResponse.json(
      {
        message: "Email added successfully.",
        id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create backlink email:", error);
    return NextResponse.json(
      { message: "Failed to add email.", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete backlink email
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
      "SELECT * FROM backlink_emails WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { message: "Email not found." },
        { status: 404 }
      );
    }

    await connection.execute(
      "DELETE FROM backlink_emails WHERE id = ?",
      [id]
    );

    return NextResponse.json(
      { message: "Email deleted successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete backlink email:", error);
    return NextResponse.json(
      { message: "Failed to delete email.", error: error.message },
      { status: 500 }
    );
  }
}
