// API route for approving Q&A questions (Admin only)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getDbConnection } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";

// POST - Approve a question
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

    // Only SUPERADMIN/ADMIN can approve
    const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Question ID required" }, { status: 400 });
    }

    await conn.execute(
      `UPDATE qa_questions 
       SET is_approved = TRUE, approved_by = ?, approved_on = NOW()
       WHERE id = ?`,
      [username, id]
    );

    return NextResponse.json({ success: true, message: "Question approved successfully" });
  } catch (err) {
    console.error("Error approving question:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - Reject a question
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

    // Only SUPERADMIN/ADMIN can reject
    const isAdmin = userRole === "SUPERADMIN" || userRole === "ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Question ID required" }, { status: 400 });
    }

    await conn.execute(
      `UPDATE qa_questions SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, message: "Question rejected successfully" });
  } catch (err) {
    console.error("Error rejecting question:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
