// src/app/api/company-documents/[id]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import fs from "fs/promises";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret";
const UPLOAD_DIR = path.join(process.cwd(), "public", "company_documents");

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'image/jpeg': '.jpg',
  'image/png': '.png'
};

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Helper function to validate file type and size
function validateFile(file) {
  if (!file || !file.size) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size exceeds 10MB limit" };
  }

  if (!ALLOWED_FILE_TYPES[file.type]) {
    return { valid: false, error: "File type not allowed. Only PDF, DOCX, XLSX, JPG, PNG are allowed" };
  }

  return { valid: true };
}

// Helper function to save file locally
async function saveFileLocally(file, documentName) {
  const timestamp = Date.now();
  const sanitizedName = documentName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileExtension = ALLOWED_FILE_TYPES[file.type];
  const fileName = `${sanitizedName}_${timestamp}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Save file
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return `/company_documents/${fileName}`;
}

// Helper function to verify user role
async function verifyUserRole(token) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    const role = payload.role;

    // Only allow SUPERADMIN, ADMIN, and ACCOUNTANT
    if (!['SUPERADMIN', 'ADMIN', 'ACCOUNTANT'].includes(role)) {
      return { authorized: false, error: "Access denied. Insufficient permissions." };
    }

    return { authorized: true, user: payload };
  } catch (error) {
    return { authorized: false, error: "Invalid or expired token." };
  }
}

// GET: Fetch single document
export async function GET(request, { params }) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authResult = await verifyUserRole(token);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const { id } = params;
    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      "SELECT * FROM company_documents WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document: rows[0] });
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update document
export async function PUT(request, { params }) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authResult = await verifyUserRole(token);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const { id } = params;
    const formData = await request.formData();
    const documentName = formData.get("documentName");
    const file = formData.get("file");
    const expiryDate = formData.get("expiryDate");
    const isLifetime = formData.get("isLifetime") === "true";
    const folderCategory = formData.get("folderCategory");

    // Validate required fields
    if (!documentName) {
      return NextResponse.json({ error: "Document name is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Check if document exists
    const [existingRows] = await conn.execute(
      "SELECT * FROM company_documents WHERE id = ?",
      [id]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let documentPath = existingRows[0].document_path;

    // If new file is provided, validate and save it
    if (file && file.size > 0) {
      const fileValidation = validateFile(file);
      if (!fileValidation.valid) {
        return NextResponse.json({ error: fileValidation.error }, { status: 400 });
      }

      // Delete old file
      const oldFilePath = path.join(process.cwd(), "public", documentPath);
      try {
        await fs.unlink(oldFilePath);
      } catch (error) {
        console.warn("Could not delete old file:", error);
      }

      // Save new file
      documentPath = await saveFileLocally(file, documentName);
    }

    // Prepare expiry date
    const finalExpiryDate = isLifetime ? null : expiryDate;

    // Update database
    const updateFields = [];
    const updateParams = [];

    updateFields.push("document_name = ?");
    updateParams.push(documentName);

    updateFields.push("document_path = ?");
    updateParams.push(documentPath);

    updateFields.push("expiry_date = ?");
    updateParams.push(finalExpiryDate);

    if (folderCategory) {
      updateFields.push("folder_category = ?");
      updateParams.push(folderCategory);
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateParams.push(id);

    await conn.execute(
      `UPDATE company_documents SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams
    );

    return NextResponse.json({
      success: true,
      message: "Document updated successfully"
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete document
export async function DELETE(request, { params }) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authResult = await verifyUserRole(token);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const { id } = params;
    const conn = await getDbConnection();

    // Get document info before deletion
    const [rows] = await conn.execute(
      "SELECT * FROM company_documents WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const document = rows[0];

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), "public", document.document_path);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn("Could not delete file:", error);
    }

    // Delete from database
    await conn.execute(
      "DELETE FROM company_documents WHERE id = ?",
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
