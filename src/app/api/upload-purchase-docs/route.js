import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// POST - Upload a purchase-related document/image
// Field param: eway_bill | product_image | invoice_upload | payment_proof_upload | quotation_upload
export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const formData = await req.formData();
    const file = formData.get("file");
    const fieldName = formData.get("fieldName") || "misc";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Only PDF and image files are allowed" },
        { status: 400 }
      );
    }

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "purchase-docs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Safe file name
    const ext = path.extname(file.name) || ".bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${fieldName}_${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    const publicUrl = `/uploads/purchase-docs/${fileName}`;

    return NextResponse.json({
      success: true,
      data: { url: publicUrl, fileName, fieldName },
    });
  } catch (error) {
    console.error("Error uploading purchase document:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
