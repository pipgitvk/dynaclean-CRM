import path from "path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

function mimeFromFile(file, originalName) {
  if (typeof file?.type === "string" && file.type) return file.type;
  const ext = path.extname(originalName || "").toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

export function isAllowedProspectUpload(file, originalName) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(originalName || file?.name || "").toLowerCase();
  const ext = path.extname(name).toLowerCase();

  const isPdf = mime === "application/pdf" || ext === ".pdf";
  const isImage =
    mime.startsWith("image/") || IMAGE_EXT.has(ext);

  return isPdf || isImage;
}

/**
 * Upload prospect PDF/image to Cloudinary.
 * Images → resource_type image; PDFs → raw.
 * @returns {Promise<{ url: string, originalName: string, resourceType: string }>}
 */
export async function uploadProspectSubmissionFile(file, username) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  const originalName = String(file?.name || "prospect-file");
  if (!isAllowedProspectUpload(file, originalName)) {
    throw new Error("Only PDF or image files are allowed.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = mimeFromFile(file, originalName);
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  const userFolder = String(username || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = path.extname(originalName).toLowerCase();
  const isPdf = mime === "application/pdf" || ext === ".pdf";
  const resourceType = isPdf ? "raw" : "image";
  const safeBase = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80) || "prospect";

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `crm/prospect_submissions/${userFolder}`,
    public_id: `${safeBase}_${Date.now()}`,
    resource_type: resourceType,
    overwrite: false,
  });

  return {
    url: result.secure_url,
    originalName,
    resourceType,
  };
}
