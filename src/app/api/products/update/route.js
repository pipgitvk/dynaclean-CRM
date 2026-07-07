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
 * - PRODUCT_IMAGES_USE_CLOUDINARY=true — use when you run `npm run dev` locally but DB points to production (otherwise NODE_ENV is development and paths would stay /product_images/... on your PC only).
 * Force disk: PRODUCT_IMAGES_FORCE_LOCAL=true
 */
function useCloudinaryForProductImages() {
    if (process.env.PRODUCT_IMAGES_FORCE_LOCAL === '1' || process.env.PRODUCT_IMAGES_FORCE_LOCAL === 'true') {
        return false;
    }
    const hasCreds = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
    if (!hasCreds) return false;
    const optIn =
        process.env.PRODUCT_IMAGES_USE_CLOUDINARY === '1' ||
        process.env.PRODUCT_IMAGES_USE_CLOUDINARY === 'true';
    if (optIn) return true;
    return process.env.NODE_ENV === 'production';
}

function safePathSegment(seg) {
    return String(seg ?? 'x').replace(/[^\w.-]+/g, '_').slice(0, 120) || 'x';
}

async function prepareProductImageBuffer(file) {
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

async function uploadBufferToCloudinary(buffer, folder) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result?.secure_url || '');
            }
        );
        stream.end(buffer);
    });
}

async function saveProductImage(file, item_name, item_code) {
    const { buffer, fileName } = await prepareProductImageBuffer(file);
    const relPath = `/product_images/products/${item_name}/${item_code}/${fileName}`;

    if (useCloudinaryForProductImages()) {
        const folder = `product_images/products/${safePathSegment(item_name)}/${safePathSegment(item_code)}`;
        const url = await uploadBufferToCloudinary(buffer, folder);
        if (!url) throw new Error('Cloudinary upload returned no URL');
        return url;
    }

    const productDir = path.join(process.cwd(), 'public/product_images/products', item_name, item_code);
    await fs.mkdir(productDir, { recursive: true });
    await fs.writeFile(path.join(productDir, fileName), buffer);
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
        const gem_price = formData.get('gem_price');
        const dp_no_warranty = formData.get('dp_no_warranty');
        const dp = formData.get('dp');
        const last_negotiation_price = formData.get('last_negotiation_price');
        const gst_rate = formData.get('gst_rate');
        const specification = formData.get('specification');
        const imageFile = formData.get('image');

        if (!item_code) {
            return NextResponse.json({ error: 'Missing item_code' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Handle image upload if provided
        let imagePath = null;
        if (imageFile && imageFile.size > 0) {
            // First get the current product to get the item_name
            const [currentProduct] = await db.execute('SELECT item_name FROM products_list WHERE item_code = ?', [item_code]);
            const productName = currentProduct[0]?.item_name || item_code;
            imagePath = await saveProductImage(imageFile, productName, item_code);
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (item_name !== null && item_name !== undefined) {
            updates.push('item_name = ?');
            values.push(item_name);
        }
        if (product_number !== null && product_number !== undefined) {
            updates.push('product_number = ?');
            values.push(product_number);
        }
        if (min_qty !== null && min_qty !== undefined) {
            updates.push('min_qty = ?');
            values.push(min_qty);
        }
        if (price_per_unit !== null && price_per_unit !== undefined) {
            updates.push('price_per_unit = ?');
            values.push(price_per_unit);
        }
        if (gem_price !== null && gem_price !== undefined) {
            updates.push('gem_price = ?');
            values.push(gem_price);
        }
        if (dp_no_warranty !== null && dp_no_warranty !== undefined) {
            updates.push('dp_no_warranty = ?');
            values.push(dp_no_warranty);
        }
        if (dp !== null && dp !== undefined) {
            updates.push('dp = ?');
            values.push(dp);
        }
        if (last_negotiation_price !== null && last_negotiation_price !== undefined) {
            updates.push('last_negotiation_price = ?');
            values.push(last_negotiation_price);
        }
        if (gst_rate !== null && gst_rate !== undefined) {
            updates.push('gst_rate = ?');
            values.push(gst_rate);
        }
        if (specification !== null && specification !== undefined) {
            updates.push('specification = ?');
            values.push(specification);
        }

        if (imagePath) {
            updates.push('product_image = ?');
            values.push(imagePath);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(item_code);

        const query = `UPDATE products_list SET ${updates.join(', ')} WHERE item_code = ?`;
        await db.execute(query, values);

        // Handle image update separately - add to product_images table
        if (imagePath) {
            // Append new image to product_images table (don't delete existing)
            await db.execute(
                'INSERT IGNORE INTO product_images (item_code, image_path) VALUES (?, ?)',
                [item_code, imagePath]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update product:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
