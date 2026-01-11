import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { getSessionPayload } from "@/lib/auth";
import fs from 'fs/promises';
import path from 'path';

export async function POST(request) {

    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const username = tokenPayload.username;

    const formData = await request.formData();
    const data = Object.fromEntries(formData);
    
    const {
        item_name, specification, type, make, model, compatible_machine, price, tax
    } = data;

    // Basic validation
    if (!item_name || !price || !tax) {
        return NextResponse.json({ error: 'Required fields are missing: Item Name, Price, Tax.' }, { status: 400 });
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

        const spareDir = path.join(process.cwd(), 'public/spare_files', item_name);
        await fs.mkdir(spareDir, { recursive: true });

        let imagePath = null;
        let catalogPath = null;

        // Handle image upload
        const imageFile = formData.get('image');
        if (imageFile instanceof File) {
            const fileName = `image_${Date.now()}-${imageFile.name.replace(/ /g, '_')}`;
            const filePath = path.join(spareDir, fileName);
            await fs.writeFile(filePath, Buffer.from(await imageFile.arrayBuffer()));
            imagePath = `/spare_files/${item_name}/${fileName}`;
        }

        // Handle catalog upload
        const catalogFile = formData.get('catalog');
        if (catalogFile instanceof File) {
            const fileName = `catalog_${Date.now()}-${catalogFile.name.replace(/ /g, '_')}`;
            const filePath = path.join(spareDir, fileName);
            await fs.writeFile(filePath, Buffer.from(await catalogFile.arrayBuffer()));
            catalogPath = `/spare_files/${item_name}/${fileName}`;
        }

        // Insert into spare_list table
        const spareQuery = `
            INSERT INTO spare_list 
            (item_name, specification, type, make, model, compatible_machine, price, tax, image, catalog , created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const spareValues = [
            item_name,
            specification,
            type || null,
            make || null,
            model || null,
            compatible_machine, // Stored as a comma-separated string
            parseFloat(price),
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
