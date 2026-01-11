import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDbConnection();
        const [rows] = await db.execute(
            `SELECT 
         p.item_code,
         p.item_name,
         p.product_image,
         p.product_number,
         p.min_qty,
         p.price_per_unit,
         p.specification,
         p.last_negotiation_price,
         COALESCE(pi.image_path, NULL) AS image_path
       FROM products_list p
       LEFT JOIN (
         SELECT item_code, MIN(image_path) AS image_path
         FROM product_images
         GROUP BY item_code
       ) pi ON pi.item_code = p.item_code
       GROUP BY p.item_code, p.item_name, p.product_image, p.product_number, p.min_qty, p.price_per_unit, p.specification, p.last_negotiation_price, pi.image_path
       ORDER BY p.item_name ASC`
        );
        return NextResponse.json(rows, { status: 200 });
    } catch (error) {
        console.error('Failed to fetch products list:', error);
        return NextResponse.json({ error: 'Failed to fetch products list' }, { status: 500 });
    }
}
