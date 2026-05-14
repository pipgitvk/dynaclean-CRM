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

        if (role !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Forbidden: access denied' }, { status: 403 });
        }

        // 2. Parse Body
        const body = await request.json();
        const { type, code, price, field } = body;
        // type: 'product' | 'spare'
        // code: item_code (product) or id (spare)
        // price: number
        // field: 'last_negotiation_price' | 'price' (default to last_negotiation_price if missing for backward compatibility, or strictly require it)

        if (!type || !code || price === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Determine target column
        let targetColumn = 'last_negotiation_price';
        if (field === 'price') {
            targetColumn = type === 'product' ? 'price_per_unit' : 'price';
        } else if (field && field !== 'last_negotiation_price') {
            return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
        }

        const db = await getDbConnection();

        if (type === 'product') {
            // Products use `item_code`
            // Validate schema has `price_per_unit`
            await db.execute(
                `UPDATE products_list SET ${targetColumn} = ? WHERE item_code = ?`,
                [price, code]
            );
        } else if (type === 'spare') {
            // Spares use `id`
            await db.execute(
                `UPDATE spare_list SET ${targetColumn} = ? WHERE id = ?`,
                [price, code]
            );
        } else {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update price:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
