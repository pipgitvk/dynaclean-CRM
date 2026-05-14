import { NextResponse } from "next/server";
import { parseFormData } from "@/lib/parseFormData";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Normalize file input
const getFile = (f) => (Array.isArray(f) ? f[0] : f);

function isPdfFile(file) {
  const fileName = file.originalFilename || file.newFilename || "";
  const mimeType = file.mimetype || "";
  return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

function safeFileName(fileName) {
  const ext = path.extname(fileName || "");
  const baseName = path.basename(fileName || "document", ext);
  return `${Date.now()}-${baseName.replace(/[^a-zA-Z0-9-_]/g, "-")}${ext || ".pdf"}`;
}

async function savePdfLocally(file, folder) {
  const fileName = safeFileName(file.originalFilename || file.newFilename);
  const relativeDir = `/uploads/dd-management/${folder}`;
  const uploadDir = path.join(process.cwd(), "public", relativeDir);
  const destination = path.join(uploadDir, fileName);

  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.copyFile(file.filepath, destination);

  return `${relativeDir}/${fileName}`;
}

// Upload images and other files to Cloudinary, but save PDFs locally
async function uploadFile(file, folder) {
  if (!file || !file.filepath) throw new Error("Missing file");

  if (isPdfFile(file)) {
    return savePdfLocally(file, folder);
  }

  const buffer = fs.readFileSync(file.filepath);
  
  const upload = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { 
        folder: `dd-management/${folder}`,
        resource_type: "auto"
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    ).end(buffer);
  });

  return upload;
}

export async function POST(req) {
  try {
    const { files } = await parseFormData(req);

    const uploadedPaths = {};

    if (files.cheque_upload) {
      uploadedPaths.cheque_upload = await uploadFile(
        getFile(files.cheque_upload),
        "cheques"
      );
    }
    if (files.signature_upload) {
      uploadedPaths.signature_upload = await uploadFile(
        getFile(files.signature_upload),
        "signatures"
      );
    }
    if (files.dd_upload) {
      uploadedPaths.dd_upload = await uploadFile(
        getFile(files.dd_upload),
        "issued-dds"
      );
    }
    if (files.bg_format_upload) {
      uploadedPaths.bg_format_upload = await uploadFile(
        getFile(files.bg_format_upload),
        "bg-formats"
      );
    }
    if (files.original_bg_upload) {
      uploadedPaths.original_bg_upload = await uploadFile(
        getFile(files.original_bg_upload),
        "original-bgs"
      );
    }
    if (files.docs_upload) {
      uploadedPaths.docs_upload = await uploadFile(
        getFile(files.docs_upload),
        "bg-docs"
      );
    }
    if (files.bg_scan_copy) {
      uploadedPaths.bg_scan_copy = await uploadFile(
        getFile(files.bg_scan_copy),
        "bg-scan-copies"
      );
    }
    if (files.payment_proof) {
      uploadedPaths.payment_proof = await uploadFile(
        getFile(files.payment_proof),
        "payment-proofs"
      );
    }
    if (files.receipt) {
      uploadedPaths.receipt = await uploadFile(
        getFile(files.receipt),
        "receipts"
      );
    }
    if (files.bid_document) {
      uploadedPaths.bid_document = await uploadFile(
        getFile(files.bid_document),
        "bid-documents"
      );
    }
    if (files.dd_scan_copy) {
      uploadedPaths.dd_scan_copy = await uploadFile(
        getFile(files.dd_scan_copy),
        "dd-scan-copies"
      );
    }
    if (files.dd_receipt) {
      uploadedPaths.dd_receipt = await uploadFile(
        getFile(files.dd_receipt),
        "dd-receipts"
      );
    }

    return NextResponse.json({ success: true, paths: uploadedPaths });
  } catch (error) {
    console.error("❌ DD Upload Error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
