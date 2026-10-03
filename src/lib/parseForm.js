// lib/parseFormData.js
import { IncomingForm } from "formidable";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * ABSOLUTE upload jail (outside app directory)
 * Must be mounted with noexec
 */
const UPLOAD_ROOT = "/var/uploads/tmp";

// Ensure directory exists
fs.mkdirSync(UPLOAD_ROOT, { recursive: true, mode: 0o755 });

// Allowed types
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".pdf"]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Convert Web Request → Node stream
function toNodeRequest(request) {
  const reader = request.body.getReader();

  const stream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) this.push(null);
      else this.push(value);
    },
  });

  return Object.assign(stream, {
    headers: Object.fromEntries(request.headers),
    method: request.method,
    url: request.url,
  });
}

export async function parseFormData(request) {
  const nodeReq = toNodeRequest(request);

  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      multiples: false,
      maxFileSize: MAX_FILE_SIZE,
      uploadDir: UPLOAD_ROOT,
      keepExtensions: false,

      /**
       * SAFE filename generator
       */
      filename: (name, ext, part) => {
        const cleanExt = path
          .extname(part.originalFilename || "")
          .toLowerCase();

        if (!ALLOWED_EXT.has(cleanExt)) {
          throw new Error("Invalid file extension");
        }

        return crypto.randomUUID() + cleanExt;
      },

      /**
       * HARD validation
       */
      filter: ({ mimetype, originalFilename }) => {
        const ext = path.extname(originalFilename || "").toLowerCase();

        if (!ALLOWED_MIME.has(mimetype)) return false;
        if (!ALLOWED_EXT.has(ext)) return false;

        return true;
      },
    });

    form.parse(nodeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}
