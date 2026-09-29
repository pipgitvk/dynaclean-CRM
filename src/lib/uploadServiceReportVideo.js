import { v2 as cloudinary } from "cloudinary";

function ensureCloudinaryConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export function isServiceVideoCloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export async function uploadServiceReportVideo(buffer, serviceId, step) {
  if (!isServiceVideoCloudinaryEnabled()) {
    throw new Error("Cloudinary is not configured.");
  }
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `service_report_videos/${serviceId}`,
        public_id: `${step}-${Date.now()}`,
        resource_type: "video",
        overwrite: false,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Cloudinary did not return a video URL."));
        } else {
          resolve(result.secure_url);
        }
      },
    );
    stream.end(buffer);
  });
}
