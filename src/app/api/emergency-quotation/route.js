import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  let conn;
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = payload.username;
    const body = await req.json();

    const {
      quote_date,

      // 👇 Manual customer fields
      customer_name,
      customer_contact,
      customer_email,
      company,
      company_location,
      gstin_no,
      state_name,
      ship_to,

      terms,
      payment_term_days,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      grand_total,
      cgstRate,
      sgstRate,
      igstRate,
    } = body;

    const pool = await getDbConnection();
    conn = await pool.getConnection();

    // Auto-fix s_no schema issue (renamed from "S. NO." — may still be PK)
    try {
      const [keyInfo] = await conn.execute(
        `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' 
         AND COLUMN_NAME = 's_no' AND CONSTRAINT_NAME = 'PRIMARY'`
      );
      if (keyInfo.length > 0) {
        await conn.execute(`ALTER TABLE quotations_records DROP PRIMARY KEY`);
        const [qc] = await conn.execute(
          `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' 
           AND COLUMN_NAME = 'quote_number' AND CONSTRAINT_NAME != 'PRIMARY'`
        );
        if (qc.length === 0) {
          await conn.execute(`ALTER TABLE quotations_records ADD UNIQUE KEY uk_quote_number (quote_number(100))`);
        }
        await conn.execute(`ALTER TABLE quotations_records MODIFY s_no INT NOT NULL AUTO_INCREMENT UNIQUE`);
        console.log("✅ [emergency-quotation] s_no schema auto-fixed");
      }
    } catch (schemaErr) {
      console.error("❌ [emergency-quotation] Schema fix failed:", schemaErr.message);
    }

    await conn.beginTransaction();

    /* ---------------- Quote Number Generation ---------------- */
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const todayPrefix = `QUOTE${dateStr}`;
    const serverQuoteDate = quote_date || now.toISOString().split("T")[0];

    let attempt = 0;
    let finalQuoteNumber = "";

    while (attempt < 5) {
      const [existing] = await conn.execute(
        `SELECT quote_number FROM quotations_records
         WHERE quote_number LIKE ?
         ORDER BY quote_number DESC
         LIMIT 1`,
        [`${todayPrefix}%`],
      );

      let increment = 1;
      if (existing.length > 0) {
        const lastQuote = existing[0].quote_number;
        const lastInc = parseInt(lastQuote.replace(todayPrefix, ""), 10);
        if (!isNaN(lastInc)) increment = lastInc + 1;
      }

      finalQuoteNumber = `${todayPrefix}${increment
        .toString()
        .padStart(3, "0")}`;

      try {
        await conn.execute(
          `INSERT INTO quotations_records
           (quote_number, quote_date, customer_id,
            customer_name, customer_contact, customer_email,
            company_name, company_address, state, gstin, ship_to,
            qty, gst, emp_name, subtotal, grand_total,
            term_con, payment_term_days, created_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            finalQuoteNumber,
            serverQuoteDate,
            customer_name,
            customer_contact,
            customer_email,
            company,
            company_location,
            state_name,
            gstin_no,
            ship_to,
            items.length,
            cgst + sgst + igst,
            username,
            subtotal,
            grand_total,
            terms,
            payment_term_days ?? null,
          ],
        );
        break;
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
          attempt++;
          continue;
        }
        throw err;
      }
    }

    if (!finalQuoteNumber) {
      throw new Error("Quote number generation failed");
    }

    /* ---------------- Insert Items ---------------- */
    for (const item of items) {
      await conn.execute(
        `INSERT INTO quotation_items
         (quote_number, item_name, item_code, hsn_sac, specification,
          quantity, unit, price_per_unit, taxable_price,
          total_taxable_amt, gst, total_price,
          cgsttax, cgsttxamt, sgsttax, sgstxamt,
          igsttax, igsttamt, img_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          finalQuoteNumber,
          item.name ?? null,
          item.productCode ?? null,
          item.hsn ?? null,
          item.specification ?? null,
          item.quantity ?? 0,
          item.unit ?? null,
          item.price ?? 0,
          item.total_amount - item.taxable_amount,
          item.taxable_amount,
          item.gst ?? 0,
          item.total_amount,
          cgstRate,
          cgst,
          sgstRate,
          sgst,
          igstRate,
          item.IGSTamt ?? 0,
          item.imageUrl ?? null,
        ],
      );
    }

    await conn.commit();

    return NextResponse.json({
      success: true,
      quoteNumber: finalQuoteNumber,
    });
  } catch (err) {
    console.error("Emergency quotation error:", err);
    if (conn) await conn.rollback();
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  } finally {
    conn?.release?.();
  }
}
