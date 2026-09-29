import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_DIR = path.join(process.cwd(), "public", "payment_invoices");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"]);

function isPdfFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

function cloudinaryPublicId(url) {
  const pathname = new URL(url).pathname;
  const marker = "/upload/";
  const index = pathname.indexOf(marker);
  if (index === -1) return null;
  const rest = pathname.slice(index + marker.length).replace(/^v\d+\//, "");
  return rest.replace(/\.[^/.]+$/, "") || null;
}

async function uploadPdfToCloudinary(buffer) {
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "payment_invoices",
        resource_type: "image",
        access_mode: "public",
      },
      (error, uploaded) => {
        if (error) reject(error);
        else resolve(uploaded);
      },
    );
    stream.end(buffer);
  });

  return result.secure_url;
}

async function saveImageLocally(file, buffer) {
  const ext = path.extname(file.name || "").toLowerCase();
  if (!IMAGE_EXT.has(ext)) {
    throw new Error("Only PDF, JPG, and PNG files are allowed");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `invoice_${Date.now()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return `/payment_invoices/${fileName}`;
}

export async function saveManualPaymentInvoice(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (isPdfFile(file)) {
    return uploadPdfToCloudinary(buffer);
  }
  return saveImageLocally(file, buffer);
}

export async function deleteManualPaymentInvoice(storedPath) {
  if (!storedPath) return;

  const value = String(storedPath);
  if (value.includes("res.cloudinary.com")) {
    try {
      const publicId = cloudinaryPublicId(value);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      }
    } catch (error) {
      console.error("Error deleting invoice from Cloudinary:", error);
    }
    return;
  }

  try {
    const relative = value.replace(/^\/+/, "");
    const oldFilePath = path.join(process.cwd(), "public", relative);
    if (fs.existsSync(oldFilePath)) {
      await unlink(oldFilePath);
    }
  } catch (error) {
    console.error("Error deleting local invoice:", error);
  }
}
