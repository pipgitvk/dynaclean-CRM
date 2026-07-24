import { v2 as cloudinary } from 'cloudinary';
import { NextResponse } from 'next/server';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/cloudinary/delete
 * Deletes a file from Cloudinary
 * 
 * Body:
 * - public_id: string (the public ID of the file to delete)
 */
export async function POST(request) {
  try {
    const { public_id } = await request.json();

    if (!public_id) {
      return NextResponse.json(
        { error: 'No public_id provided' },
        { status: 400 }
      );
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(public_id);

    return NextResponse.json({
      success: result.result === 'ok',
      public_id: public_id,
      result: result.result,
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Delete failed' },
      { status: 500 }
    );
  }
}
