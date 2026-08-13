import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    const pool = await getDbConnection();

    // Search in both products_list and spare_list tables
    const [products] = await pool.execute(`
      SELECT 
        item_name as name,
        'product' as type,
        item_code as code,
        id
      FROM products_list 
      WHERE item_name LIKE ? OR item_code LIKE ?
      ORDER BY item_name ASC
      LIMIT ?
    `, [`%${query}%`, `%${query}%`, limit]);

    const [spares] = await pool.execute(`
      SELECT 
        item_name as name,
        'spare' as type,
        spare_number as code,
        id
      FROM spare_list 
      WHERE item_name LIKE ? OR spare_number LIKE ?
      ORDER BY item_name ASC
      LIMIT ?
    `, [`%${query}%`, `%${query}%`, limit]);

    // Combine results
    const combinedResults = [
      ...products.map(p => ({ 
        ...p, 
        displayName: `${p.name} (Product)`,
        fullName: p.name,
        code: p.code 
      })),
      ...spares.map(s => ({ 
        ...s, 
        displayName: `${s.name} (Spare)`,
        fullName: s.name,
        code: s.code 
      }))
    ].slice(0, limit);

    return NextResponse.json({
      success: true,
      data: combinedResults
    });

  } catch (error) {
    console.error('Error searching products and spares:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to search products and spares'
    }, { status: 500 });
  }
}