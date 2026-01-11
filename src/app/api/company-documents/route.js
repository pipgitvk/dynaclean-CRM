// src/app/api/company-documents/route.js
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

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

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

// GET: Fetch all company documents with folder support
export async function GET(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authResult = await verifyUserRole(token);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const folder = searchParams.get("folder") || "";

    const conn = await getDbConnection();

    // Get folder statistics
    const [folderStats] = await conn.execute(`
      SELECT 
        folder_category,
        COUNT(*) as document_count
      FROM company_documents
      GROUP BY folder_category
      ORDER BY folder_category
    `);

    let query = "SELECT * FROM company_documents WHERE 1=1";
    let params = [];

    if (search) {
      query += " AND document_name LIKE ?";
      params.push(`%${search}%`);
    }

    if (folder) {
      query += " AND folder_category = ?";
      params.push(folder);
    }

    query += " ORDER BY created_at DESC";

    const [rows] = await conn.execute(query, params);

    return NextResponse.json({
      documents: rows,
      folderStats: folderStats,
      currentFolder: folder || null
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Upload new document
export async function POST(request) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const authResult = await verifyUserRole(token);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 403 });
    }

    const formData = await request.formData();
    const documentName = formData.get("documentName");
    const file = formData.get("file");
    const expiryDate = formData.get("expiryDate");
    const isLifetime = formData.get("isLifetime") === "true";
    const folderCategory = formData.get("folderCategory") || "Uncategorized";

    // Validate required fields
    if (!documentName || !file) {
      return NextResponse.json({ error: "Document name and file are required" }, { status: 400 });
    }

    // Validate file
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    // Save file
    const documentPath = await saveFileLocally(file, documentName);

    // Prepare expiry date
    const finalExpiryDate = isLifetime ? null : expiryDate;

    // Save to database
    const conn = await getDbConnection();
    await conn.execute(
      "INSERT INTO company_documents (document_name, document_path, expiry_date, folder_category, created_by) VALUES (?, ?, ?, ?, ?)",
      [documentName, documentPath, finalExpiryDate, folderCategory, authResult.user.username]
    );

    return NextResponse.json({
      success: true,
      message: "Document uploaded successfully"
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
