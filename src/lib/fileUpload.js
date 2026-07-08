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

export async function uploadFiles(files, folder = "uploads") {
  const filenames = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const ext = path.extname(file.name);
      const basename = path.basename(file.name, ext);
      const filename = `${basename}_${timestamp}_${random}${ext}`;

      // Upload to Cloudinary if configured
      if (isCloudinaryConfigured) {
        const base64 = buffer.toString("base64");
        const dataUri = `data:${file.type};base64,${base64}`;

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: `crm/${folder}`,
          public_id: filename.replace(/\.[^/.]+$/, ""), // Remove extension for public_id
          resource_type: "auto",
          overwrite: false,
        });

        filenames.push(uploadResult.secure_url);
      } else {
        // Fallback to local storage if Cloudinary is not configured
        const uploadDir = path.join(process.cwd(), "public", folder);
        
        try {
          await fs.mkdir(uploadDir, { recursive: true });
        } catch (error) {
          console.error("Error creating upload directory:", error);
        }

        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, buffer);
        filenames.push(filename);
      }
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      throw error;
    }
  }

  return filenames;
}
