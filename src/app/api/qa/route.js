// API route for Q&A operations
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// GET - Fetch all questions (approved for users, all for admin)
export async function GET(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;
    const conn = await getDbConnection();

    // Get user role
    const [userRows] = await conn.execute(
      `SELECT userRole FROM emplist WHERE username = ?
       UNION
       SELECT userRole FROM rep_list WHERE username = ?`,
      [username, username]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userRows[0].userRole;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // 'all', 'pending', 'approved'
    const tag = searchParams.get("tag");

    let query = `
      SELECT * FROM qa_questions 
      WHERE is_active = TRUE
    `;
    const params = [];

    // SUPERADMIN and ADMIN see all, users see only approved
    const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";
    if (!isAdmin) {
      query += ` AND is_approved = TRUE`;
    } else if (filter === "pending") {
      query += ` AND is_approved = FALSE`;
    } else if (filter === "approved") {
      query += ` AND is_approved = TRUE`;
    }

    // Filter by tag if provided
    if (tag) {
      query += ` AND tags LIKE ?`;
      params.push(`%${tag}%`);
    }

    query += ` ORDER BY added_on DESC`;

    const [questions] = await conn.execute(query, params);

    return NextResponse.json({ questions, userRole });
  } catch (err) {
    console.error("Error fetching questions:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Add new question
export async function POST(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;
    const conn = await getDbConnection();

    // Get user role
    const [userRows] = await conn.execute(
      `SELECT userRole FROM emplist WHERE username = ?
       UNION
       SELECT userRole FROM rep_list WHERE username = ?`,
      [username, username]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userRows[0].userRole;
    const body = await request.json();
    const { question, answer, image_url, tags } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Question and answer are required" },
        { status: 400 }
      );
    }

    // Determine tags: SUPERADMIN/ADMIN can set custom tags, employees use their role
    let finalTags = tags;
    const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";
    if (!isAdmin) {
      finalTags = userRole; // Use user's role as tag
    }

    // SUPERADMIN/ADMIN questions are auto-approved
    const isApproved = isAdmin;
    const approvedBy = isApproved ? username : null;
    const approvedOn = isApproved ? new Date() : null;

    const [result] = await conn.execute(
      `INSERT INTO qa_questions 
       (question, answer, image_url, tags, added_by, is_approved, approved_by, approved_on) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [question, answer, image_url || null, finalTags, username, isApproved, approvedBy, approvedOn]
    );

    return NextResponse.json({
      success: true,
      id: result.insertId,
      message: isApproved ? "Question added successfully" : "Question submitted for approval"
    });
  } catch (err) {
    console.error("Error adding question:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - Update question
export async function PUT(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;
    const conn = await getDbConnection();

    // Get user role
    const [userRows] = await conn.execute(
      `SELECT userRole FROM emplist WHERE username = ?
       UNION
       SELECT userRole FROM rep_list WHERE username = ?`,
      [username, username]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userRows[0].userRole;
    const body = await request.json();
    const { id, question, answer, image_url, tags } = body;

    if (!id) {
      return NextResponse.json({ error: "Question ID required" }, { status: 400 });
    }

    // Check if user can edit (SUPERADMIN/ADMIN or original creator)
    const [existing] = await conn.execute(
      `SELECT added_by FROM qa_questions WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";
    if (!isAdmin && existing[0].added_by !== username) {
      return NextResponse.json({ error: "Unauthorized to edit" }, { status: 403 });
    }

    await conn.execute(
      `UPDATE qa_questions 
       SET question = ?, answer = ?, image_url = ?, tags = ?, modified_by = ?, modified_on = NOW()
       WHERE id = ?`,
      [question, answer, image_url || null, tags, username, id]
    );

    return NextResponse.json({ success: true, message: "Question updated successfully" });
  } catch (err) {
    console.error("Error updating question:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE - Soft delete question
export async function DELETE(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const username = payload.username;
    const conn = await getDbConnection();

    // Get user role
    const [userRows] = await conn.execute(
      `SELECT userRole FROM emplist WHERE username = ?
       UNION
       SELECT userRole FROM rep_list WHERE username = ?`,
      [username, username]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userRows[0].userRole;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Question ID required" }, { status: 400 });
    }

    // Only SUPERADMIN/ADMIN can delete
    const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await conn.execute(
      `UPDATE qa_questions SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, message: "Question deleted successfully" });
  } catch (err) {
    console.error("Error deleting question:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
