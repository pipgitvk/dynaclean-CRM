import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
    try {
        const db = await getDbConnection();
        
        // First, get all products
        const [products] = await db.execute(
            `SELECT 
            p.id,
         p.item_code,
         p.item_name,
         p.product_image,
         p.product_number,
         p.min_qty,
         p.price_per_unit,
         p.gem_price,
         p.specification,
         p.last_negotiation_price,
         p.gst_rate
       FROM products_list p
       ORDER BY p.item_name ASC`
        );

        // Then, get all images for all products
        const [images] = await db.execute(
            `SELECT item_code, image_path FROM product_images`
        );

        // Map images to their respective products
        const productsWithImages = products.map(product => {
            const productImages = images
                .filter(img => img.item_code === product.item_code)
                .map(img => img.image_path);
            return {
                ...product,
                images: productImages,
                image_path: productImages[0] || null
            };
        });

        return NextResponse.json(productsWithImages, { status: 200 });
    } catch (error) {
        console.error('Failed to fetch products list:', error);
        return NextResponse.json({ error: 'Failed to fetch products list' }, { status: 500 });
    }
}
