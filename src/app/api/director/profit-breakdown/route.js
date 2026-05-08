import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getSessionPayload } from '@/lib/auth';

export async function GET(request) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (payload?.role || '').toUpperCase();
  if (role !== 'DIRECTOR' && role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM format

  if (!month) {
    return NextResponse.json({ error: 'Month parameter required' }, { status: 400 });
  }

  const connection = await getDbConnection();

  try {
    // Calculate date range for the selected month
    const startDate = `${month}-01`;
    const [year, monthNum] = month.split('-');
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${lastDay}`;

    // Fetch profit breakdown by item
    const [rows] = await connection.execute(
      `SELECT 
        p.item_code as item,
        p.purchase_price as purchasePrice,
        p.sale_price as salePrice,
        SUM(o.quantity) as qty,
        SUM(p.purchase_price * o.quantity) as totalPurchase,
        SUM(p.sale_price * o.quantity) as totalSale,
        SUM((p.sale_price - p.purchase_price) * o.quantity) as profit
      FROM order_items o
      JOIN products p ON o.product_id = p.id
      JOIN orders ord ON o.order_id = ord.id
      WHERE DATE(ord.created_at) BETWEEN ? AND ?
      GROUP BY p.item_code, p.purchase_price, p.sale_price
      ORDER BY profit DESC`,
      [startDate, endDate]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching profit breakdown:', error);
    return NextResponse.json({ error: 'Failed to fetch profit breakdown' }, { status: 500 });
  }
}
