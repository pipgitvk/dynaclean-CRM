import { writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Save file to public/asset_attachments/
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `delivery-proof-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'asset_attachments');
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    // Return the public URL path
    const url = `/asset_attachments/${fileName}`;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error('[Upload Delivery Proof Error]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
