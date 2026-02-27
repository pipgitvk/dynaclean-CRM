
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

        const { orderId, action, remark } = await req.json(); // action: 'approve', 'reject', or 'pending'

        if (!orderId || !['approve', 'reject', 'pending'].includes(action)) {
            return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
        }

        const conn = await getDbConnection();

        // Ensure approval_remark column exists (ignore if already exists)
        try {
            await conn.execute(
                "ALTER TABLE neworder ADD COLUMN approval_remark TEXT NULL DEFAULT NULL"
            );
        } catch (_) {
            // Column may already exist
        }

        const remarkVal = typeof remark === "string" ? remark.trim() || null : null;

        if (action === 'approve') {
            await conn.execute(
                "UPDATE neworder SET approval_status = 'approved', sales_status = 1, approval_remark = ? WHERE order_id = ?",
                [remarkVal, orderId]
            );
        } else if (action === 'reject') {
            await conn.execute(
                "UPDATE neworder SET approval_status = 'rejected', is_cancelled = 1, approval_remark = ? WHERE order_id = ?",
                [remarkVal, orderId]
            );
        } else {
            // Reset to pending (undo approve/reject)
            await conn.execute(
                "UPDATE neworder SET approval_status = 'pending', is_cancelled = 0, sales_status = 0, approval_remark = NULL WHERE order_id = ?",
                [orderId]
            );
        }

        const msg = action === 'pending' ? 'Order reset to pending' : `Order ${action}d successfully`;
        return NextResponse.json({ success: true, message: msg });
    } catch (err) {
        console.error("❌ Approval API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
