import { writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('installationFile');
    const serviceId = formData.get('service_id');

    if (!file || typeof file === 'string' || !serviceId) {
      return NextResponse.json({ success: false, message: 'Missing file or service ID' }, { status: 400 });
    }

    // Save file to public/attachments/
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    const uploadDir = path.join(process.cwd(), 'public', 'attachments');
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    // Save filename to service_records table
    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `UPDATE service_records SET installation_report = ? WHERE service_id = ?`,
      [fileName, serviceId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Invalid service ID' }, { status: 404 });
    }

    // Also insert service_id into service_reports table
    await conn.execute(
      `INSERT INTO service_reports (service_id) VALUES (?)`,
      [serviceId]
    );

    return NextResponse.json({ success: true, fileName });
  } catch (error) {
    console.error('[Upload Installation Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
