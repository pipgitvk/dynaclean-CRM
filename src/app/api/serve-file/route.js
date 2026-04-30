import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('path');
  
  if (!filePath) {
    return NextResponse.json({ error: 'File path required' }, { status: 400 });
  }
  
  // Security: Only allow files from uploads directory
  if (!filePath.startsWith('/uploads/') || filePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
  }
  
  const fullPath = path.join(process.cwd(), 'public', filePath);
  
  try {
    const fileBuffer = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    
    const contentType = ext === '.pdf' ? 'application/pdf' :
                       ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                       ext === '.png' ? 'image/png' :
                       ext === '.doc' ? 'application/msword' :
                       ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                       'application/octet-stream';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`
      }
    });
  } catch (error) {
    console.error('File serving error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
