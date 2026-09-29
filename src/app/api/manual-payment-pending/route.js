import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET;
const UPLOAD_DIR = path.join(process.cwd(), "public", "payment_invoices");

// Helper function to verify JWT and check roles
async function verifyAccess(req, allowedRoles = ["ACCOUNTANT", "ADMIN", "SUPERADMIN"]) {
    const token = req.cookies.get("token")?.value;
    if (!token) {
        return { error: "Unauthorized", status: 401 };
    }

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(JWT_SECRET)
        );

        const role = payload.role;
        if (!allowedRoles.includes(role)) {
            return { error: "Access denied", status: 403 };
        }

        return { username: payload.username, role: payload.role };
    } catch (err) {
        return { error: "Invalid token", status: 401 };
    }
}

// GET: Fetch all manual payment pending entries
export async function GET(request) {
    try {
        const auth = await verifyAccess(request);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const customerName = searchParams.get("customer_name");
        const dateFrom = searchParams.get("date_from");
        const dateTo = searchParams.get("date_to");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = (page - 1) * limit;

        const conn = await getDbConnection();

        // Build dynamic query
        let whereConditions = [];
        let queryParams = [];

        if (status) {
            whereConditions.push("status = ?");
            queryParams.push(status);
        }

        if (customerName) {
            whereConditions.push("customer_name LIKE ?");
            queryParams.push(`%${customerName}%`);
        }

        if (dateFrom) {
            whereConditions.push("payment_date >= ?");
            queryParams.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push("payment_date <= ?");
            queryParams.push(dateTo);
        }

        const whereClause = whereConditions.length > 0
            ? "WHERE " + whereConditions.join(" AND ")
            : "";

        // Get total count
        const [countResult] = await conn.execute(
            `SELECT COUNT(*) as total FROM manual_payment_pending ${whereClause}`,
            queryParams
        );
        const totalRecords = countResult[0].total;

        // Get paginated data
        const [rows] = await conn.execute(
            `SELECT * FROM manual_payment_pending 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        // Get statistics
        const [stats] = await conn.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END), 0) as received_amount
      FROM manual_payment_pending
      WHERE status != 'cancelled'
    `);

        return NextResponse.json({
            success: true,
            data: rows,
            pagination: {
                page,
                limit,
                total: totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
            },
            stats: stats[0],
        });
    } catch (error) {
        console.error("❌ Error fetching payment entries:", error);
        return NextResponse.json(
            { error: "Server error", details: error.message },
            { status: 500 }
        );
    }
}

// POST: Create new manual payment pending entry
export async function POST(request) {
    try {
        const auth = await verifyAccess(request);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const formData = await request.formData();

        // Extract fields
        const customerName = formData.get("customer_name");
        const customerPhone = formData.get("customer_phone");
        const customerEmail = formData.get("customer_email");
        const amount = formData.get("amount");
        const paymentType = formData.get("payment_type") || "partial";
        const paymentMethod = formData.get("payment_method") || "cash";
        const referenceNumber = formData.get("reference_number");
        const paymentDate = formData.get("payment_date");
        const dueDate = formData.get("due_date");
        const status = formData.get("status") || "pending";
        const remarks = formData.get("remarks");
        const invoiceFile = formData.get("invoice_file");

        // Validation
        if (!customerName || !amount) {
            return NextResponse.json(
                { error: "Customer name and amount are required" },
                { status: 400 }
            );
        }

        let invoiceFilePath = null;

        // Handle file upload if present
        if (invoiceFile && typeof invoiceFile === "object" && invoiceFile.size > 0) {
            await mkdir(UPLOAD_DIR, { recursive: true });

            const timestamp = Date.now();
            const fileExt = path.extname(invoiceFile.name).slice(0, 16);
            const fileName = `invoice_${timestamp}${fileExt}`;
            const filePath = path.join(UPLOAD_DIR, fileName);
            const buffer = Buffer.from(await invoiceFile.arrayBuffer());

            await writeFile(filePath, buffer);
            invoiceFilePath = `/payment_invoices/${fileName}`;
        }

        const conn = await getDbConnection();

        const [result] = await conn.execute(
            `INSERT INTO manual_payment_pending (
        customer_name, customer_phone, customer_email, amount,
        payment_type, payment_method, reference_number, invoice_file,
        payment_date, due_date, status, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customerName,
                customerPhone,
                customerEmail,
                amount,
                paymentType,
                paymentMethod,
                referenceNumber,
                invoiceFilePath,
                paymentDate,
                dueDate,
                status,
                remarks,
                auth.username,
            ]
        );

        return NextResponse.json({
            success: true,
            message: "Payment entry created successfully",
            id: result.insertId,
        });
    } catch (error) {
        console.error("❌ Error creating payment entry:", error);
        return NextResponse.json(
            { error: "Server error", details: error.message },
            { status: 500 }
        );
    }
}
