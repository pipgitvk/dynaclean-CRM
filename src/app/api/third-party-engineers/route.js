import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { ensureThirdPartyEngineerColumns } from "@/lib/thirdPartyEngineerSchema";
import { ensureThirdPartyEngineerFollowupsTable } from "@/lib/ensureThirdPartyEngineerFollowupsTable";
import crypto from "crypto";
import {
  buildThirdPartyEngineerCreatedByWhere,
  isThirdPartyEngineerModuleRole,
} from "@/lib/thirdPartyEngineerAccess";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";

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

  const roleNorm = normalizeRoleKey(payload.role || payload.userRole || "");

  if (!isThirdPartyEngineerModuleRole(roleNorm)) {
    return { authorized: false, error: "Forbidden: Only Super Admin, Admin, and Service Support can access this resource", status: 403 };
  }

  return { authorized: true };
}

/**
 * GET /api/third-party-engineers
 * List all third-party service engineers
 * Query params: search, status, limit, offset
 * SUPERADMIN sees all; SERVICE SUPPORT sees team pool; others see only their own
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
    await ensureThirdPartyEngineerColumns(conn);
    await ensureThirdPartyEngineerFollowupsTable(conn);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "active";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get current user info
    const payload = await getSessionPayload();
    const roleNorm = normalizeRoleKey(payload.role || payload.userRole || "");
    const username = payload.username || payload.email || "";

    let whereClause = "WHERE 1=1";
    let listWhereClause = "WHERE 1=1";
    const params = [];

    const createdByScope = buildThirdPartyEngineerCreatedByWhere({
      roleNorm,
      username,
      columnExpr: "created_by",
    });
    const listCreatedByScope = buildThirdPartyEngineerCreatedByWhere({
      roleNorm,
      username,
      columnExpr: "e.created_by",
    });
    whereClause += createdByScope.sql;
    listWhereClause += listCreatedByScope.sql;
    params.push(...createdByScope.params);

    if (status && status !== "all") {
      whereClause += " AND status = ?";
      listWhereClause += " AND e.status = ?";
      params.push(status);
    }

    if (search) {
      whereClause += " AND (name LIKE ? OR email LIKE ? OR mobile LIKE ? OR state LIKE ?)";
      listWhereClause +=
        " AND (e.name LIKE ? OR e.email LIKE ? OR e.mobile LIKE ? OR e.state LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countSql = `SELECT COUNT(*) as total FROM third_party_service_engineers ${whereClause}`;
    const [countRows] = await conn.execute(countSql, params);
    const total = countRows[0]?.total || 0;

    const sql = `
      SELECT
        e.engineer_id,
        e.name,
        e.mobile,
        e.secondary_contact_number,
        e.email,
        e.address,
        e.state,
        e.geo_location,
        e.remark,
        e.service_charge,
        e.status,
        e.created_by,
        e.created_at,
        e.updated_at,
        (
          SELECT f.next_followup_date
          FROM third_party_engineer_followups f
          WHERE f.engineer_id = e.engineer_id
          ORDER BY f.created_at DESC, f.id DESC
          LIMIT 1
        ) AS next_followup_date
      FROM third_party_service_engineers e
      ${listWhereClause}
      ORDER BY e.created_at DESC
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

    await ensureThirdPartyEngineerColumns(conn);

    const {
      name,
      mobile,
      secondary_contact_number,
      email,
      password,
      address,
      state,
      geo_location,
      remark,
      service_charge,
    } = body;

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
      (name, mobile, secondary_contact_number, email, password, address, state, geo_location, remark, service_charge, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const parsedCharge =
      service_charge === "" || service_charge === undefined || service_charge === null
        ? null
        : Number(service_charge);

    const values = [
      name,
      mobile,
      secondary_contact_number || null,
      email,
      hashedPassword,
      address || null,
      state || null,
      geo_location || null,
      remark || null,
      Number.isFinite(parsedCharge) ? parsedCharge : null,
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
