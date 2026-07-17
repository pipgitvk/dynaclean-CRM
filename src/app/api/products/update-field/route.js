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

        // 2. Parse Body
        const body = await request.json();
        const { item_code, field, value } = body;

        if (!item_code || !field) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate field
        const allowedFields = ['gem_price', 'gem_last_negotiation_price', 'dealer_price', 'dp_no_warranty', 'dp'];
        if (!allowedFields.includes(field)) {
            return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
        }

        const db = await getDbConnection();

        // Update the field
        await db.execute(
            `UPDATE products_list SET ${field} = ? WHERE item_code = ?`,
            [value, item_code]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update field:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
