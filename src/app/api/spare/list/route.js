import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDbConnection();
        const [rows] = await db.execute(
            'SELECT id, spare_number, item_name, specification, image, min_qty, price, last_negotiation_price FROM spare_list ORDER BY item_name ASC'
        );
        return NextResponse.json(rows, { status: 200 });
    } catch (error) {
        console.error('Failed to fetch spare list:', error);
        return NextResponse.json({ error: 'Failed to fetch spare list' }, { status: 500 });
    }
}
