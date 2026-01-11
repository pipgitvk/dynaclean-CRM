// app/api/suggestions/assigned-to/route.js
import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || '';

  if (!query) {
    return NextResponse.json([]);
  }

  let conn;
  try {
    conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT DISTINCT assigned_to FROM service_records WHERE LOWER(assigned_to) LIKE LOWER(?) AND assigned_to IS NOT NULL AND assigned_to != '' LIMIT 10`,
      [`%${query}%`]
    );
    return NextResponse.json(rows.map(row => row.assigned_to));
  } catch (error) {
    console.error('Error fetching assigned to suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions.' }, { status: 500 });
  } finally {
    console.log(`[GET] DB connection closed`);
    
  }
}