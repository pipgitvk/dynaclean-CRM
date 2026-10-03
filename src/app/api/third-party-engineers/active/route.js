import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

/**
 * GET /api/third-party-engineers/active
 * Get active third-party engineers for assignment dropdown
 * This endpoint is accessible to SUPERADMIN, ADMIN, SERVICE HEAD for service assignment
 */
export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roleNorm = String(payload.role || payload.userRole || "")
      .toUpperCase()
      .trim();

    // Allow SUPERADMIN, ADMIN, DIRECTOR, SERVICE HEAD, EA to view active engineers
    const allowed = ["SUPERADMIN", "ADMIN", "DIRECTOR", "SERVICE HEAD", "EA"];
    if (!allowed.includes(roleNorm)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (_) {}
    try {
      await conn.execute(`ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS attachments TEXT NULL COMMENT 'JSON array of {attachment_id, attachment_name, file_path}'`);
    } catch (_) {}

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    let whereClause = "WHERE status = 'active'";
    const params = [];

    if (search) {
      whereClause += " AND (name LIKE ? OR email LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const sql = `
      SELECT engineer_id, name, mobile, email, state, geo_location
      FROM third_party_service_engineers
      ${whereClause}
      ORDER BY name ASC
    `;

    const [engineers] = await conn.execute(sql, params);

    return NextResponse.json(engineers);
  } catch (error) {
    console.error("Error fetching active third-party engineers:", error);
    return NextResponse.json(
      { error: "Failed to fetch engineers", details: error.message },
      { status: 500 }
    );
  }
}
