import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import crypto from "crypto";

/**
 * Helper to hash password
 */
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Helper to verify role access (SUPERADMIN, ADMIN, SERVICE SUPPORT)
 */
async function verifyAccess() {
  const payload = await getSessionPayload();
  if (!payload) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const roleNorm = String(payload.role || payload.userRole || "")
    .toUpperCase()
    .trim();

  const allowed = ["SUPERADMIN", "ADMIN", "SERVICE SUPPORT"];
  if (!allowed.includes(roleNorm)) {
    return { authorized: false, error: "Forbidden: Only Super Admin, Admin, and Service Support can access this resource", status: 403 };
  }

  return { authorized: true };
}

/**
 * GET /api/third-party-engineers
 * List all third-party service engineers
 * Query params: search, status, limit, offset
 * SUPERADMIN sees all, others see only their own
 */
export async function GET(req) {
  try {
    const auth = await verifyAccess();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const conn = await getDbConnection();

    // Auto-migration: create third_party_service_engineers table if it doesn't exist
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS third_party_service_engineers (
          engineer_id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          mobile VARCHAR(50) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          address TEXT NULL,
          state VARCHAR(255) NULL,
          geo_location VARCHAR(255) NULL,
          remark TEXT NULL,
          attachments TEXT NULL COMMENT 'JSON array of {attachment_id, attachment_name, file_path}',
          status ENUM('active','inactive') NOT NULL DEFAULT 'active',
          created_by VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (_) {}
    try {
      await conn.execute(`ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS attachments TEXT NULL COMMENT 'JSON array of {attachment_id, attachment_name, file_path}'`);
    } catch (_) {}
    try {
      await conn.execute(`ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NULL`);
    } catch (_) {}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "active";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get current user info
    const payload = await getSessionPayload();
    const roleNorm = String(payload.role || payload.userRole || "")
      .toUpperCase()
      .trim();
    const username = payload.username || payload.email || "";

    let whereClause = "WHERE 1=1";
    const params = [];

    // If not SUPERADMIN, only show their own engineers
    if (roleNorm !== "SUPERADMIN") {
      whereClause += " AND created_by = ?";
      params.push(username);
    }

    if (status && status !== "all") {
      whereClause += " AND status = ?";
      params.push(status);
    }

    if (search) {
      whereClause += " AND (name LIKE ? OR email LIKE ? OR mobile LIKE ? OR state LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countSql = `SELECT COUNT(*) as total FROM third_party_service_engineers ${whereClause}`;
    const [countRows] = await conn.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    const sql = `
      SELECT engineer_id, name, mobile, email, address, state, geo_location, remark, status, created_by, created_at, updated_at
      FROM third_party_service_engineers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const [engineers] = await conn.execute(sql, params);

    return NextResponse.json({
      data: engineers,
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching third-party engineers:", error);
    return NextResponse.json(
      { error: "Failed to fetch engineers", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/third-party-engineers
 * Create a new third-party service engineer
 */
export async function POST(req) {
  try {
    const auth = await verifyAccess();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const conn = await getDbConnection();
    const body = await req.json();
    const payload = await getSessionPayload();
    const username = payload.username || payload.email || "";

    const { name, mobile, email, password, address, state, geo_location, remark } = body;

    // Validation
    if (!name || !mobile || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields: name, mobile, email, password" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const [existing] = await conn.execute(
      "SELECT engineer_id FROM third_party_service_engineers WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);

    const sql = `
      INSERT INTO third_party_service_engineers 
      (name, mobile, email, password, address, state, geo_location, remark, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      name,
      mobile,
      email,
      hashedPassword,
      address || null,
      state || null,
      geo_location || null,
      remark || null,
      "active",
      username,
    ];

    const [result] = await conn.execute(sql, values);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Failed to create engineer" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Third-party engineer created successfully",
        engineer_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating third-party engineer:", error);
    return NextResponse.json(
      { error: "Failed to create engineer", details: error.message },
      { status: 500 }
    );
  }
}
