// import { NextResponse } from 'next/server';
// import { getDbConnection } from '@/lib/db';
// import fs from 'fs/promises';
// import path from 'path';

// export async function POST(request) {
//     const formData = await request.formData();
//     const data = Object.fromEntries(formData);

//     const {
//         item_name, item_code, category, specification, gst_rate, hsn_sac,
//         unit, price_per_unit
//     } = data;

//     // Basic validation
//     if (!item_name || !item_code || !category || !gst_rate || !hsn_sac || !formData.get('product_image') || !unit || !price_per_unit) {
//         return NextResponse.json({ error: 'Required fields are missing.' }, { status: 400 });
//     }

//     try {
//         const productDir = path.join(process.cwd(), 'public/product_images/products', item_name, item_code);
//         await fs.mkdir(productDir, { recursive: true });

//         const imagePaths = {};
//         const imageKeys = ['product_image', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5'];

//         for (const key of imageKeys) {
//             const file = formData.get(key);
//             if (file instanceof File) {
//                 const fileName = `${Date.now()}-${file.name.replace(/ /g, '_')}`;
//                 const filePath = path.join(productDir, fileName);
//                 await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
//                 // Save the relative path for the database
//                 imagePaths[key] = `/product_images/products/${item_name}/${item_code}/${fileName}`;
//             } else {
//                 imagePaths[key] = '';
//             }
//         }

//         const db = await getDbConnection();

//         const query = `
//             INSERT INTO products_list 
//             (item_name, item_code, category, specification, gst_rate, hsn_sac, product_image, 
//             img_1, img_2, img_3, img_4, img_5, unit, price_per_unit, status) 
//             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
//         `;

//         const values = [
//             item_name, item_code, category, specification, gst_rate, hsn_sac,
//             imagePaths.product_image, imagePaths.img_1, imagePaths.img_2,
//             imagePaths.img_3, imagePaths.img_4, imagePaths.img_5,
//             unit, price_per_unit
//         ];

//         await db.execute(query, values);

//         return NextResponse.json({ message: 'Product added successfully' }, { status: 201 });
//     } catch (error) {
//         console.error('Failed to add product:', error);
//         return NextResponse.json({ error: 'Failed to add product.' }, { status: 500 });
//     }
// }

import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getSessionPayload } from "@/lib/auth";
import fs from 'fs/promises';
import path from 'path';
import heicConvert from 'heic-convert';
import { v2 as cloudinary } from 'cloudinary';

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

// Check if a product code exists (case-insensitive)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const item_code = searchParams.get('item_code') || searchParams.get('code');
        if (!item_code) {
            return NextResponse.json({ error: 'item_code is required' }, { status: 400 });
        }

        const db = await getDbConnection();
        const [rows] = await db.execute(
            `SELECT 1 FROM products_list WHERE LOWER(item_code) = LOWER(?) LIMIT 1`,
            [item_code]
        );
        return NextResponse.json({ exists: rows.length > 0 }, { status: 200 });
    } catch (error) {
        console.error('Failed to check product code:', error);
        return NextResponse.json({ error: 'Failed to check product code' }, { status: 500 });
    }
}

export async function POST(request) {
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = tokenPayload.username;

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const {
        item_name, item_code, category, specification, gst_rate, hsn_sac,
        unit, price_per_unit
    } = data;

    // Basic validation
    if (!item_name || !item_code || !category || !gst_rate || !hsn_sac || !formData.get('product_image') || !unit || !price_per_unit) {
        return NextResponse.json({ error: 'Required fields are missing.' }, { status: 400 });
    }

    try {
        const imagePaths = {};
        const imageFiles = [];
        const imageKeys = ['product_image', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5'];

        for (const key of imageKeys) {
            const file = formData.get(key);
            if (file instanceof File) {
                const storedPath = await saveProductImage(file, item_name, item_code);
                imagePaths[key] = storedPath;
                imageFiles.push(storedPath);
            } else {
                imagePaths[key] = '';
            }
        }

        const db = await getDbConnection();

        // Check for duplicate item_code (case-insensitive) BEFORE inserting
        const [existingProducts] = await db.execute(
            `SELECT item_code FROM products_list WHERE LOWER(item_code) = LOWER(?)`,
            [item_code]
        );

        if (existingProducts.length > 0) {
            return NextResponse.json({
                error: 'Duplicate entry',
                message: `Product code '${item_code}' already exists (case-insensitive match with '${existingProducts[0].item_code}')`,
                field: 'item_code'
            }, { status: 409 });
        }

        // 1. Insert product details into products_list table
        try {
            const productQuery = `
                INSERT INTO products_list 
                (item_name, item_code, category, specification, gst_rate, hsn_sac, product_image, 
                img_1, img_2, img_3, img_4, img_5, unit, price_per_unit, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const productValues = [
                item_name, item_code, category, specification, gst_rate, hsn_sac,
                imagePaths.product_image, imagePaths.img_1, imagePaths.img_2,
                imagePaths.img_3, imagePaths.img_4, imagePaths.img_5,
                unit, price_per_unit,username
            ];

            await db.execute(productQuery, productValues);
        } catch (error) {
            console.error('Product insert failed:', error);
            return NextResponse.json({ error: 'Failed to add product.' }, { status: 500 });
        }

        // 2. Insert the primary image path into the product_images table
        try {
            const primaryImage = imageFiles[0];
            if (primaryImage) {
                await db.execute(
                    `INSERT IGNORE INTO product_images (item_code, image_path) VALUES (?, ?)`,
                    [item_code, primaryImage]
                );
            }
        } catch (error) {
            console.error('Image insert failed:', error);
            return NextResponse.json({ error: 'Failed to add product images.' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Product and images added successfully' }, { status: 201 });
    } catch (error) {
        console.error('Failed to add product and images (outer):', error);
        return NextResponse.json({ error: 'Failed to add product and images.' }, { status: 500 });
    }
}
