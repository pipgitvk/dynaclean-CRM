
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function POST(req) {
    try {
        // 1. Authenticate
        const token = req.cookies.get("token")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
        const userRole = payload.role;

        if (userRole !== 'SUPERADMIN') {
            return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
        }

        const { orderId, action } = await req.json(); // action: 'approve' or 'reject'

        if (!orderId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
        }

        const conn = await getDbConnection();

        if (action === 'approve') {
            await conn.execute(
                "UPDATE neworder SET approval_status = 'approved', sales_status = 1 WHERE order_id = ?",
                [orderId]
            );
        } else {
            await conn.execute(
                "UPDATE neworder SET approval_status = 'rejected', is_cancelled = 1 WHERE order_id = ?",
                [orderId]
            );
        }

        return NextResponse.json({ success: true, message: `Order ${action}d successfully` });
    } catch (err) {
        console.error("❌ Approval API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
