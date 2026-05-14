import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
    try {
        const tokenPayload = await getSessionPayload();
        if (!tokenPayload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const productCode = searchParams.get("product_code");

        const conn = await getDbConnection();

        let query = `
      SELECT 
        pa.id,
        pa.product_code,
        pa.accessory_name,
        pa.description,
        pa.is_mandatory,
        pa.created_by,
        pa.created_at,
        pa.updated_at,
        pl.item_name as product_name
      FROM product_accessories pa
      LEFT JOIN products_list pl ON pl.item_code = pa.product_code
    `;

        let params = [];

        if (productCode) {
            query += ` WHERE pa.product_code = ?`;
            params.push(productCode);
        }

        query += ` ORDER BY pa.product_code, pa.is_mandatory DESC, pa.accessory_name ASC`;

        const [rows] = await conn.execute(query, params);

        return NextResponse.json({ success: true, data: rows });
    } catch (e) {
        console.error("Product Accessories GET error:", e);
        return NextResponse.json(
            { success: false, error: e.message },
            { status: 500 }
        );
    }
}

export async function POST(req) {
    try {
        const tokenPayload = await getSessionPayload();
        if (!tokenPayload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = tokenPayload.role;
        // Only admins and superadmins can create accessories
        if (
            role !== "admin" &&
            role !== "ADMIN" &&
            role !== "superadmin" &&
            role !== "SUPERADMIN" &&
            role !== "warehouse incharge" &&
            role !== "WAREHOUSE INCHARGE"

        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { product_code, accessory_name, description, is_mandatory } = body;

        if (!product_code || !accessory_name) {
            return NextResponse.json(
                { success: false, error: "product_code and accessory_name are required" },
                { status: 400 }
            );
        }

        const conn = await getDbConnection();

        const [result] = await conn.execute(
            `INSERT INTO product_accessories 
        (product_code, accessory_name, description, is_mandatory, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
            [
                product_code,
                accessory_name,
                description || null,
                is_mandatory ? 1 : 0,
                tokenPayload.username || null,
            ]
        );

        return NextResponse.json({
            success: true,
            id: result.insertId,
            message: "Accessory added successfully",
        });
    } catch (e) {
        console.error("Product Accessories POST error:", e);
        return NextResponse.json(
            { success: false, error: e.message },
            { status: 500 }
        );
    }
}
