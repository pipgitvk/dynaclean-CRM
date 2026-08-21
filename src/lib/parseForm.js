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

export async function parseFormData(request, options = {}) {
  const nodeReq = toNodeRequest(request);
  const allowedExt = new Set(options.allowedExt || ALLOWED_EXT);
  const allowedMime = new Set(options.allowedMime || ALLOWED_MIME);
  const multiples = options.multiples === true;

  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      multiples,
      maxFileSize: MAX_FILE_SIZE,
      maxTotalFileSize: options.maxTotalFileSize || (multiples ? MAX_FILE_SIZE * 5 : MAX_FILE_SIZE),
      uploadDir: UPLOAD_ROOT,
      keepExtensions: false,

      /**
       * SAFE filename generator
       */
      filename: (name, ext, part) => {
        const cleanExt = path
          .extname(part.originalFilename || "")
          .toLowerCase();

        if (!allowedExt.has(cleanExt)) {
          throw new Error("Invalid file extension");
        }

        return crypto.randomUUID() + cleanExt;
      },

      /**
       * HARD validation
       */
      filter: ({ mimetype, originalFilename }) => {
        const ext = path.extname(originalFilename || "").toLowerCase();

        if (!allowedExt.has(ext)) return false;
        if (!mimetype) return true;
        if (allowedMime.has(mimetype) || mimetype === "application/octet-stream") return true;

        return false;
      },
    });

    form.parse(nodeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}
