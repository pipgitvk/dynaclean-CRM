import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import heicConvert from 'heic-convert';
import { v2 as cloudinary } from 'cloudinary';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * Cloudinary when creds exist and either:
 * - NODE_ENV=production (real production deploy), or
 * - SPARE_IMAGES_USE_CLOUDINARY=true — use when you run `npm run dev` locally but DB points to production.
 * Force disk: SPARE_IMAGES_FORCE_LOCAL=true
 */
function useCloudinaryForSpareImages() {
    if (process.env.SPARE_IMAGES_FORCE_LOCAL === '1' || process.env.SPARE_IMAGES_FORCE_LOCAL === 'true') {
        return false;
    }
    const hasCreds = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
    if (!hasCreds) return false;
    const optIn =
        process.env.SPARE_IMAGES_USE_CLOUDINARY === '1' ||
        process.env.SPARE_IMAGES_USE_CLOUDINARY === 'true';
    if (optIn) return true;
    return process.env.NODE_ENV === 'production';
}

function safePathSegment(seg) {
    return String(seg ?? 'x').replace(/[^\w.-]+/g, '_').slice(0, 120) || 'x';
}

async function prepareSpareFileBuffer(file) {
    const originalName = file.name.replace(/ /g, '_');
    const ext = path.extname(originalName).toLowerCase();
    const isHeic = ext === '.heic' || ext === '.heif';
    let buffer = Buffer.from(await file.arrayBuffer());
    let outExt = ext;
    if (isHeic) {
        buffer = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.9 }));
        outExt = '.jpg';
    }
    const baseStem = path.basename(originalName, path.extname(originalName));
    const fileName = `${Date.now()}-${baseStem}${outExt}`;
    return { buffer, fileName };
}

async function uploadBufferToCloudinary(buffer, folder, resourceType = 'image') {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: resourceType },
            (error, result) => {
                if (error) reject(error);
                else resolve(result?.secure_url || '');
            }
        );
        stream.end(buffer);
    });
}

async function saveSpareFile(file, item_name, subfolder = '') {
    const { buffer, fileName } = await prepareSpareFileBuffer(file);
    const relPath = `/spare_files/${item_name}${subfolder ? '/' + subfolder : ''}/${fileName}`;

    if (useCloudinaryForSpareImages()) {
        const folder = `spare_files/${safePathSegment(item_name)}${subfolder ? '/' + safePathSegment(subfolder) : ''}`;
        const url = await uploadBufferToCloudinary(buffer, folder, 'auto');
        if (!url) throw new Error('Cloudinary upload returned no URL');
        return url;
    }

    const spareDir = path.join(process.cwd(), 'public/spare_files', item_name, subfolder);
    await fs.mkdir(spareDir, { recursive: true });
    await fs.writeFile(path.join(spareDir, fileName), buffer);
    return relPath;
}

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
        const type = formData.get('type');
        const make = formData.get('make');
        const model = formData.get('model');
        const compatible_machine = formData.get('compatible_machine');
        const tax = formData.get('tax');
        const min_qty = formData.get('min_qty');
        const purchase_price = formData.get('purchase_price');
        const sale_price = formData.get('sale_price');
        const last_negotiation_price = formData.get('last_negotiation_price');
        const specification = formData.get('specification');
        const imageFile = formData.get('image');

        if (!id) {
            return NextResponse.json({ error: 'Missing spare id' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Get current spare details
        const [currentSpare] = await db.execute('SELECT * FROM spare_list WHERE id = ? LIMIT 1', [id]);
        if (currentSpare.length === 0) {
            return NextResponse.json({ error: 'Spare not found' }, { status: 404 });
        }
        const existingSpare = currentSpare[0];

        // Handle image upload if provided
        let imagePath = existingSpare.image; // Keep existing image by default
        if (imageFile && imageFile.size > 0) {
            const itemNameForSave = item_name || existingSpare.item_name;
            imagePath = await saveSpareFile(imageFile, itemNameForSave);
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (spare_number !== null && spare_number !== undefined) {
            updates.push('spare_number = ?');
            values.push(spare_number);
        }
        if (item_name !== null && item_name !== undefined) {
            updates.push('item_name = ?');
            values.push(item_name);
        }
        if (type !== null && type !== undefined) {
            updates.push('type = ?');
            values.push(type);
        }
        if (make !== null && make !== undefined) {
            updates.push('make = ?');
            values.push(make);
        }
        if (model !== null && model !== undefined) {
            updates.push('model = ?');
            values.push(model);
        }
        if (compatible_machine !== null && compatible_machine !== undefined) {
            updates.push('compatible_machine = ?');
            values.push(compatible_machine);
        }
        if (tax !== null && tax !== undefined) {
            updates.push('tax = ?');
            values.push(tax);
        }
        if (min_qty !== null && min_qty !== undefined) {
            updates.push('min_qty = ?');
            values.push(min_qty);
        }
        if (purchase_price !== null && purchase_price !== undefined) {
            updates.push('purchase_price = ?');
            values.push(purchase_price);
        }
        if (sale_price !== null && sale_price !== undefined) {
            updates.push('sale_price = ?');
            values.push(sale_price);
        }
        if (last_negotiation_price !== null && last_negotiation_price !== undefined) {
            updates.push('last_negotiation_price = ?');
            values.push(last_negotiation_price);
        }
        if (specification !== null && specification !== undefined) {
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
