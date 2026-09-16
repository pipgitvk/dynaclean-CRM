import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  getAccessoryStockMap,
  resolveProductCodes,
} from "@/lib/resolveAccessorySpareId";

export async function GET(req) {
    try {
        const tokenPayload = await getSessionPayload();
        if (!tokenPayload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const productCode = searchParams.get("product_code");
        const packageStatus = searchParams.get("package_status");
        const godown = searchParams.get("godown");
        const resolveProduct = searchParams.get("resolve_product") === "1";

        const conn = await getDbConnection();

        let productCodes = [];
        if (productCode) {
            productCodes = resolveProduct
                ? await resolveProductCodes(conn, productCode)
                : [productCode];
        }

        let query = `
      SELECT 
        pa.id,
        pa.product_code,
        pa.spare_id,
        pa.accessory_name,
        pa.description,
        pa.is_mandatory,
        pa.qty,
        pa.package_status,
        pa.created_by,
        pa.created_at,
        pa.updated_at,
        pl.item_name as product_name,
        sl.item_name as spare_name,
        sl.spare_number
      FROM product_accessories pa
      LEFT JOIN products_list pl ON pl.item_code = pa.product_code
      LEFT JOIN spare_list sl ON sl.id = pa.spare_id
    `;

        const params = [];
        const conditions = [];

        if (productCodes.length > 0) {
            conditions.push(`pa.product_code IN (${productCodes.map(() => "?").join(", ")})`);
            params.push(...productCodes);
        }

        if (packageStatus === "available" || packageStatus === "added") {
            conditions.push(`pa.package_status = ?`);
            params.push(packageStatus);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }

        query += ` ORDER BY pa.product_code, pa.is_mandatory DESC, pa.accessory_name ASC`;

        const [rows] = await conn.execute(query, params);

        let data = rows;
        if (godown && rows.length > 0) {
            const stockMap = await getAccessoryStockMap(conn, rows, godown);
            data = rows.map((row) => ({
                ...row,
                stock_count: stockMap[row.id]?.stock_count ?? null,
                stock_matched: stockMap[row.id]?.matched ?? false,
                resolved_spare_id: stockMap[row.id]?.spare_id ?? row.spare_id,
            }));
        }

        return NextResponse.json({ success: true, data });
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
        const roleUpper = String(role).toUpperCase();
        if (!["ADMIN", "SUPERADMIN", "WAREHOUSE INCHARGE", "DIRECTOR"].includes(roleUpper)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const {
            product_code,
            accessory_name,
            description,
            is_mandatory,
            qty,
            spare_id,
            package_status,
        } = body;

        if (!product_code || !accessory_name) {
            return NextResponse.json(
                { success: false, error: "product_code and accessory_name are required" },
                { status: 400 }
            );
        }

        if (!spare_id) {
            return NextResponse.json(
                { success: false, error: "spare_id is required" },
                { status: 400 }
            );
        }

        const normalizedPackageStatus =
            package_status === "added" ? "added" : "available";

        const conn = await getDbConnection();

        const [result] = await conn.execute(
            `INSERT INTO product_accessories 
        (product_code, spare_id, accessory_name, description, is_mandatory, qty, package_status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                product_code,
                spare_id,
                accessory_name,
                description || null,
                is_mandatory ? 1 : 0,
                qty || 1,
                normalizedPackageStatus,
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
