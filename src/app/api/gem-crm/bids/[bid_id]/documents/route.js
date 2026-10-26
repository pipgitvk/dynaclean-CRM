import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { parseFormData } from "@/lib/parseForm";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bid-documents");

// Helper function to check if file is an image
function isImageFile(file) {
  const fileName = file.originalFilename || file.newFilename || "";
  const mimeType = file.mimetype || "";
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const extension = fileName.toLowerCase().split('.').pop();
  return mimeType.startsWith('image/') || imageExtensions.includes(`.${extension}`);
}

// Helper function to save bid document (images to Cloudinary, PDFs locally)
async function saveBidDocument(file) {
  if (!file || !file.filepath || !file.originalFilename) {
    throw new Error("File is missing or invalid");
  }

  // If it's an image, upload to Cloudinary
  if (isImageFile(file)) {
    const buffer = await fs.readFile(file.filepath);
    
    const upload = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: 'bid-documents',
          resource_type: "auto"
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      ).end(buffer);
    });
    
    console.log("✅ Bid document uploaded to Cloudinary:", upload);
    return upload;
  }

  // For PDFs and other documents, save locally
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${Date.now()}-${file.originalFilename}`;
  const targetPath = path.join(UPLOAD_DIR, fileName);

  try {
    const fileContent = await fs.readFile(file.filepath);
    await fs.writeFile(targetPath, fileContent);
    console.log("✅ Bid document saved locally:", targetPath);
    return `/uploads/bid-documents/${fileName}`;
  } finally {
    await fs.unlink(file.filepath).catch((err) => {
      console.error("Failed to delete temp file:", err);
    });
  }
}

// GET - Get all documents for a bid
export async function GET(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const role = payload.role;
    if (!["SUPERADMIN", "GEM"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN/GEM only" }, { status: 403 });
    }
    const currentEmpId = payload.empId || payload.id || null;
    if (role === "GEM" && !currentEmpId) {
      return NextResponse.json({ error: "Employee id missing in session." }, { status: 403 });
    }

    // Handle async params in Next.js 15+
    const resolvedParams = await params;
    const bid_id = resolvedParams.bid_id;

    if (!bid_id) {
      return NextResponse.json({ error: "Bid ID is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    if (role === "GEM") {
      const [allowedBids] = await conn.execute(
        "SELECT bid_id FROM bids WHERE bid_id = ? AND assigned_employee_id = ?",
        [bid_id, currentEmpId]
      );
      if (allowedBids.length === 0) {
        await conn.end();
        return NextResponse.json({ error: "Bid not found" }, { status: 404 });
      }
    }

    const [documents] = await conn.execute(
      `SELECT bd.*, e.username as uploaded_by_name
       FROM bid_documents bd
       LEFT JOIN emplist e ON bd.uploaded_by = e.empId
       WHERE bd.bid_id = ?
       ORDER BY bd.created_at DESC`,
      [bid_id]
    );

    await conn.end();

    return NextResponse.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error("Error fetching bid documents:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

// POST - Upload document for a bid
export async function POST(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const role = payload.role;
    if (!["SUPERADMIN", "GEM"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - SUPERADMIN/GEM only" }, { status: 403 });
    }
    const currentEmpId = payload.empId || payload.id || null;
    if (role === "GEM" && !currentEmpId) {
      return NextResponse.json({ error: "Employee id missing in session." }, { status: 403 });
    }

    // Handle async params in Next.js 15+
    const resolvedParams = await params;
    const bid_id = resolvedParams.bid_id;

    if (!bid_id) {
      return NextResponse.json({ error: "Bid ID is required" }, { status: 400 });
    }
    const { fields, files } = await parseFormData(req);
    
    // Normalize field values
    for (const key in fields) {
      if (Array.isArray(fields[key])) {
        fields[key] = fields[key][0];
      }
    }

    const { document_name, document_type } = fields;

    if (!files.document || !files.document[0]) {
      return NextResponse.json(
        { error: "Document file is required" },
        { status: 400 }
      );
    }

    const document_file = await saveBidDocument(files.document[0]);

    const conn = await getDbConnection();
    if (role === "GEM") {
      const [allowedBids] = await conn.execute(
        "SELECT bid_id FROM bids WHERE bid_id = ? AND assigned_employee_id = ?",
        [bid_id, currentEmpId]
      );
      if (allowedBids.length === 0) {
        await conn.end();
        return NextResponse.json({ error: "Bid not found" }, { status: 404 });
      }
    }

    const [result] = await conn.execute(
      `INSERT INTO bid_documents (bid_id, document_name, document_file, document_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        bid_id,
        document_name || files.document[0].originalFilename,
        document_file,
        document_type || 'other',
        payload.empId || payload.id || null,
      ]
    );

    await conn.end();

    return NextResponse.json({
      success: true,
      message: "Document uploaded successfully",
      document_id: result.insertId,
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
