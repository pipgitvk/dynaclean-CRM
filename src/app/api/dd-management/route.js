import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

async function ensureDDTypeSupportsEPayment(pool) {
    try {
        await pool.execute("ALTER TABLE dd_records MODIFY COLUMN type ENUM('DD', 'BG', 'EPAYMENT') DEFAULT 'DD'");
    } catch (error) {
        if (error.code !== "WARN_DATA_TRUNCATED") {
            console.warn("Could not ensure EPAYMENT type support:", error.message);
        }
    }
}

async function ensureDDRecordsColumns(pool) {
    try {
        await pool.execute("ALTER TABLE dd_records ADD COLUMN bid_document VARCHAR(500) NULL AFTER mode_of_payment");
    } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
            console.warn("Could not add bid_document column:", error.message);
        }
    }
    try {
        await pool.execute("ALTER TABLE dd_records ADD COLUMN remark TEXT NULL AFTER bid_document");
    } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
            console.warn("Could not add remark column:", error.message);
        }
    }
    try {
        await pool.execute("ALTER TABLE dd_records ADD COLUMN contract_no VARCHAR(255) NULL AFTER remark");
    } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
            console.warn("Could not add contract_no column:", error.message);
        }
    }
    try {
        await pool.execute("ALTER TABLE dd_records ADD COLUMN security_type VARCHAR(50) NULL AFTER contract_no");
    } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
            console.warn("Could not add security_type column:", error.message);
        }
    }
    const ddColumns = [
        ["dd_no", "VARCHAR(255) NULL"],
        ["dd_date", "DATE NULL"],
        ["dd_beneficiary_name", "VARCHAR(255) NULL"],
        ["expiry_bank", "DATE NULL"],
        ["issuing_branch", "VARCHAR(255) NULL"],
        ["dd_scan_copy", "VARCHAR(500) NULL"],
        ["dd_receipt", "VARCHAR(500) NULL"]
    ];
    for (const [column, definition] of ddColumns) {
        try {
            await pool.execute(`ALTER TABLE dd_records ADD COLUMN ${column} ${definition}`);
        } catch (error) {
            if (error.code !== "ER_DUP_FIELDNAME") {
                console.warn(`Could not add ${column} column:`, error.message);
            }
        }
    }
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search");
        const type = searchParams.get("type");

        const session = await getSessionPayload();
        const userRole = session?.role?.toUpperCase() || "GUEST";
        const username = session?.username || session?.name;

        const pool = await getDbConnection();
        let query = "SELECT * FROM dd_records WHERE 1=1";
        const params = [];

        // Role-based visibility
        const isPrivileged = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "DIRECTOR"].includes(userRole);
        if (!isPrivileged && username) {
            query += " AND assigned_by = ?";
            params.push(username);
        }

        if (status && status !== "all") {
            query += " AND status = ?";
            params.push(status);
        }

        if (type && type !== "all") {
            query += " AND type = ?";
            params.push(type);
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
        const { type = "DD", dd_location, party_name, amount, assign_date, beneficiary_name, beneficiary_address, expiry_date, claim_expiry_date, bg_format_upload, mode_of_payment, bid_document, remark, contract_no, security_type, dd_no, dd_date, dd_beneficiary_name, expiry_bank, issuing_branch, dd_scan_copy, dd_receipt } = body;
        let { assigned_by } = body;

        // Fallback to session if assigned_by is missing
        if (!assigned_by) {
            const session = await getSessionPayload();
            assigned_by = session?.username || session?.name || "System";
        }

        const pool = await getDbConnection();
        await ensureDDTypeSupportsEPayment(pool);
        await ensureDDRecordsColumns(pool);

        if (type === "BG") {
            if (!beneficiary_name || !amount || !expiry_date || !assigned_by) {
                return NextResponse.json({ error: "Missing required fields for BG assignment" }, { status: 400 });
            }
            const [result] = await pool.execute(
                `INSERT INTO dd_records (type, beneficiary_name, beneficiary_address, amount, expiry_date, claim_expiry_date, bg_format_upload, assign_date, assigned_by, status, mode_of_payment, bid_document, remark, contract_no, security_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?, ?)`,
                [type, beneficiary_name, beneficiary_address, amount, expiry_date, claim_expiry_date, bg_format_upload, assign_date, assigned_by, mode_of_payment || 'BG', bid_document || null, remark || null, contract_no || null, security_type || null]
            );
            return NextResponse.json({ success: true, data: { id: result.insertId } });
        } else {
            if (!dd_location || !party_name || !amount || !assign_date || !assigned_by) {
                return NextResponse.json({ error: "Missing required fields for DD assignment" }, { status: 400 });
            }
            const [result] = await pool.execute(
                `INSERT INTO dd_records (type, dd_location, party_name, amount, assign_date, assigned_by, status, mode_of_payment, bid_document, remark, contract_no, security_type, dd_no, dd_date, dd_beneficiary_name, expiry_bank, issuing_branch, dd_scan_copy, dd_receipt) 
         VALUES (?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [type || 'DD', dd_location, party_name, amount, assign_date, assigned_by, mode_of_payment || 'DD', bid_document || null, remark || null, contract_no || null, security_type || null, dd_no || null, dd_date || null, dd_beneficiary_name || null, expiry_bank || null, issuing_branch || null, dd_scan_copy || null, dd_receipt || null]
            );
            return NextResponse.json({ success: true, data: { id: result.insertId } });
        }
    } catch (error) {
        console.error("❌ Create DD/BG Error:", error);
        return NextResponse.json({ error: error.message || "Failed to create record" }, { status: 500 });
    }
}
