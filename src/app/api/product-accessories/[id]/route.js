import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function PUT(req, { params }) {
    try {
        const tokenPayload = await getSessionPayload();
        if (!tokenPayload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = tokenPayload.role;
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

        const { id } = await params;
        const body = await req.json();
        const { accessory_name, description, is_mandatory } = body;

        if (!accessory_name) {
            return NextResponse.json(
                { success: false, error: "accessory_name is required" },
                { status: 400 }
            );
        }

        const conn = await getDbConnection();

        await conn.execute(
            `UPDATE product_accessories 
       SET accessory_name = ?, description = ?, is_mandatory = ? 
       WHERE id = ?`,
            [accessory_name, description || null, is_mandatory ? 1 : 0, id]
        );

        return NextResponse.json({
            success: true,
            message: "Accessory updated successfully",
        });
    } catch (e) {
        console.error("Product Accessories PUT error:", e);
        return NextResponse.json(
            { success: false, error: e.message },
            { status: 500 }
        );
    }
}

export async function DELETE(req, { params }) {
    try {
        const tokenPayload = await getSessionPayload();
        if (!tokenPayload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = tokenPayload.role;
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

        const { id } = await params;
        const conn = await getDbConnection();

        await conn.execute(`DELETE FROM product_accessories WHERE id = ?`, [id]);

        return NextResponse.json({
            success: true,
            message: "Accessory deleted successfully",
        });
    } catch (e) {
        console.error("Product Accessories DELETE error:", e);
        return NextResponse.json(
            { success: false, error: e.message },
            { status: 500 }
        );
    }
}
