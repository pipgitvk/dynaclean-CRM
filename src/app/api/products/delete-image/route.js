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

        if (String(role).toUpperCase() !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Forbidden: only super admin can delete images' }, { status: 403 });
        }

        // 2. Parse Request Body
        const { item_code, image_path } = await request.json();

        if (!item_code || !image_path) {
            return NextResponse.json({ error: 'Missing item_code or image_path' }, { status: 400 });
        }

        const db = await getDbConnection();

        // 3. Delete image from database
        await db.execute('DELETE FROM product_images WHERE item_code = ? AND image_path = ?', [item_code, image_path]);

        // 4. Check if this was the only image, and if so, also update products_list.product_image to null
        const [remainingImages] = await db.execute('SELECT image_path FROM product_images WHERE item_code = ?', [item_code]);
        
        if (remainingImages.length === 0) {
            await db.execute('UPDATE products_list SET product_image = ? WHERE item_code = ?', [null, item_code]);
        } else {
            // If there are remaining images, update product_image to first remaining image
            await db.execute('UPDATE products_list SET product_image = ? WHERE item_code = ?', [remainingImages[0].image_path, item_code]);
        }

        // 5. Delete file from filesystem
        try {
            const filePath = path.join(process.cwd(), 'public', image_path);
            await fs.unlink(filePath);
        } catch (err) {
            console.error('Failed to delete file from filesystem:', err);
            // Don't fail the request if file deletion fails (maybe it was already deleted)
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete image:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
