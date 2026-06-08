import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request) {
    try {
        // 1. Authorization Check
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let role = null;
        try {
            const { payload } = await jwtVerify(token, secret);
            role = payload.role;
        } catch (err) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        if (!['SUPERADMIN', 'DIRECTOR', 'ADMIN'].includes(String(role).toUpperCase())) {
            return NextResponse.json({ error: 'Forbidden: access denied' }, { status: 403 });
        }

        // 2. Parse Form Data
        const formData = await request.formData();
        
        const item_code = formData.get('item_code');
        const item_name = formData.get('item_name');
        const product_number = formData.get('product_number');
        const min_qty = formData.get('min_qty');
        const price_per_unit = formData.get('price_per_unit');
        const last_negotiation_price = formData.get('last_negotiation_price');
        const specification = formData.get('specification');
        const imageFile = formData.get('image');

        if (!item_code) {
            return NextResponse.json({ error: 'Missing item_code' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Handle image upload if provided
        let imagePath = null;
        if (imageFile && imageFile.size > 0) {
            const uploadDir = path.join(process.cwd(), 'public', 'ADMIN', 'PRODUCTS');
            await fs.mkdir(uploadDir, { recursive: true });

            const ext = path.extname(imageFile.name);
            const safeFilename = `${item_code}_${Date.now()}${ext}`;
            const finalPath = path.join(uploadDir, safeFilename);

            const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
            await fs.writeFile(finalPath, fileBuffer);

            imagePath = `/ADMIN/PRODUCTS/${safeFilename}`;
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (item_name !== null) {
            updates.push('item_name = ?');
            values.push(item_name);
        }
        if (product_number !== null) {
            updates.push('product_number = ?');
            values.push(product_number);
        }
        if (min_qty !== null) {
            updates.push('min_qty = ?');
            values.push(min_qty);
        }
        if (price_per_unit !== null) {
            updates.push('price_per_unit = ?');
            values.push(price_per_unit);
        }
        if (last_negotiation_price !== null) {
            updates.push('last_negotiation_price = ?');
            values.push(last_negotiation_price);
        }
        if (specification !== null) {
            updates.push('specification = ?');
            values.push(specification);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(item_code);

        const query = `UPDATE products_list SET ${updates.join(', ')} WHERE item_code = ?`;
        await db.execute(query, values);

        // Handle image update separately - insert into product_images table
        if (imagePath) {
            // First, delete existing images for this product
            await db.execute('DELETE FROM product_images WHERE item_code = ?', [item_code]);
            
            // Then insert the new image
            await db.execute(
                'INSERT INTO product_images (item_code, image_path) VALUES (?, ?)',
                [item_code, imagePath]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update product:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
