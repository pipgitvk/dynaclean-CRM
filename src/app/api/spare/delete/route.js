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
            return NextResponse.json({ error: 'Forbidden: only super admin can delete spares' }, { status: 403 });
        }

        // 2. Parse Request Body
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        const db = await getDbConnection();

        // 3. Get the spare first to get the image path
        const [spares] = await db.execute('SELECT image FROM spare_list WHERE id = ?', [id]);
        if (spares.length === 0) {
            return NextResponse.json({ error: 'Spare not found' }, { status: 404 });
        }
        const spare = spares[0];

        // 4. Delete from database
        await db.execute('DELETE FROM spare_list WHERE id = ?', [id]);

        // 5. Try to delete local image file (if exists)
        if (spare.image && !spare.image.startsWith('http')) {
            try {
                const fullPath = path.join(process.cwd(), 'public', spare.image);
                await fs.unlink(fullPath);
            } catch (err) {
                console.error('Failed to delete image file:', err);
                // Don't fail the request if file deletion fails
            }
        }

        return NextResponse.json({ success: true, message: 'Spare deleted successfully' });
    } catch (error) {
        console.error('Failed to delete spare:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
