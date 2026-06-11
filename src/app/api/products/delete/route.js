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
            return NextResponse.json({ error: 'Forbidden: only super admin can delete products' }, { status: 403 });
        }

        // 2. Parse Request Body
        const { item_code } = await request.json();

        if (!item_code) {
            return NextResponse.json({ error: 'Missing item_code' }, { status: 400 });
        }

        const db = await getDbConnection();

        // 3. Get all images for the product
        const [productImages] = await db.execute('SELECT image_path FROM product_images WHERE item_code = ?', [item_code]);

        // 4. Delete from product_images table
        await db.execute('DELETE FROM product_images WHERE item_code = ?', [item_code]);

        // 5. Delete from products_list table
        await db.execute('DELETE FROM products_list WHERE item_code = ?', [item_code]);

        // 6. Try to delete local image files (if they exist)
        for (const img of productImages) {
            const imagePath = img.image_path;
            if (imagePath && !imagePath.startsWith('http')) {
                try {
                    const fullPath = path.join(process.cwd(), 'public', imagePath);
                    await fs.unlink(fullPath);
                    // Also try to delete the parent directory if it's empty
                    const dirPath = path.dirname(fullPath);
                    try {
                        await fs.rmdir(dirPath);
                    } catch (e) {
                        // Ignore errors (directory might not be empty or not exist)
                    }
                } catch (err) {
                    console.error('Failed to delete image file:', err);
                    // Don't fail the request if file deletion fails
                }
            }
        }

        return NextResponse.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Failed to delete product:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
