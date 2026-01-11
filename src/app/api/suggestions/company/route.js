// app/api/suggestions/company/route.js
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
      `SELECT DISTINCT customer_name FROM warranty_products WHERE LOWER(customer_name) LIKE LOWER(?) LIMIT 10`,
      [`%${query}%`]
    );
    return NextResponse.json(rows.map(row => row.customer_name));
  } catch (error) {
    console.error('Error fetching company suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions.' }, { status: 500 });
  } finally {
    console.log(`[GET] DB connection closed`);
    
  }
}