import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  canAccessDigitalMarketerLeadsModule,
  isDmModuleOnlyAssigneeUsername,
} from "@/lib/digitalMarketerLeadsAuth";
import { normalizePhone, PHONE_LAST10_WHERE } from "@/lib/phone-check";

const MAX_ROWS = 500;

const ASSIGNABLE_ROLE_SQL = `userRole IN ('SALES', 'ADMIN', 'BACK OFFICE', 'SALES HEAD', 'GEM PORTAL')`;

async function isValidAssignee(connection, username) {
  if (!username || !String(username).trim()) return false;
  const [r] = await connection.execute(
    `SELECT username FROM rep_list WHERE status = 1 AND username = ? AND ${ASSIGNABLE_ROLE_SQL}`,
    [String(username).trim()],
  );
  return r.length > 0;
}

export async function POST(request) {
  let connection;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = payload.role ?? payload.userRole;
    if (!canAccessDigitalMarketerLeadsModule(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { rows, employee_username: defaultEmployee } = body;

    if (!isDmModuleOnlyAssigneeUsername(defaultEmployee)) {
      return NextResponse.json(
        { error: "Bulk upload in this module only assigns leads to KAVYA." },
        { status: 400 },
      );
    }

    const assignedTo = String(defaultEmployee).trim();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ROWS} rows per upload` },
        { status: 400 },
      );
    }

    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const results = {
      inserted: 0,
      skipped: 0,
      errors: [],
    };

    const now = new Date();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        if (!row.first_name || !row.first_name.toString().trim()) {
          results.errors.push({
            row: rowNum,
            phone: row.phone,
            reason: "Missing first_name",
          });
          continue;
        }

        const phone = normalizePhone(row.phone);
        if (!phone || phone.length !== 10) {
          results.errors.push({
            row: rowNum,
            phone: row.phone,
            reason: "Invalid or missing phone (must be 10 digits)",
          });
          continue;
        }

        const [dupRows] = await connection.execute(
          `SELECT COUNT(*) AS c FROM customers WHERE ${PHONE_LAST10_WHERE}`,
          [phone],
        );
        if (dupRows[0].c > 0) {
          results.skipped++;
          results.errors.push({
            row: rowNum,
            phone,
            reason: "Duplicate phone — skipped",
          });
          continue;
        }

        const okAssignee = await isValidAssignee(connection, assignedTo);
        if (!okAssignee) {
          results.errors.push({
            row: rowNum,
            phone,
            reason: `Invalid employee: ${assignedTo}`,
          });
          continue;
        }

        const first_name = row.first_name.toString().trim();
        const last_name = row.last_name?.toString().trim() || "";
        const email = row.email?.toString().trim() || "";
        const company = row.company?.toString().trim() || "";
        const address = row.address?.toString().trim() || "";
        const lead_campaign = row.lead_campaign?.toString().trim() || "Unknown";
        const products_interest =
          row.products_interest?.toString().trim() || "Other";
        const tags = row.tags?.toString().trim() || "Other";
        const notes = row.notes?.toString().trim() || "";

        const [customerResult] = await connection.execute(
          `INSERT INTO customers (
            first_name, last_name, email, phone, address, company,
            lead_source, lead_campaign, status,
            followup_notes, communication_history, products_interest,
            sales_representative, assigned_to, tags, notes,
            next_follow_date, date_created
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            first_name,
            last_name,
            email,
            phone,
            address,
            company,
            assignedTo,
            lead_campaign,
            "New",
            "",
            "",
            products_interest,
            assignedTo,
            payload.username,
            tags,
            notes,
            now,
            now,
          ],
        );

        const customerId = customerResult.insertId;

        await connection.execute(
          `INSERT INTO customers_followup (
            customer_id, name, contact, next_followup_date,
            followed_by, followed_date, communication_mode, notes, email
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            customerId,
            first_name,
            phone,
            now,
            assignedTo,
            now,
            "Unknown",
            notes || "Bulk uploaded lead",
            email,
          ],
        );

        results.inserted++;
      } catch (rowErr) {
        console.error(`DM bulk row ${rowNum}:`, rowErr);
        results.errors.push({
          row: rowNum,
          phone: row.phone,
          reason: rowErr.message || "Insert failed",
        });
      }
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      inserted: results.inserted,
      skipped: results.skipped,
      errors: results.errors,
      total: rows.length,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("digital-marketer-leads bulk-upload:", error);
    return NextResponse.json(
      { error: error.message || "Bulk upload failed" },
      { status: 500 },
    );
  } finally {
    if (connection) connection.release();
  }
}
