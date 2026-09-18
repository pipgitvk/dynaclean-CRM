import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png"]);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function mimeFromFilename(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function savePdfLocally(file) {
  const uploadDir = path.join(process.cwd(), "public", "Order", "accounts");
  ensureDir(uploadDir);

  const ext = path.extname(file.originalFilename || "") || ".pdf";
  const uniqueName = `${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}${ext}`;
  const destPath = path.join(uploadDir, uniqueName);

  await fs.promises.copyFile(file.filepath, destPath);
  return `/Order/accounts/${uniqueName}`;
}

async function uploadImageToCloudinary(file) {
  const buffer = await fs.promises.readFile(file.filepath);
  const mime = mimeFromFilename(file.originalFilename);
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "order_accounts",
    resource_type: "image",
  });

  return result.secure_url;
}

/**
 * PDF → local disk, images → Cloudinary.
 */
export async function uploadOrderAccountFile(file) {
  if (!file?.filepath) throw new Error("Missing file");

  const ext = path.extname(file.originalFilename || "").toLowerCase();

  if (ext === ".pdf") {
    return savePdfLocally(file);
  }
  if (IMAGE_EXT.has(ext)) {
    return uploadImageToCloudinary(file);
  }

  throw new Error(`Unsupported file type: ${ext || "unknown"}`);
}
