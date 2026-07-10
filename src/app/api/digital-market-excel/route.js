import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET all backlinks excel data
export async function GET(request) {
  try {
    // Get username from query or session
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { message: "Username is required." },
        { status: 400 }
      );
    }

    // Check if user has backlinks excel data module access
    const hasAccess = await checkUserHasBacklinksExcelAccess(username);
    if (!hasAccess) {
      return NextResponse.json(
        { message: `User '${username}' does not have access to Backlinks Excel Data module. Please assign to a user who has backlinks-excel-data or keywords-management permission.` },
        { status: 403 }
      );
    }

    // Get user role to determine data visibility
    const connection = await getDbConnection();
    const [userRows] = await connection.execute(
      "SELECT userRole FROM rep_list WHERE username = ? LIMIT 1",
      [username]
    );

    const userRole = userRows.length > 0 ? (userRows[0].userRole || "").toUpperCase().trim() : "";
    const isSuperAdminOrEA = userRole === "SUPERADMIN" || userRole === "EA";

    let query = `SELECT id, website, keyword, email, followup_date as date_added, status, assigned_to, updated_at, created_at 
       FROM backlinks`;

    // If not SuperAdmin or EA, filter by current user
    if (!isSuperAdminOrEA) {
      query += ` WHERE assigned_to = ?`;
    }

    query += ` ORDER BY updated_at DESC`;

    const [rows] = isSuperAdminOrEA
      ? await connection.execute(query)
      : await connection.execute(query, [username]);

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch backlinks:", error);
    return NextResponse.json(
      { message: "Failed to fetch backlinks.", error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to check if user has backlinks excel data module access
async function checkUserHasBacklinksExcelAccess(username) {
  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      "SELECT module_access, userRole FROM rep_list WHERE username = ? LIMIT 1",
      [username]
    );

    if (!rows.length) {
      return false;
    }

    // SuperAdmin and ADMIN bypass check
    const userRole = rows[0].userRole || "";
    const roleUpper = String(userRole).trim().toUpperCase();
    if (roleUpper === "SUPERADMIN" || roleUpper === "ADMIN") {
      return true;
    }

    const moduleAccess = rows[0].module_access;
    if (!moduleAccess) return false;

    // Parse JSON array format
    let modules = [];
    try {
      modules = JSON.parse(moduleAccess);
    } catch (e) {
      // Fallback to comma-separated if not JSON
      modules = moduleAccess.split(",").map(m => m.trim());
    }

    // Check if user has backlinks-excel-data OR keywords-management module access
    return modules.includes("backlinks-excel-data") || modules.includes("keywords-management");
  } catch (error) {
    console.error("Error checking module access:", error);
    return false;
  }
}

// POST - Create new backlink entry
export async function POST(request) {
  try {
    const { website, keyword, email, date_added, status, assigned_to, created_by } = await request.json();

    if (!website || !keyword) {
      return NextResponse.json(
        { message: "Website and Keyword are required." },
        { status: 400 }
      );
    }

    if (!assigned_to) {
      return NextResponse.json(
        { message: "Assigned user is required." },
        { status: 400 }
      );
    }

    // Check if assigned user has backlinks excel data module access
    const hasAccess = await checkUserHasBacklinksExcelAccess(assigned_to);
    if (!hasAccess) {
      return NextResponse.json(
        { message: `User '${assigned_to}' does not have access to Backlinks Excel Data module. Please assign to a user who has backlinks-excel-data or keywords-management permission.` },
        { status: 403 }
      );
    }

    const connection = await getDbConnection();
    const [result] = await connection.execute(
      `INSERT INTO backlinks (website, keyword, email, followup_date, status, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [website, keyword, email || null, date_added || null, status || 'pending', assigned_to]
    );

    return NextResponse.json(
      { message: "Backlink created successfully.", id: result.insertId },
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

// PUT - Update backlink entry
export async function PUT(request) {
  try {
    const { id, website, keyword, email, date_added, status, assigned_to } = await request.json();

    if (!id) {
      return NextResponse.json(
        { message: "ID is required." },
        { status: 400 }
      );
    }

    if (!assigned_to) {
      return NextResponse.json(
        { message: "Assigned user is required." },
        { status: 400 }
      );
    }

    // Check if assigned user has backlinks excel data module access
    const hasAccess = await checkUserHasBacklinksExcelAccess(assigned_to);
    if (!hasAccess) {
      return NextResponse.json(
        { message: `User '${assigned_to}' does not have access to Backlinks Excel Data module. Please assign to a user who has backlinks-excel-data or keywords-management permission.` },
        { status: 403 }
      );
    }

    const connection = await getDbConnection();
    const [result] = await connection.execute(
      `UPDATE backlinks 
       SET website = ?, keyword = ?, email = ?, followup_date = ?, status = ?, assigned_to = ?, updated_at = NOW()
       WHERE id = ?`,
      [website, keyword, email || null, date_added || null, status, assigned_to, id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Backlink not found." },
        { status: 404 }
      );
    }

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

// DELETE - Remove backlink entry
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
    const [result] = await connection.execute(
      `DELETE FROM backlinks WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: "Backlink not found." },
        { status: 404 }
      );
    }

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
