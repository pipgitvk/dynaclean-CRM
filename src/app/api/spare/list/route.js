import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDbConnection();
        const [rows] = await db.execute(
            `SELECT s.id, s.spare_number, s.item_name, s.specification, s.type, s.make, s.model,
              s.compatible_machine, s.tax, s.image, s.min_qty, s.purchase_price, s.sale_price,
              s.last_negotiation_price, COALESCE(ss.total_quantity, 0) AS total_qty
             FROM spare_list s
             LEFT JOIN stock_summary ss ON s.id = ss.spare_id
             ORDER BY s.item_name ASC`
        );
        return NextResponse.json(rows, { status: 200 });
    } catch (error) {
        console.error('Failed to fetch spare list:', error);
        return NextResponse.json({ error: 'Failed to fetch spare list' }, { status: 500 });
    }
}
