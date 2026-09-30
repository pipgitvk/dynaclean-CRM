import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// DELETE - Delete a document
export async function DELETE(req, { params }) {
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
    const { bid_id, document_id } = resolvedParams;

    if (!bid_id || !document_id) {
      return NextResponse.json({ error: "Bid ID and Document ID are required" }, { status: 400 });
    }
    const conn = await getDbConnection();
    if (role === "GEM") {
      const [allowedBids] = await conn.execute(
        "SELECT bid_id FROM bids WHERE bid_id = ? AND assigned_employee_id = ?",
        [bid_id, currentEmpId]
      );
      if (allowedBids.length === 0) {
        await conn.end();
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
    }

    // Get document to delete file
    const [documents] = await conn.execute(
      "SELECT document_file FROM bid_documents WHERE document_id = ? AND bid_id = ?",
      [document_id, bid_id]
    );

    if (documents.length === 0) {
      await conn.end();
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete file
    const documentFile = documents[0].document_file;
    if (documentFile) {
      if (documentFile.includes("cloudinary.com")) {
        // Extract public ID from Cloudinary URL
        try {
          const urlObj = new URL(documentFile);
          const pathname = urlObj.pathname;
          const parts = pathname.split('/');
          const versionIndex = parts.findIndex(p => p.startsWith('v'));
          if (versionIndex !== -1 && versionIndex < parts.length - 1) {
            const publicIdWithFolder = parts.slice(versionIndex + 1).join('/').replace(/\.[^/.]+$/, "");
            await cloudinary.uploader.destroy(publicIdWithFolder, { resource_type: "auto" });
            console.log("✅ Deleted document from Cloudinary:", publicIdWithFolder);
          }
        } catch (err) {
          console.error("Failed to delete from Cloudinary:", err);
        }
      } else if (documentFile.startsWith("/uploads/")) {
        // Delete local file
        const filePath = path.join(process.cwd(), "public", documentFile);
        await fs.unlink(filePath).catch(() => {
          console.error("Failed to delete file:", filePath);
        });
      }
    }

    // Delete from database
    await conn.execute(
      "DELETE FROM bid_documents WHERE document_id = ? AND bid_id = ?",
      [document_id, bid_id]
    );

    await conn.end();

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
