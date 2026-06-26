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

    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = tokenPayload.username;

    const formData = await request.formData();
    
    const item_name = formData.get('item_name');
    const specification = formData.get('specification');
    const type = formData.get('type');
    const make = formData.get('make');
    const model = formData.get('model');
    const compatible_machine = formData.get('compatible_machine');
    const purchase_price = formData.get('purchase_price');
    const sale_price = formData.get('sale_price');
    const last_negotiation_price = formData.get('last_negotiation_price');
    const tax = formData.get('tax');

    // Basic validation
    if (!item_name || !purchase_price || !tax) {
        return NextResponse.json({ error: 'Required fields are missing: Item Name, Purchase Price, Tax.' }, { status: 400 });
    }

    try {
        const db = await getDbConnection();

        // Prevent duplicates by item_name (case-insensitive)
        const [existing] = await db.execute(
            'SELECT 1 FROM spare_list WHERE LOWER(item_name) = LOWER(?) LIMIT 1',
            [item_name]
        );
        if (existing.length > 0) {
            return NextResponse.json({ error: `Spare '${item_name}' already exists` }, { status: 409 });
        }

        let imagePath = null;
        let catalogPath = null;

        // Handle image upload
        const imageFile = formData.get('image');
        if (imageFile instanceof File && imageFile.size > 0) {
            imagePath = await saveSpareFile(imageFile, item_name);
        }

        // Handle catalog upload
        const catalogFile = formData.get('catalog');
        if (catalogFile instanceof File && catalogFile.size > 0) {
            catalogPath = await saveSpareFile(catalogFile, item_name, 'catalog');
        }

        // Insert into spare_list table
        const spareQuery = `
            INSERT INTO spare_list 
            (item_name, specification, type, make, model, compatible_machine, purchase_price, sale_price, last_negotiation_price, tax, image, catalog , created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const spareValues = [
            item_name,
            specification,
            type || null,
            make || null,
            model || null,
            compatible_machine, // Stored as a comma-separated string
            parseFloat(purchase_price),
            sale_price ? parseFloat(sale_price) : null,
            last_negotiation_price ? parseFloat(last_negotiation_price) : null,
            parseFloat(tax),
            imagePath,
            catalogPath,
            username
        ];

        await db.execute(spareQuery, spareValues);

        return NextResponse.json({ message: 'Spare part added successfully' }, { status: 201 });
    } catch (error) {
        console.error('Failed to add spare part:', error);
        return NextResponse.json({ error: 'Failed to add spare part.' }, { status: 500 });
    }
}
