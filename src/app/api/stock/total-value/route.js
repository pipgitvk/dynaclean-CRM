import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDbConnection();
        const [rows] = await db.execute(
            `SELECT 
                SUM(quantity) as totalQty,
                SUM(quantity * amount_per_unit) as totalValue
            FROM product_stock`
        );
        return NextResponse.json({
            totalQty: rows[0].totalQty || 0,
            totalValue: rows[0].totalValue || 0
        }, { status: 200 });
    } catch (error) {
        console.error('Failed to fetch product stock totals:', error);
        return NextResponse.json({ error: 'Failed to fetch product stock totals' }, { status: 500 });
    }
}
