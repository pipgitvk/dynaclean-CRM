// app/api/holidays/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET() {
    try {
        const db = await getDbConnection();
        const [rows] = await db.query(
            `SELECT id, title, holiday_date, description, created_by, created_at, updated_at
       FROM holidays
       ORDER BY holiday_date DESC`
        );
        return NextResponse.json({ holidays: rows });
    } catch (error) {
        console.error("Error fetching holidays:", error);
        return NextResponse.json({ message: "Internal server error." }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = payload.role || "GUEST";
        if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { title, holiday_date, description = null } = body || {};

        if (!title || !holiday_date) {
            return NextResponse.json({ message: "title and holiday_date are required" }, { status: 400 });
        }

        const db = await getDbConnection();
        const [result] = await db.query(
            `INSERT INTO holidays (title, holiday_date, description, created_by)
       VALUES (?, ?, ?, ?)`,
            [title, holiday_date, description, payload.username || 'system']
        );

        return NextResponse.json({ id: result.insertId, message: "Holiday created" }, { status: 201 });
    } catch (error) {
        console.error("Error creating holiday:", error);
        if (error && error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ message: "Holiday already exists for this date" }, { status: 409 });
        }
        return NextResponse.json({ message: "Internal server error." }, { status: 500 });
    }
}
