import { getDbConnection } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { service_id, company_cost } = await req.json();

  if (!service_id || !company_cost) {
    return NextResponse.json({ success: false, message: 'Missing required fields.' }, { status: 400 });
  }

  try {
    const conn = await getDbConnection();
    await conn.execute(
      'UPDATE service_records SET company_cost = ? WHERE service_id = ?',
      [company_cost, service_id]
    );
        // await conn.end();

    return NextResponse.json({ success: true, message: 'Record updated successfully.' });
  } catch (error) {
    console.error('DB update error:', error);
    return NextResponse.json({ success: false, message: 'Database update failed.' }, { status: 500 });
  }
}
