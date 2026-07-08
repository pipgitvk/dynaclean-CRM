import path from "path";
import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";

// Check if Cloudinary is configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const PDF_EXTENSIONS = [".pdf"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic", ".heif"];

function isPdf(filename) {
  return PDF_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function isImage(filename) {
  return IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

async function saveLocally(file, buffer, folder, filename) {
  const uploadDir = path.join(process.cwd(), "public", folder);
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    console.error("Error creating upload directory:", err);
  }
  const filepath = path.join(uploadDir, filename);
  await fs.writeFile(filepath, buffer);
  // Return relative path for DB storage
  return `/${folder}/${filename}`;
}

async function saveToCloudinary(file, buffer, folder, filename) {
  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;
  const publicId = filename.replace(/\.[^/.]+$/, ""); // strip extension

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `crm/${folder}`,
    public_id: publicId,
    resource_type: "auto",
    overwrite: false,
  });

  return result.secure_url;
}

export async function uploadFiles(files, folder = "uploads") {
  const results = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const ext = path.extname(file.name);
      const basename = path.basename(file.name, ext);
      const filename = `${basename}_${timestamp}_${random}${ext}`;

      let storedPath;

      if (isPdf(file.name)) {
        // PDFs → always save locally
        storedPath = await saveLocally(file, buffer, folder, filename);
        console.log(`[fileUpload] PDF saved locally: ${storedPath}`);
      } else if (isImage(file.name) && isCloudinaryConfigured) {
        // Images → Cloudinary if configured
        storedPath = await saveToCloudinary(file, buffer, folder, filename);
        console.log(`[fileUpload] Image uploaded to Cloudinary: ${storedPath}`);
      } else {
        // Fallback → local
        storedPath = await saveLocally(file, buffer, folder, filename);
        console.log(`[fileUpload] File saved locally (fallback): ${storedPath}`);
      }

      results.push(storedPath);
    } catch (error) {
      console.error(`[fileUpload] Error uploading file ${file.name}:`, error);
      throw error;
    }
  }

  return results;
}
