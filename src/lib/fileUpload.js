import path from "path";
import fs from "fs/promises";

export async function uploadFiles(files, folder = "uploads") {
  const uploadDir = path.join(process.cwd(), "public", folder);
  
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    console.error("Error creating upload directory:", error);
  }

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
      const filepath = path.join(uploadDir, filename);

      await fs.writeFile(filepath, buffer);
      filenames.push(filename);
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);
      throw error;
    }
  }

  return filenames;
}
