import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { v2 as cloudinary } from "cloudinary";
import {
  ATTACHMENT_DOMAINS,
  ATTENDANCE_REGULARIZATION_SERVICE_ORIGIN,
  getAppCloudinaryCloudName,
  getServiceCloudinaryCloudName,
  normalizeAttachmentPathParam,
} from "@/lib/attachmentPathUtils";

function getCloudinaryCloudNames(relativePath) {
  const serviceCloud = getServiceCloudinaryCloudName();
  const appCloud = getAppCloudinaryCloudName();
  const preferServiceFirst =
    String(relativePath || "").startsWith("attendance_regularization/") ||
    String(relativePath || "").startsWith("uploads/regularization/");

  const ordered = preferServiceFirst
    ? [serviceCloud, appCloud]
    : [appCloud, serviceCloud];

  return [...new Set(ordered.filter(Boolean))];
}

/** DB may store Cloudinary folder path instead of full secure_url. */
function buildCloudinaryCandidateUrls(relativePath, cloudName) {
  if (!cloudName || !relativePath) return [];

  const cleanPath = String(relativePath).replace(/^\/+/, "");
  if (
    !cleanPath.startsWith("attendance_regularization/") &&
    !cleanPath.startsWith("uploads/regularization/")
  ) {
    return [];
  }

  const urls = new Set([
    `https://res.cloudinary.com/${cloudName}/image/upload/${cleanPath}`,
    `https://res.cloudinary.com/${cloudName}/auto/upload/${cleanPath}`,
    `https://res.cloudinary.com/${cloudName}/raw/upload/${cleanPath}`,
    `https://res.cloudinary.com/${cloudName}/image/upload/${encodeUrlPath(cleanPath)}`,
  ]);

  const dot = cleanPath.lastIndexOf(".");
  const publicId = dot > 0 ? cleanPath.slice(0, dot) : cleanPath;
  const format = dot > 0 ? cleanPath.slice(dot + 1) : undefined;

  try {
    urls.add(
      cloudinary.url(publicId, {
        cloud_name: cloudName,
        secure: true,
        resource_type: "auto",
        ...(format ? { format } : {}),
      }),
    );
    urls.add(
      cloudinary.url(publicId, {
        cloud_name: cloudName,
        secure: true,
        resource_type: "image",
        ...(format ? { format } : {}),
      }),
    );
  } catch {
    // ignore URL builder errors
  }

  return [...urls];
}

async function readFromCloudinary(relativePath) {
  for (const cloudName of getCloudinaryCloudNames(relativePath)) {
    for (const url of buildCloudinaryCandidateUrls(relativePath, cloudName)) {
      const result = await readFromRemoteUrl(url);
      if (result) return result;
    }
  }
  return null;
}

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

async function readFromRemoteDomains(relativePath, domains) {
  const pathVariants = new Set([
    `/${relativePath}`,
    `/${encodeUrlPath(relativePath)}`,
  ]);

  for (const candidate of buildLocalCandidates(relativePath)) {
    pathVariants.add(`/${candidate}`);
    pathVariants.add(`/${encodeUrlPath(candidate)}`);
  }

  const apiPathVariants = [...pathVariants].map((pathname) =>
    `/api/serve-attachment?path=${encodeURIComponent(
      pathname.replace(/^\/+/, ""),
    )}`,
  );

  for (const domain of domains) {
    for (const pathname of pathVariants) {
      const result = await readFromRemoteUrl(`${domain}${pathname}`);
      if (result) return result;
    }

    for (const apiPath of apiPathVariants) {
      const result = await readFromRemoteUrl(`${domain}${apiPath}`);
      if (result) return result;
    }
  }

  return null;
}

async function readFromServiceHost(relativePath) {
  return readFromRemoteDomains(relativePath, [
    ATTENDANCE_REGULARIZATION_SERVICE_ORIGIN,
  ]);
}

async function readFromKnownDomains(relativePath) {
  return readFromRemoteDomains(
    relativePath,
    ATTACHMENT_DOMAINS.filter(
      (domain) => domain !== ATTENDANCE_REGULARIZATION_SERVICE_ORIGIN,
    ),
  );
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

  const serviceFile = await readFromServiceHost(relativePath);
  if (serviceFile) return serviceFile;

  const cloudinaryFile = await readFromCloudinary(relativePath);
  if (cloudinaryFile) return cloudinaryFile;

  return readFromKnownDomains(relativePath);
}
