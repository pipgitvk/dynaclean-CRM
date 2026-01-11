import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const session = await getSessionPayload();
        const userRole = session?.role?.toUpperCase() || "GUEST";
        const username = session?.username || session?.name;

        const pool = await getDbConnection();
        let query = "SELECT * FROM dd_records WHERE 1=1";
        const params = [];

        // Role-based visibility
        const isPrivileged = ["SUPERADMIN", "ADMIN", "ACCOUNTANT"].includes(userRole);
        if (!isPrivileged && username) {
            query += " AND assigned_by = ?";
            params.push(username);
        }

        if (status && status !== "all") {
            query += " AND status = ?";
            params.push(status);
        }

        if (search) {
            query += " AND (party_name LIKE ? OR dd_location LIKE ? OR dd_number LIKE ? OR beneficiary_name LIKE ? OR bg_number LIKE ?)";
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        query += " ORDER BY created_at DESC";

        const [rows] = await pool.execute(query, params);
        return NextResponse.json({ data: rows });
    } catch (error) {
        console.error("❌ Fetch DD Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch records" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { type = "DD", dd_location, party_name, amount, assign_date, beneficiary_name, beneficiary_address, expiry_date, claim_expiry_date, bg_format_upload } = body;
        let { assigned_by } = body;

        // Fallback to session if assigned_by is missing
        if (!assigned_by) {
            const session = await getSessionPayload();
            assigned_by = session?.username || session?.name || "System";
        }

        const pool = await getDbConnection();

        if (type === "BG") {
            if (!beneficiary_name || !amount || !expiry_date || !assigned_by) {
                return NextResponse.json({ error: "Missing required fields for BG assignment" }, { status: 400 });
            }
            const [result] = await pool.execute(
                `INSERT INTO dd_records (type, beneficiary_name, beneficiary_address, amount, expiry_date, claim_expiry_date, bg_format_upload, assign_date, assigned_by, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned')`,
                [type, beneficiary_name, beneficiary_address, amount, expiry_date, claim_expiry_date, bg_format_upload, assign_date, assigned_by]
            );
            return NextResponse.json({ success: true, data: { id: result.insertId } });
        } else {
            if (!dd_location || !party_name || !amount || !assign_date || !assigned_by) {
                return NextResponse.json({ error: "Missing required fields for DD assignment" }, { status: 400 });
            }
            const [result] = await pool.execute(
                `INSERT INTO dd_records (type, dd_location, party_name, amount, assign_date, assigned_by, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'Assigned')`,
                [type || 'DD', dd_location, party_name, amount, assign_date, assigned_by]
            );
            return NextResponse.json({ success: true, data: { id: result.insertId } });
        }
    } catch (error) {
        console.error("❌ Create DD/BG Error:", error);
        return NextResponse.json({ error: error.message || "Failed to create record" }, { status: 500 });
    }
}
