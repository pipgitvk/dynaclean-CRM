


import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

/**
 * Extract state code from GSTIN and return state info
 * GSTIN format: 2-digit state code + 2-digit PAN + 5 zeros
 */
function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const stateCode = parseInt(gstin.substring(0, 2), 10);
  
  // Map of state codes to state info
  const stateMap = {
    1: { name: 'Jammu & Kashmir', code: '01' },
    2: { name: 'Himachal Pradesh', code: '02' },
    3: { name: 'Punjab', code: '03' },
    4: { name: 'Chandigarh', code: '04' },
    5: { name: 'Uttarakhand', code: '05' },
    6: { name: 'Haryana', code: '06' },
    7: { name: 'Delhi', code: '07' },
    8: { name: 'Rajasthan', code: '08' },
    9: { name: 'Uttar Pradesh', code: '09' },
    10: { name: 'Bihar', code: '10' },
    11: { name: 'Jharkhand', code: '11' },
    12: { name: 'Odisha', code: '12' },
    13: { name: 'West Bengal', code: '13' },
    14: { name: 'Assam', code: '14' },
    15: { name: 'Meghalaya', code: '15' },
    16: { name: 'Manipur', code: '16' },
    17: { name: 'Mizoram', code: '17' },
    18: { name: 'Nagaland', code: '18' },
    19: { name: 'Tripura', code: '19' },
    20: { name: 'Sikkim', code: '20' },
    21: { name: 'Arunachal Pradesh', code: '21' },
    22: { name: 'Telangana', code: '22' },
    23: { name: 'Andhra Pradesh', code: '23' },
    24: { name: 'Karnataka', code: '24' },
    25: { name: 'Tamil Nadu', code: '25' },
    26: { name: 'Telangana', code: '26' },
    27: { name: 'Kerala', code: '27' },
    28: { name: 'Maharashtra', code: '28' },
    29: { name: 'Gujarat', code: '29' },
    30: { name: 'Goa', code: '30' },
    31: { name: 'Lakshadweep', code: '31' },
    32: { name: 'Puducherry', code: '32' },
    33: { name: 'Andaman & Nicobar', code: '33' },
    34: { name: 'Telangana', code: '34' },
    35: { name: 'Ladakh', code: '35' },
    36: { name: 'Dadra & Nagar Haveli', code: '36' },
    37: { name: 'Daman & Diu', code: '37' },
  };
  
  return stateMap[stateCode] || null;
}

/**
 * Ensures `S.No.` is AUTO_INCREMENT so it gets populated on every insert.
 * Column name in DB is literally "S.No." (with dot and space).
 */
