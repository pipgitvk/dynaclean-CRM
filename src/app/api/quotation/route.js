


import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate unique quote number with daily sequential increment
    const pool = await getDbConnection();
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const quoteDate = date.toISOString().split('T')[0];

    // Find the highest quote number for today
    const todayPrefix = `QUOTE${dateStr}`;
    const [existing] = await pool.execute(
      `SELECT quote_number FROM quotations_records 
       WHERE quote_number LIKE ? 
       ORDER BY quote_number DESC 
       LIMIT 1`,
      [`${todayPrefix}%`]
    );

    let increment = 1;
    if (existing.length > 0) {
      // Extract the increment part from the last quote number
      const lastQuote = existing[0].quote_number;
      const lastIncrement = parseInt(lastQuote.replace(todayPrefix, ''), 10);
      if (!isNaN(lastIncrement)) {
        increment = lastIncrement + 1;
      }
    }

    // Format: QUOTE{YYYYMMDD}{001, 002, 003...}
    const quoteNumber = `${todayPrefix}${increment.toString().padStart(3, '0')}`;

    return NextResponse.json({ quoteNumber, quoteDate });
  } catch (error) {
    console.error('Generate quote number error:', error);
    return NextResponse.json({ error: 'Failed to generate quote number' }, { status: 500 });
  }
}

export async function POST(req) {
  let conn;
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const username = payload.username;

    const body = await req.json();

    const {
      // quote_number from client is treated as a hint only; server will ensure uniqueness
      quote_date,
      company,
      company_location,
      gstin_no,
      state_name,
      ship_to,
      customer_id,
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

    await conn.beginTransaction();

    // Generate a unique quote number at submit time (no extra tables)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
    const todayPrefix = `QUOTE${dateStr}`;
    const serverQuoteDate = quote_date || now.toISOString().split("T")[0];

    let attempt = 0;
    let finalQuoteNumber = "";
    while (attempt < 5) {
      // Find highest quote number for today
      const [existing] = await conn.execute(
        `SELECT quote_number FROM quotations_records 
         WHERE quote_number LIKE ? 
         ORDER BY quote_number DESC 
         LIMIT 1`,
        [`${todayPrefix}%`]
      );

      let increment = 1;
      if (existing.length > 0) {
        const lastQuote = existing[0].quote_number || "";
        const lastIncrement = parseInt(lastQuote.replace(todayPrefix, ""), 10);
        if (!Number.isNaN(lastIncrement)) increment = lastIncrement + 1;
      }

      finalQuoteNumber = `${todayPrefix}${increment.toString().padStart(3, "0")}`;

      try {
        // Try inserting the header row
        await conn.execute(
          `INSERT INTO quotations_records 
           (quote_number, quote_date, customer_id, company_name, company_address, state, gstin, ship_to, qty, gst, emp_name, subtotal, grand_total, term_con, payment_term_days, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            finalQuoteNumber,
            serverQuoteDate,
            customer_id,
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
          ]
        );
        // Success, break retry loop
        break;
      } catch (err) {
        // If unique constraint exists and we hit duplicate, retry with next seq
        if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
          attempt += 1;
          continue;
        }
        throw err;
      }
    }

    if (!finalQuoteNumber) {
      throw new Error("Failed to generate unique quote number");
    }

    // Insert quotation_items for each item
    for (let item of items) {
      const item_name = item.name ?? null;
      const item_code = item.productCode ?? null;
      const hsn_sac = item.hsn ?? null;
      const specification = item.specification ?? null;
      const quantity = item.quantity ?? 0;
      const unit = item.unit ?? null;
      const price_per_unit = item.price ?? 0;
      const taxable_price = item.total_amount - item.taxable_amount;
      const gstItem = item.gst ?? 0;
      const igsttamt = item.IGSTamt ?? 0;
      const total_taxable_amt = item.taxable_amount;
      const total_price = item.total_amount;
      const img_url = item.imageUrl ?? null;

      await conn.execute(
        `INSERT INTO quotation_items 
         (quote_number, item_name, item_code, hsn_sac, specification, quantity, unit, price_per_unit, taxable_price, total_taxable_amt, gst, total_price, cgsttax, cgsttxamt, sgsttax, sgstxamt, igsttax, igsttamt, img_url, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          finalQuoteNumber,
          item_name,
          item_code,
          hsn_sac,
          specification,
          quantity,
          unit,
          price_per_unit,
          taxable_price,
          total_taxable_amt,
          gstItem,
          total_price,
          cgstRate,
          cgst,
          sgstRate,
          sgst,
          igstRate,
          igsttamt,
          img_url,
        ]
      );
    }

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Quotation submission error:", e);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  } finally {
    try { conn?.release?.(); } catch { }
  }
}
