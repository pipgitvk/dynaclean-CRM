import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

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

            // Step 3 (DD Specific)
            dd_upload,
            dd_number,
            issued_by,

            // Metadata
            status,
            original_dd_location,
            sent_to_client_date,
            claim_from_bank
        } = body;

        const pool = await getDbConnection();

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

        // Step 3 fields (DD)
        if (dd_upload !== undefined) { fields.push("dd_upload = ?"); updateParams.push(dd_upload); }
        if (dd_number !== undefined) { fields.push("dd_number = ?"); updateParams.push(dd_number); }
        if (issued_by !== undefined) { fields.push("issued_by = ?"); updateParams.push(issued_by); }

        // Metadata
        if (status !== undefined) { fields.push("status = ?"); updateParams.push(status); }
        if (original_dd_location !== undefined) { fields.push("original_dd_location = ?"); updateParams.push(original_dd_location); }
        if (sent_to_client_date !== undefined) { fields.push("sent_to_client_date = ?"); updateParams.push(sent_to_client_date); }
        if (claim_from_bank !== undefined) { fields.push("claim_from_bank = ?"); updateParams.push(claim_from_bank ? 1 : 0); }

        if (fields.length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        query += fields.join(", ");
        query += " WHERE id = ?";
        updateParams.push(id);

        await pool.execute(query, updateParams);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("❌ Update DD Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ error: "DD Number already exists" }, { status: 400 });
        }
        return NextResponse.json({ error: error.message || "Failed to update record" }, { status: 500 });
    }
}
