import { NextResponse } from "next/server";
import { parseFormData } from "@/lib/parseFormData";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Normalize file input
const getFile = (f) => (Array.isArray(f) ? f[0] : f);

// Upload file to Cloudinary
async function uploadToCloudinary(file, folder) {
  if (!file || !file.filepath) throw new Error("Missing file");

  const buffer = fs.readFileSync(file.filepath);
  const fileName = file.originalFilename || file.newFilename || "";
  const mimeType = file.mimetype || "";
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  
  const upload = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { 
        folder: `dd-management/${folder}`,
        resource_type: isPdf ? "raw" : "auto"
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
      uploadedPaths.cheque_upload = await uploadToCloudinary(
        getFile(files.cheque_upload),
        "cheques"
      );
    }
    if (files.signature_upload) {
      uploadedPaths.signature_upload = await uploadToCloudinary(
        getFile(files.signature_upload),
        "signatures"
      );
    }
    if (files.dd_upload) {
      uploadedPaths.dd_upload = await uploadToCloudinary(
        getFile(files.dd_upload),
        "issued-dds"
      );
    }
    if (files.bg_format_upload) {
      uploadedPaths.bg_format_upload = await uploadToCloudinary(
        getFile(files.bg_format_upload),
        "bg-formats"
      );
    }
    if (files.original_bg_upload) {
      uploadedPaths.original_bg_upload = await uploadToCloudinary(
        getFile(files.original_bg_upload),
        "original-bgs"
      );
    }
    if (files.docs_upload) {
      uploadedPaths.docs_upload = await uploadToCloudinary(
        getFile(files.docs_upload),
        "bg-docs"
      );
    }
    if (files.bg_scan_copy) {
      uploadedPaths.bg_scan_copy = await uploadToCloudinary(
        getFile(files.bg_scan_copy),
        "bg-scan-copies"
      );
    }
    if (files.payment_proof) {
      uploadedPaths.payment_proof = await uploadToCloudinary(
        getFile(files.payment_proof),
        "payment-proofs"
      );
    }
    if (files.receipt) {
      uploadedPaths.receipt = await uploadToCloudinary(
        getFile(files.receipt),
        "receipts"
      );
    }
    if (files.bid_document) {
      uploadedPaths.bid_document = await uploadToCloudinary(
        getFile(files.bid_document),
        "bid-documents"
      );
    }
    if (files.dd_scan_copy) {
      uploadedPaths.dd_scan_copy = await uploadToCloudinary(
        getFile(files.dd_scan_copy),
        "dd-scan-copies"
      );
    }
    if (files.dd_receipt) {
      uploadedPaths.dd_receipt = await uploadToCloudinary(
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
