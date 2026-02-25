import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const normalizePhone = (phone) => {
  if (!phone) return "";
  let cleaned = String(phone).replace(/[^\d]/g, "");
  if (cleaned.length > 10) cleaned = cleaned.slice(-10);
  return cleaned;
};

export async function POST(request) {
  let connection;
  try {
    // Auth check
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "SUPERADMIN"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { rows, mode, employee_username } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    if (mode === "manual" && !employee_username) {
      return NextResponse.json({ error: "employee_username is required for manual mode" }, { status: 400 });
    }

    const pool = await getDbConnection();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch rep queue for auto distribution
    let repQueue = [];
    let repIndex = 0;

    if (mode === "auto") {
      const [repRows] = await connection.execute(
        `SELECT username, priority, max_leads, assigned_count
         FROM lead_distribution
         ORDER BY priority ASC`
      );

      if (repRows.length === 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: "No reps configured in lead_distribution. Please set up lead distribution first." },
          { status: 400 }
        );
      }
      repQueue = repRows;
    }

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
        // Validate required fields
        if (!row.first_name || !row.first_name.toString().trim()) {
          results.errors.push({ row: rowNum, phone: row.phone, reason: "Missing first_name" });
          continue;
        }

        // Normalize phone
        const phone = normalizePhone(row.phone);
        if (!phone || phone.length !== 10) {
          results.errors.push({ row: rowNum, phone: row.phone, reason: "Invalid or missing phone (must be 10 digits)" });
          continue;
        }

        // Duplicate phone check
        const [dupRows] = await connection.execute(
          `SELECT COUNT(*) AS c FROM customers WHERE phone = ?`,
          [phone]
        );
        if (dupRows[0].c > 0) {
          results.skipped++;
          results.errors.push({ row: rowNum, phone, reason: "Duplicate phone — skipped" });
          continue;
        }

        // Determine assigned rep
        let assignedTo;

        if (mode === "manual") {
          assignedTo = employee_username;
        } else {
          // --- Language-based assignment (same as webhook logic) ---
          const normalizedLanguage = row.language?.toString().toUpperCase().trim();
          let assignedByLanguage = false;

          if (normalizedLanguage === "TAMIL") {
            const kavyaRep = repQueue.find(
              (r) => r.username.toUpperCase() === "KAVYA"
            );
            if (kavyaRep) {
              assignedTo = kavyaRep.username;
              kavyaRep.assigned_count++;
              assignedByLanguage = true;
              console.log(`🗣️ Tamil lead → assigned to ${kavyaRep.username}`);
            } else {
              console.warn("⚠️ KAVYA not found in lead_distribution — falling back to round-robin");
            }
          }

          // --- Round-robin fallback (if no language match) ---
          if (!assignedByLanguage) {
            let attempts = 0;
            while (attempts < repQueue.length) {
              const rep = repQueue[repIndex % repQueue.length];
              if (rep.max_leads === 0 || rep.assigned_count < rep.max_leads) {
                assignedTo = rep.username;
                repQueue[repIndex % repQueue.length].assigned_count++;
                repIndex++;
                break;
              }
              repIndex++;
              attempts++;
            }

            // If all reps are at max, reset and start from first
            if (!assignedTo) {
              repQueue.forEach((r) => (r.assigned_count = 0));
              repIndex = 0;
              assignedTo = repQueue[0].username;
              repQueue[0].assigned_count++;
              repIndex = 1;
            }
          }
        }

        const first_name = row.first_name.toString().trim();
        const last_name = row.last_name?.toString().trim() || "";
        const email = row.email?.toString().trim() || "";
        const company = row.company?.toString().trim() || "";
        const address = row.address?.toString().trim() || "";
        const lead_campaign = row.lead_campaign?.toString().trim() || "Unknown";
        const products_interest = row.products_interest?.toString().trim() || "Other";
        const tags = row.tags?.toString().trim() || "Other";
        const notes = row.notes?.toString().trim() || "";

        // Insert customer
        const [customerResult] = await connection.execute(
          `INSERT INTO customers (
            first_name, last_name, email, phone, address, company,
            lead_source, lead_campaign, status,
            followup_notes, communication_history, products_interest,
            sales_representative, assigned_to, tags, notes,
            next_follow_date, date_created
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            first_name, last_name, email, phone, address, company,
            assignedTo,         // lead_source
            lead_campaign,
            "New",              // status
            "",                 // followup_notes
            "",                 // communication_history
            products_interest,
            assignedTo,         // sales_representative
            payload.username,   // assigned_to = the admin who uploaded
            tags,
            notes,
            now,                // next_follow_date = today
            now,
          ]
        );

        const customerId = customerResult.insertId;

        // Insert initial followup record
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
          ]
        );

        results.inserted++;
      } catch (rowErr) {
        console.error(`Error inserting row ${rowNum}:`, rowErr);
        results.errors.push({ row: rowNum, phone: row.phone, reason: rowErr.message });
      }
    }

    // Update assigned_count in lead_distribution for auto mode
    if (mode === "auto" && repQueue.length > 0) {
      for (const rep of repQueue) {
        await connection.execute(
          `UPDATE lead_distribution SET assigned_count = ?, last_assigned_at = ? WHERE username = ?`,
          [rep.assigned_count, now, rep.username]
        );
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
    console.error("Bulk upload error:", error);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