async function fixSnoSchemaIfNeeded(conn) {
  try {
    // Check current "S.No." column definition
    const [colInfo] = await conn.execute(
      `SELECT COLUMN_KEY, EXTRA 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'quotations_records' 
         AND COLUMN_NAME = 'S.No.'`
    );

    if (colInfo.length === 0) return; // column doesn't exist, nothing to fix

    const isPK = colInfo[0].COLUMN_KEY === 'PRI';
    const hasAutoIncrement = (colInfo[0].EXTRA || '').toLowerCase().includes('auto_increment');

    if (hasAutoIncrement) return; // already correct, skip

    if (isPK) {
      console.warn("⚠️ S.No. is PRIMARY KEY without AUTO_INCREMENT — fixing...");
      await conn.execute(`ALTER TABLE quotations_records DROP PRIMARY KEY`);
      console.log("✅ Dropped S.No. PRIMARY KEY");
    }

    // Add UNIQUE on quote_number if not already there
    const [qConstraints] = await conn.execute(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations_records' 
       AND COLUMN_NAME = 'quote_number' AND CONSTRAINT_NAME != 'PRIMARY'`
    );
    if (qConstraints.length === 0) {
      await conn.execute(`ALTER TABLE quotations_records ADD UNIQUE KEY uk_quote_number (quote_number(100))`);
      console.log("✅ Added UNIQUE constraint to quote_number");
    }

    // Make S.No. AUTO_INCREMENT UNIQUE (not PK)
    await conn.execute("ALTER TABLE quotations_records MODIFY `S.No.` INT NOT NULL AUTO_INCREMENT UNIQUE");
    console.log("✅ S.No. is now AUTO_INCREMENT UNIQUE");
  } catch (err) {
    console.error("❌ Schema auto-fix failed:", err.message);
    // Don't throw — let the insert attempt proceed and surface its own error
  }
}

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
      round_off,
      grand_total,
      cgstRate,
      sgstRate,
      igstRate,
    } = body;

    const pool = await getDbConnection();
    conn = await pool.getConnection();

    // Auto-fix s_no schema issue (renamed from "S. NO." — may still be PK)
    await fixSnoSchemaIfNeeded(conn);

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
        // First calculate rates from items if needed
        let headerCgstRate = cgstRate || 0;
        let headerSgstRate = sgstRate || 0;
        let headerIgstRate = igstRate || 0;
        
        // If form rates are all 0, derive from first item's GST
        if ((cgstRate === 0 || cgstRate === undefined) && (sgstRate === 0 || sgstRate === undefined) && (igstRate === 0 || igstRate === undefined)) {
          if (items.length > 0 && items[0].gst) {
            const itemGst = items[0].gst;
            const hasGstin = gstin_no?.trim();
            
            if (hasGstin) {
              // Extract state code from GSTIN (first 2 digits)
              const gstinStateCode = gstin_no.substring(0, 2);
              const supplierStateCode = "07"; // Delhi - hardcoded from company info
              
              // Compare state codes to determine if interstate or intrastate
              if (gstinStateCode === supplierStateCode) {
                // Same state - intrastate: split CGST and SGST (each 50%)
                headerCgstRate = itemGst / 2;
                headerSgstRate = itemGst / 2;
                headerIgstRate = 0;
              } else {
                // Different state - interstate: IGST only (full tax %)
                headerCgstRate = 0;
                headerSgstRate = 0;
                headerIgstRate = itemGst;
              }
            } else {
              // No GSTIN - intrastate: split CGST and SGST (each 50%)
              headerCgstRate = itemGst / 2;
              headerSgstRate = itemGst / 2;
              headerIgstRate = 0;
            }
          }
        }

        // Try inserting the header row
        await conn.execute(
          `INSERT INTO quotations_records 
           (quote_number, quote_date, customer_id, company_name, company_address, state, gstin, ship_to, qty, gst, cgst_rate, sgst_rate, igst_rate, emp_name, subtotal, round_off, grand_total, term_con, payment_term_days, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
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
            headerCgstRate,
            headerSgstRate,
            headerIgstRate,
            username,
            subtotal,
            round_off || 0,
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
      const taxable_price = item.taxable_amount;
      const gstItem = item.gst ?? 0;
      
      // Calculate split GST rates and amounts
      let calcCgstRate = 0, calcSgstRate = 0, calcIgstRate = 0;
      let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
      
      // Check if GSTIN is provided from request body
      const hasGstin = gstin_no?.trim();
      
      if (hasGstin) {
        // With GSTIN: Check if intrastate or interstate using state code comparison
        const gstinStateCode = gstin_no.substring(0, 2);
        const supplierStateCode = "07"; // Delhi
        
        if (gstinStateCode === supplierStateCode) {
          // Intrastate: Split CGST and SGST (each 50%)
          calcCgstRate = gstItem / 2;
          calcSgstRate = gstItem / 2;
          cgstAmt = (taxable_price * calcCgstRate) / 100;
          sgstAmt = (taxable_price * calcSgstRate) / 100;
        } else {
          // Interstate: IGST only (full tax %)
          calcIgstRate = gstItem;
          igstAmt = (taxable_price * calcIgstRate) / 100;
        }
      } else {
        // Without GSTIN: Split CGST and SGST (each 50%)
        calcCgstRate = gstItem / 2;
        calcSgstRate = gstItem / 2;
        cgstAmt = (taxable_price * calcCgstRate) / 100;
        sgstAmt = (taxable_price * calcSgstRate) / 100;
      }
      
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
          calcCgstRate,
          cgstAmt,
          calcSgstRate,
          sgstAmt,
          calcIgstRate,
          igstAmt,
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
