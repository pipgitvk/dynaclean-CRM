import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { ensureThirdPartyEngineerColumns } from "@/lib/thirdPartyEngineerSchema";
import crypto from "crypto";
import {
  canAccessThirdPartyEngineerById,
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
 * GET /api/third-party-engineers/[engineer_id]
 * Get a single third-party engineer with attachments
 * SUPERADMIN can access any, others can only access their own
 */
export async function GET(req, context) {
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

    const params = await context.params;
    const { engineer_id } = params;

    if (!engineer_id) {
      return NextResponse.json(
        { error: "Engineer ID is required" },
        { status: 400 }
      );
    }

    // Get current user
    const payload = await getSessionPayload();
    // Fetch engineer details
    const [engineers] = await conn.execute(
      `SELECT engineer_id, name, mobile, secondary_contact_number, email, address, state, geo_location, remark, service_charge, attachments, status, created_by, created_at, updated_at
       FROM third_party_service_engineers
       WHERE engineer_id = ?`,
      [engineer_id]
    );

    if (engineers.length === 0) {
      return NextResponse.json(
        { error: "Engineer not found" },
        { status: 404 }
      );
    }

    const engineer = engineers[0];

    const canAccess = await canAccessThirdPartyEngineerById(
      conn,
      engineer_id,
      payload,
    );
    if (!canAccess) {
      return NextResponse.json(
        { error: "Forbidden: You can only access your own engineers" },
        { status: 403 },
      );
    }

    // Parse attachments from JSON column
    let attachments = [];
    try {
      attachments = engineer.attachments ? JSON.parse(engineer.attachments) : [];
    } catch (_) {
      attachments = [];
    }
    if (!Array.isArray(attachments)) attachments = [];
    engineer.attachments = attachments;
    delete engineer.attachments_raw;

    return NextResponse.json(engineer);
  } catch (error) {
    console.error("Error fetching third-party engineer:", error);
    return NextResponse.json(
      { error: "Failed to fetch engineer", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/third-party-engineers/[engineer_id]
 * Update a third-party engineer
 * SUPERADMIN can update any, others can only update their own
 */
export async function PUT(req, context) {
  try {
    const auth = await verifyAccess();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const conn = await getDbConnection();
    const params = await context.params;
    const { engineer_id } = params;
    const body = await req.json();

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
      status,
    } = body;

    if (!engineer_id) {
      return NextResponse.json(
        { error: "Engineer ID is required" },
        { status: 400 }
      );
    }

    const payload = await getSessionPayload();

    const [existing] = await conn.execute(
      "SELECT engineer_id, created_by FROM third_party_service_engineers WHERE engineer_id = ?",
      [engineer_id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Engineer not found" },
        { status: 404 }
      );
    }

    const canUpdate = await canAccessThirdPartyEngineerById(
      conn,
      engineer_id,
      payload,
    );
    if (!canUpdate) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own engineers" },
        { status: 403 }
      );
    }

    // If email is being changed, check for duplicates
    if (email) {
      const [emailCheck] = await conn.execute(
        "SELECT engineer_id FROM third_party_service_engineers WHERE email = ? AND engineer_id != ?",
        [email, engineer_id]
      );

      if (emailCheck.length > 0) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 400 }
        );
      }
    }

    const updateFields = [];
    const values = [];

    if (name !== undefined) {
      updateFields.push("name = ?");
      values.push(name);
    }
    if (mobile !== undefined) {
      updateFields.push("mobile = ?");
      values.push(mobile);
    }
    if (email !== undefined) {
      updateFields.push("email = ?");
      values.push(email);
    }
    if (password !== undefined) {
      updateFields.push("password = ?");
      values.push(hashPassword(password));
    }
    if (address !== undefined) {
      updateFields.push("address = ?");
      values.push(address);
    }
    if (state !== undefined) {
      updateFields.push("state = ?");
      values.push(state);
    }
    if (geo_location !== undefined) {
      updateFields.push("geo_location = ?");
      values.push(geo_location);
    }
    if (remark !== undefined) {
      updateFields.push("remark = ?");
      values.push(remark);
    }
    if (secondary_contact_number !== undefined) {
      updateFields.push("secondary_contact_number = ?");
      values.push(secondary_contact_number || null);
    }
    if (service_charge !== undefined) {
      const parsedCharge =
        service_charge === "" || service_charge === null
          ? null
          : Number(service_charge);
      updateFields.push("service_charge = ?");
      values.push(Number.isFinite(parsedCharge) ? parsedCharge : null);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      values.push(status);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(engineer_id);

    const sql = `UPDATE third_party_service_engineers SET ${updateFields.join(", ")} WHERE engineer_id = ?`;

    const [result] = await conn.execute(sql, values);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Failed to update engineer" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Third-party engineer updated successfully",
      engineer_id,
    });
  } catch (error) {
    console.error("Error updating third-party engineer:", error);
    return NextResponse.json(
      { error: "Failed to update engineer", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/third-party-engineers/[engineer_id]
 * Delete a third-party engineer (attachments are stored in same row JSON column)
 * SUPERADMIN can delete any, others can only delete their own
 */
export async function DELETE(req, context) {
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

    const params = await context.params;
    const { engineer_id } = params;

    if (!engineer_id) {
      return NextResponse.json(
        { error: "Engineer ID is required" },
        { status: 400 }
      );
    }

    const payload = await getSessionPayload();

    const [existing] = await conn.execute(
      "SELECT engineer_id, created_by FROM third_party_service_engineers WHERE engineer_id = ?",
      [engineer_id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Engineer not found" },
        { status: 404 }
      );
    }

    const canDelete = await canAccessThirdPartyEngineerById(
      conn,
      engineer_id,
      payload,
    );
    if (!canDelete) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own engineers" },
        { status: 403 }
      );
    }

    // Check if engineer is assigned to any active services
    const [assignedServices] = await conn.execute(
      "SELECT COUNT(*) as count FROM service_records WHERE assigned_to_type = 'third_party' AND assigned_to_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')",
      [engineer_id]
    );

    if (assignedServices[0]?.count > 0) {
      return NextResponse.json(
        { error: "Cannot delete engineer who has active service assignments. Please reassign or complete the services first." },
        { status: 400 }
      );
    }

    // (Attachments live inside the main engineer row's JSON column - no separate table cleanup needed)

    // Delete engineer
    const [result] = await conn.execute(
      "DELETE FROM third_party_service_engineers WHERE engineer_id = ?",
      [engineer_id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Failed to delete engineer" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Third-party engineer deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting third-party engineer:", error);
    return NextResponse.json(
      { error: "Failed to delete engineer", details: error.message },
      { status: 500 }
    );
  }
}
