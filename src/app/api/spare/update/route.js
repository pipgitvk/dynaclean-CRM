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

        if (!['SUPERADMIN', 'DIRECTOR', 'ADMIN', 'DIGITAL MARKETER', 'WAREHOUSE INCHARGE', 'ACCOUNTANT'].includes(String(role).toUpperCase())) {
            return NextResponse.json({ error: 'Forbidden: access denied' }, { status: 403 });
        }

        // 2. Parse Form Data
        const formData = await request.formData();
        
        const id = formData.get('id');
        const spare_number = formData.get('spare_number');
        const item_name = formData.get('item_name');
        const min_qty = formData.get('min_qty');
        const price = formData.get('price');
        const last_negotiation_price = formData.get('last_negotiation_price');
        const specification = formData.get('specification');
        const imageFile = formData.get('image');

        if (!id) {
            return NextResponse.json({ error: 'Missing spare id' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Get current spare details to know existing image and item_name for directory structure
        const [currentSpare] = await db.execute('SELECT * FROM spare_list WHERE id = ? LIMIT 1', [id]);
        if (currentSpare.length === 0) {
            return NextResponse.json({ error: 'Spare not found' }, { status: 404 });
        }
        const existingSpare = currentSpare[0];

        // Handle image upload if provided
        let imagePath = existingSpare.image; // Keep existing image by default
        if (imageFile && imageFile.size > 0) {
            const itemNameForDir = item_name || existingSpare.item_name;
            const uploadDir = path.join(process.cwd(), 'public', 'spare_files', itemNameForDir);
            await fs.mkdir(uploadDir, { recursive: true });

            const fileName = `image_${Date.now()}-${imageFile.name.replace(/ /g, '_')}`;
            const finalPath = path.join(uploadDir, fileName);

            const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
            await fs.writeFile(finalPath, fileBuffer);

            imagePath = `/spare_files/${itemNameForDir}/${fileName}`;
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (spare_number !== null) {
            updates.push('spare_number = ?');
            values.push(spare_number);
        }
        if (item_name !== null) {
            updates.push('item_name = ?');
            values.push(item_name);
        }
        if (min_qty !== null) {
            updates.push('min_qty = ?');
            values.push(min_qty);
        }
        if (price !== null) {
            updates.push('price = ?');
            values.push(price);
        }
        if (last_negotiation_price !== null) {
            updates.push('last_negotiation_price = ?');
            values.push(last_negotiation_price);
        }
        if (specification !== null) {
            updates.push('specification = ?');
            values.push(specification);
        }
        if (imagePath && imagePath !== existingSpare.image) {
            updates.push('image = ?');
            values.push(imagePath);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(id);

        const query = `UPDATE spare_list SET ${updates.join(', ')} WHERE id = ?`;
        await db.execute(query, values);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update spare:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
