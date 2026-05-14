
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

        // Ensure approval_remark and approval_date columns exist
        try {
            await conn.execute(
                "ALTER TABLE neworder ADD COLUMN approval_remark TEXT NULL DEFAULT NULL"
            );
        } catch (_) {}
        try {
            await conn.execute(
                "ALTER TABLE neworder ADD COLUMN approval_date DATETIME NULL DEFAULT NULL"
            );
        } catch (_) {}

        const remarkVal = typeof remark === "string" ? remark.trim() || null : null;

        if (action === 'approve') {
            await conn.execute(
                "UPDATE neworder SET approval_status = 'approved', sales_status = 1, approval_remark = ?, approval_date = NOW() WHERE order_id = ?",
                [remarkVal, orderId]
            );
        } else if (action === 'reject') {
            await conn.execute(
                "UPDATE neworder SET approval_status = 'rejected', is_cancelled = 1, approval_remark = ?, approval_date = NOW() WHERE order_id = ?",
                [remarkVal, orderId]
            );
        } else {
            // Reset to pending (undo approve/reject) - only within 4 hours
            const [orderRows] = await conn.execute(
                "SELECT approval_date FROM neworder WHERE order_id = ?",
                [orderId]
            );
            const approvalDate = orderRows[0]?.approval_date;
            if (!approvalDate) {
                return NextResponse.json(
                    { success: false, error: "Revert is only allowed within 4 hours of approval/rejection." },
                    { status: 400 }
                );
            }
            
            // Parse DB string as UTC
            let dateStr = String(approvalDate);
            if (!dateStr.includes('Z')) {
              dateStr = dateStr.replace(' ', 'T') + 'Z';
            }
            const approvedAt = new Date(dateStr).getTime();
            const hoursPassed = (Date.now() - approvedAt) / (1000 * 60 * 60);
            
            if (hoursPassed >= 4) {
                return NextResponse.json(
                    { success: false, error: "Revert is only allowed within 4 hours of approval/rejection." },
                    { status: 400 }
                );
            }
            await conn.execute(
                "UPDATE neworder SET approval_status = 'pending', is_cancelled = 0, sales_status = 0, approval_remark = NULL, approval_date = NULL WHERE order_id = ?",
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
