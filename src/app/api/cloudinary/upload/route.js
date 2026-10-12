import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/cloudinary/upload
 * Uploads a file to Cloudinary
 * 
 * Form data:
 * - file: File object
 * - folder: string (Cloudinary folder path)
 * - public_id: string (optional, custom public ID)
 * - tags: string (optional, comma-separated tags)
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'emp_profiles/documents';
    const publicId = formData.get('public_id');
    const tags = formData.get('tags');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = String(file.name || "");
    const isPdf =
      String(file.type || "").toLowerCase() === "application/pdf" ||
      fileName.toLowerCase().endsWith(".pdf");

    // Cloudinary stores PDFs as images so the browser can open them.
    // Raw PDFs are served as a blocked/empty response and Chrome shows
    // "Failed to load PDF document".
    const uploadOptions = {
      folder: folder,
      resource_type: isPdf ? "image" : "auto",
      access_mode: "public",
    };

    if (publicId) {
      uploadOptions.public_id = String(publicId).replace(/\.pdf$/i, "");
    }

    if (tags) {
      uploadOptions.tags = tags.split(',').map(t => t.trim());
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      size: result.bytes,
      format: result.format,
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
