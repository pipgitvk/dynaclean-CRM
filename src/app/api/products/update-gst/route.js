import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

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

        // 2. Parse request body
        const { item_code, gst_rate } = await request.json();

        if (!item_code) {
            return NextResponse.json({ error: 'Missing item_code' }, { status: 400 });
        }

        if (gst_rate === null || gst_rate === undefined || gst_rate === '') {
            return NextResponse.json({ error: 'Missing gst_rate' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Update GST rate
        const [result] = await db.execute(
            'UPDATE products_list SET gst_rate = ? WHERE item_code = ?',
            [gst_rate, item_code]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update GST rate:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
