import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function safeFolderSegment(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 80);
}

async function uploadOne(file, serialNumber) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0) {
    return null;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const fileName = String(file.name || "").toLowerCase();
  const isPdf =
    mime === "application/pdf" || fileName.endsWith(".pdf");

  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  const folder = `warranty_complaints/${safeFolderSegment(serialNumber)}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: isPdf ? "image" : "auto",
    access_mode: "public",
  });

  return result.secure_url || result.url || null;
}

/** Upload complaint attachments to Cloudinary; returns secure URLs in order. */
export async function uploadComplaintAttachmentsToCloudinary(
  files,
  serialNumber,
) {
  const list = Array.isArray(files) ? files : [];
  const urls = [];
  for (const file of list) {
    try {
      const url = await uploadOne(file, serialNumber);
      if (url) urls.push(url);
    } catch (e) {
      console.error("uploadComplaintAttachmentsToCloudinary:", e);
    }
  }
  return urls;
}
