import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

async function ensureDDRecordsColumns(pool) {
    try {
        await pool.execute("ALTER TABLE dd_records ADD COLUMN bid_document VARCHAR(500) NULL");
    } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
            console.warn("Could not add bid_document column:", error.message);
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

function toDbValue(value) {
    if (value === undefined || value === "") return null;
    if (value instanceof Date) return value;
    if (value && typeof value === "object") return null;
    return value;
}

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const body = await req.json();

        // We expect fields from Step 2 or Step 3
        const {
            // Step 1 / General
            type,
            beneficiary_name,
            beneficiary_address,
            expiry_date,
            claim_expiry_date,
            bg_format_upload,
            mode_of_payment,
            bid_document,
            remark,
            contract_no,
            security_type,

            // Step 2 (DD & BG shared/specific)
            cheque_no,
            cheque_upload,
            bank_name,
            account_number,
            branch,
            signature_upload,
            filled_by,
            filled_date,

            // Step 2 & 3 BG Specific
            fd_number,
            original_bg_upload,
            bg_number,
            docs_upload,
            bg_date,
            bg_amount,
            bg_number_field,
            validity_upto,
            client_name,
            bg_scan_copy,

            // Step 3 (DD Specific)
            dd_upload,
            dd_number,
            issued_by,
            dd_no,
            dd_date,
            dd_beneficiary_name,
            expiry_bank,
            issuing_branch,
            dd_scan_copy,
            dd_receipt,

            // NEFT/RTGS/IMPS Payment Details
            reference_no,
            payment_amount,
            payment_date,
            payment_proof,
            receipt,
            from_bank_account_no,

            // Metadata
            status,
            original_dd_location,
            sent_to_client_date,
            claim_from_bank
        } = body;

        const pool = await getDbConnection();
        await ensureDDRecordsColumns(pool);

        // Build dynamic update query
        let query = "UPDATE dd_records SET ";
        const updateParams = [];
        const fields = [];

        // BG Step 1 fields
        if (type !== undefined) { fields.push("type = ?"); updateParams.push(type); }
        if (beneficiary_name !== undefined) { fields.push("beneficiary_name = ?"); updateParams.push(beneficiary_name); }
        if (beneficiary_address !== undefined) { fields.push("beneficiary_address = ?"); updateParams.push(beneficiary_address); }
        if (expiry_date !== undefined) { fields.push("expiry_date = ?"); updateParams.push(expiry_date); }
        if (claim_expiry_date !== undefined) { fields.push("claim_expiry_date = ?"); updateParams.push(claim_expiry_date); }
        if (bg_format_upload !== undefined) { fields.push("bg_format_upload = ?"); updateParams.push(bg_format_upload); }
        if (mode_of_payment !== undefined) { fields.push("mode_of_payment = ?"); updateParams.push(mode_of_payment); }
        if (bid_document !== undefined) { fields.push("bid_document = ?"); updateParams.push(bid_document || null); }
        if (remark !== undefined) { fields.push("remark = ?"); updateParams.push(remark || null); }
        if (contract_no !== undefined) { fields.push("contract_no = ?"); updateParams.push(contract_no || null); }
        if (security_type !== undefined) { fields.push("security_type = ?"); updateParams.push(security_type || null); }

        // Step 2 fields (DD & shared)
        if (cheque_no !== undefined) { fields.push("cheque_no = ?"); updateParams.push(cheque_no); }
        if (cheque_upload !== undefined) { fields.push("cheque_upload = ?"); updateParams.push(cheque_upload); }
        if (bank_name !== undefined) { fields.push("bank_name = ?"); updateParams.push(bank_name); }
        if (account_number !== undefined) { fields.push("account_number = ?"); updateParams.push(account_number); }
        if (branch !== undefined) { fields.push("branch = ?"); updateParams.push(branch); }
        if (signature_upload !== undefined) { fields.push("signature_upload = ?"); updateParams.push(signature_upload); }
        if (filled_by !== undefined) { fields.push("filled_by = ?"); updateParams.push(filled_by); }
        if (filled_date !== undefined) { fields.push("filled_date = ?"); updateParams.push(filled_date); }

        // BG Step 2 fields
        if (fd_number !== undefined) { fields.push("fd_number = ?"); updateParams.push(fd_number); }
        if (original_bg_upload !== undefined) { fields.push("original_bg_upload = ?"); updateParams.push(original_bg_upload); }
        if (bg_number !== undefined) { fields.push("bg_number = ?"); updateParams.push(bg_number); }
        if (docs_upload !== undefined) { fields.push("docs_upload = ?"); updateParams.push(docs_upload); }
        if (bg_date !== undefined) { fields.push("bg_date = ?"); updateParams.push(bg_date); }

        if (bg_amount !== undefined) { fields.push("bg_amount = ?"); updateParams.push(bg_amount); }
        if (bg_number_field !== undefined) { fields.push("bg_number_field = ?"); updateParams.push(bg_number_field); }
        if (validity_upto !== undefined) { fields.push("validity_upto = ?"); updateParams.push(validity_upto); }
        if (client_name !== undefined) { fields.push("client_name = ?"); updateParams.push(client_name); }
        if (bg_scan_copy !== undefined) { fields.push("bg_scan_copy = ?"); updateParams.push(bg_scan_copy); }

        // Step 3 fields (DD)
        if (dd_upload !== undefined) { fields.push("dd_upload = ?"); updateParams.push(dd_upload); }
        if (dd_number !== undefined && dd_number !== "") { fields.push("dd_number = ?"); updateParams.push(dd_number); }
        if (issued_by !== undefined) { fields.push("issued_by = ?"); updateParams.push(issued_by); }
        if (dd_no !== undefined) { fields.push("dd_no = ?"); updateParams.push(dd_no || null); }
        if (dd_date !== undefined) { fields.push("dd_date = ?"); updateParams.push(dd_date || null); }
        if (dd_beneficiary_name !== undefined) { fields.push("dd_beneficiary_name = ?"); updateParams.push(dd_beneficiary_name || null); }
        if (expiry_bank !== undefined) { fields.push("expiry_bank = ?"); updateParams.push(expiry_bank || null); }
        if (issuing_branch !== undefined) { fields.push("issuing_branch = ?"); updateParams.push(issuing_branch || null); }
        if (dd_scan_copy !== undefined) { fields.push("dd_scan_copy = ?"); updateParams.push(dd_scan_copy || null); }
        if (dd_receipt !== undefined) { fields.push("dd_receipt = ?"); updateParams.push(dd_receipt || null); }

        // Metadata
        if (status !== undefined) {
            fields.push("status = ?");
            updateParams.push(status);
        }
        if (original_dd_location !== undefined) { fields.push("original_dd_location = ?"); updateParams.push(original_dd_location); }
        if (sent_to_client_date !== undefined) { fields.push("sent_to_client_date = ?"); updateParams.push(sent_to_client_date); }
        if (claim_from_bank !== undefined) { fields.push("claim_from_bank = ?"); updateParams.push(claim_from_bank ? 1 : 0); }

        // NEFT/RTGS/IMPS Payment Details
        if (reference_no !== undefined) { fields.push("reference_no = ?"); updateParams.push(reference_no); }
        if (payment_amount !== undefined) { fields.push("payment_amount = ?"); updateParams.push(payment_amount); }
        if (payment_date !== undefined) { fields.push("payment_date = ?"); updateParams.push(payment_date); }
        if (payment_proof !== undefined) { fields.push("payment_proof = ?"); updateParams.push(payment_proof); }
        if (receipt !== undefined) { fields.push("receipt = ?"); updateParams.push(receipt); }
        if (from_bank_account_no !== undefined) { fields.push("from_bank_account_no = ?"); updateParams.push(from_bank_account_no); }

        if (fields.length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        query += fields.join(", ");
        query += " WHERE id = ?";
        updateParams.push(id);
        const safeUpdateParams = updateParams.map(toDbValue);

        await pool.execute(query, safeUpdateParams);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("❌ Update DD Error:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            sql: error.sql,
            sqlMessage: error.sqlMessage
        });
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: "DD Number already exists" }, { status: 400 });
        }
        return NextResponse.json({ error: error.message || error.sqlMessage || "Failed to update record" }, { status: 500 });
    }
}
