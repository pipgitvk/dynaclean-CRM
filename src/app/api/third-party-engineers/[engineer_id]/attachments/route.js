import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
 * POST /api/third-party-engineers/[engineer_id]/attachments
 * Upload attachments for a third-party engineer to Cloudinary
 */
export async function POST(req, context) {
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
          attachments TEXT NULL COMMENT 'JSON array of {attachment_id, attachment_name, file_path, file_url}',
          status ENUM('active','inactive') NOT NULL DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (_) {}
    try {
      await conn.execute(`ALTER TABLE third_party_service_engineers ADD COLUMN IF NOT EXISTS attachments TEXT NULL COMMENT 'JSON array of {attachment_id, attachment_name, file_path, file_url}'`);
    } catch (_) {}

    const params = await context.params;
    const { engineer_id } = params;

    if (!engineer_id) {
      return NextResponse.json(
        { error: "Engineer ID is required" },
        { status: 400 }
      );
    }

    // Check if engineer exists
    const [existing] = await conn.execute(
      "SELECT engineer_id, attachments FROM third_party_service_engineers WHERE engineer_id = ?",
      [engineer_id]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Engineer not found" },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const files = formData.getAll("files");
    const attachmentNames = formData.getAll("attachmentNames");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Parse existing attachments JSON
    let currentAttachments = [];
    try {
      currentAttachments = existing[0].attachments ? JSON.parse(existing[0].attachments) : [];
    } catch (_) {
      currentAttachments = [];
    }
    if (!Array.isArray(currentAttachments)) currentAttachments = [];

    const uploadedAttachments = [];
    let attachmentIdCounter = (() => {
      let max = 0;
      currentAttachments.forEach(a => {
        const id = Number(a?.attachment_id || 0);
        if (id > max) max = id;
      });
      return max;
    })();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachmentName = attachmentNames[i] || file.name;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      try {
        // Upload to Cloudinary
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `third-party-engineers/${engineer_id}`,
              resource_type: "auto",
              public_id: `${Date.now()}-${file.name.split('.')[0]}`,
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          stream.end(buffer);
        });

        attachmentIdCounter += 1;
        const newAttachment = {
          attachment_id: attachmentIdCounter,
          attachment_name: attachmentName,
          file_url: result.secure_url,
          file_path: result.public_id,
          cloudinary_id: result.public_id,
          created_at: new Date().toISOString(),
        };

        currentAttachments.push(newAttachment);
        uploadedAttachments.push(newAttachment);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        throw new Error(`Failed to upload ${attachmentName}: ${uploadError.message}`);
      }
    }

    // Save updated JSON back to row
    await conn.execute(
      `UPDATE third_party_service_engineers SET attachments = ?, updated_at = CURRENT_TIMESTAMP WHERE engineer_id = ?`,
      [JSON.stringify(currentAttachments), engineer_id]
    );

    return NextResponse.json(
      {
        message: "Attachments uploaded successfully to Cloudinary",
        attachments: uploadedAttachments,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading attachments:", error);
    return NextResponse.json(
      { error: "Failed to upload attachments", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/third-party-engineers/[engineer_id]/attachments?attachment_id=123
 * Delete an attachment from Cloudinary (removed from JSON array inside main table row)
 */
export async function DELETE(req, context) {
  try {
    const auth = await verifyAccess();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const conn = await getDbConnection();
    const params = await context.params;
    const { engineer_id } = params;
    const { searchParams } = new URL(req.url);
    const attachment_id = searchParams.get("attachment_id");

    if (!engineer_id || !attachment_id) {
      return NextResponse.json(
        { error: "Engineer ID and Attachment ID are required" },
        { status: 400 }
      );
    }

    // Fetch engineer row with attachments JSON
    const [rows] = await conn.execute(
      `SELECT engineer_id, attachments FROM third_party_service_engineers WHERE engineer_id = ?`,
      [engineer_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Engineer not found" },
        { status: 404 }
      );
    }

    let currentAttachments = [];
    try {
      currentAttachments = rows[0].attachments ? JSON.parse(rows[0].attachments) : [];
    } catch (_) {
      currentAttachments = [];
    }
    if (!Array.isArray(currentAttachments)) currentAttachments = [];

    // Find target attachment
    const targetAttachment = currentAttachments.find(a => String(a?.attachment_id) === String(attachment_id));
    if (!targetAttachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Delete from Cloudinary if it has cloudinary_id
    if (targetAttachment.cloudinary_id) {
      try {
        await cloudinary.uploader.destroy(targetAttachment.cloudinary_id);
      } catch (err) {
        console.warn("Warning: Failed to delete from Cloudinary:", err.message);
        // Continue with database update even if Cloudinary delete fails
      }
    }

    // Remove from array
    const updatedAttachments = currentAttachments.filter(
      a => String(a?.attachment_id) !== String(attachment_id)
    );

    const [updateResult] = await conn.execute(
      `UPDATE third_party_service_engineers SET attachments = ?, updated_at = CURRENT_TIMESTAMP WHERE engineer_id = ?`,
      [JSON.stringify(updatedAttachments), engineer_id]
    );

    if (updateResult.affectedRows === 0) {
      return NextResponse.json(
        { error: "Failed to delete attachment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Attachment deleted successfully from Cloudinary",
    });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment", details: error.message },
      { status: 500 }
    );
  }
}
