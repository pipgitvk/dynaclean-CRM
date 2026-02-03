import fs from "fs";
import path from "path";
import sharp from "sharp";
import mime from "mime-types";
import { fileTypeFromBuffer } from "file-type";
import { v4 as uuidv4 } from "uuid";

/* ================= UPLOAD ================= */

export const uploadImage = async (file, subfolder = "all") => {
  const uploadsDir = path.join(process.cwd(), "uploads", subfolder);

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const detectedType = await fileTypeFromBuffer(file.data);
  const mimeType = detectedType?.mime || file.mimetype;

  const uniqueName = uuidv4();
  let fileName;
  let outputPath;

  if (mimeType?.startsWith("image/")) {
    fileName = `${uniqueName}.webp`;
    outputPath = path.join(uploadsDir, fileName);

    await sharp(file.data)
      .webp({ quality: 75 })
      .toFile(outputPath);
  } else {
    const ext = path.extname(file.name);
    fileName = `${uniqueName}${ext}`;
    outputPath = path.join(uploadsDir, fileName);

    await fs.promises.writeFile(outputPath, file.data);
  }

  return `/api/image/${subfolder}/${fileName}`;
};


// get img

export const findImage = async (req, res, fullPath) => {
  try {
    const baseDir = path.join(process.cwd(), "uploads");

    const parts = fullPath.split("/");
    const fileName = parts.pop();
    const subfolder = parts.join("/") || "";

    const resolvedPath = path.resolve(baseDir, subfolder, fileName);

    // 🔐 SECURITY CHECK
    if (!resolvedPath.startsWith(baseDir)) {
      return res.status(403).send("Forbidden");
    }

    let filePath = resolvedPath;

    if (!fs.existsSync(filePath)) {
      filePath = path.join(baseDir, "banner.webp");
    }

    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const width = req.query.w ? Number(req.query.w) : null;
    const quality = req.query.q ? Number(req.query.q) : 75;

    if (mimeType.startsWith("image/") && (width || quality !== 75)) {
      let image = sharp(filePath);

      if (width) image.resize({ width });

      image = image.webp({ quality });
      res.setHeader("Content-Type", "image/webp");

      const buffer = await image.toBuffer();
      return res.send(buffer);
    }

    const buffer = await fs.promises.readFile(filePath);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Image error");
  }
};
