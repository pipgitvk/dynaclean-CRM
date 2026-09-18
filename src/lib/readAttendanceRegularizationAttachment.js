import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  ATTACHMENT_DOMAINS,
  normalizeAttachmentPathParam,
} from "@/lib/attachmentPathUtils";

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

function guessMimeFromName(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function encodeUrlPath(pathname) {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeRelativePath(input) {
  let value = normalizeAttachmentPathParam(input);
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  const cleaned = value.replace(/^\/public\//, "").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..")) return null;
  if (
    !cleaned.startsWith("attendance_regularization/") &&
    !cleaned.startsWith("uploads/regularization/")
  ) {
    return null;
  }

  return cleaned;
}

function buildLocalCandidates(relativePath) {
  const candidates = new Set([relativePath]);

  try {
    candidates.add(decodeURIComponent(relativePath));
  } catch {}

  const decodedSegments = relativePath
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
  candidates.add(decodedSegments);

  return [...candidates];
}

async function readFromLocalDisk(relativePath) {
  for (const candidate of buildLocalCandidates(relativePath)) {
    const fullPath = join(process.cwd(), "public", candidate);
    if (!existsSync(fullPath)) continue;

    const buffer = await readFile(fullPath);
    return {
      buffer,
      contentType: guessMimeFromName(candidate),
      filename: candidate.split("/").pop() || "attachment",
    };
  }

  return null;
}

async function readFromRemoteUrl(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type") || guessMimeFromName(url);

    return {
      buffer,
      contentType,
      filename: url.split("/").pop()?.split("?")[0] || "attachment",
    };
  } catch {
    return null;
  }
}

async function readFromKnownDomains(relativePath) {
  const pathVariants = new Set([
    `/${relativePath}`,
    `/${encodeUrlPath(relativePath)}`,
  ]);

  for (const candidate of buildLocalCandidates(relativePath)) {
    pathVariants.add(`/${candidate}`);
    pathVariants.add(`/${encodeUrlPath(candidate)}`);
  }

  for (const domain of ATTACHMENT_DOMAINS) {
    for (const pathname of pathVariants) {
      const result = await readFromRemoteUrl(`${domain}${pathname}`);
      if (result) return result;
    }
  }

  return null;
}

export async function readAttendanceRegularizationAttachment(attachmentUrl) {
  if (!attachmentUrl || typeof attachmentUrl !== "string") return null;

  const trimmed = attachmentUrl.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return readFromRemoteUrl(trimmed);
  }

  const relativePath = normalizeRelativePath(trimmed);
  if (!relativePath) return null;

  const local = await readFromLocalDisk(relativePath);
  if (local) return local;

  return readFromKnownDomains(relativePath);
}
