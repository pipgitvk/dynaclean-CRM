import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadAttendanceRegularizationAttachment(file, username) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime =
    typeof file.type === "string" && file.type
      ? file.type
      : "application/octet-stream";
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  const userFolder = String(username).replace(/[^a-zA-Z0-9._-]/g, "_");

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `attendance_regularization/${userFolder}`,
    resource_type: "auto",
  });

  return result.secure_url;
}
