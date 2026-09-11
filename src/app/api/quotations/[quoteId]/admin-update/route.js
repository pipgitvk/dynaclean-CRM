import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const STATE_CODE_TO_NAME = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  10: "Bihar",
  11: "Sikkim",
  12: "Arunachal Pradesh",
  13: "Nagaland",
  14: "Manipur",
  15: "Mizoram",
  16: "Tripura",
  17: "Meghalaya",
  18: "Assam",
  19: "West Bengal",
  20: "Jharkhand",
  21: "Odisha",
  22: "Chhattisgarh",
  23: "Madhya Pradesh",
  24: "Gujarat",
  25: "Daman & Diu",
  26: "Dadra & Nagar Haveli",
  27: "Maharashtra",
  28: "Andhra Pradesh (Old)",
  29: "Karnataka",
  30: "Goa",
  31: "Lakshadweep",
  32: "Kerala",
  33: "Tamil Nadu",
  34: "Puducherry",
  35: "Andaman & Nicobar Islands",
  36: "Telangana",
  37: "Andhra Pradesh",
  97: "Other Territory",
  99: "Centre Jurisdiction",
};

function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  const name = STATE_CODE_TO_NAME[code];
  if (!name) return null;
  return `${name} (${code})`;
}

export async function PATCH(req, { params }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET),
    ));
  } catch {
    return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
  }

  if (payload.role !== "SUPERADMIN") {
    return Response.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const { quoteId } = await params;
  if (!quoteId) {
    return Response.json({ success: false, message: "Missing quote number" }, { status: 400 });
  }

  const pool = await getDbConnection();
  let conn;
  let response;

  try {
    conn = await pool.getConnection();

    const [rows] = await conn.execute(
      "SELECT * FROM quotations_records WHERE quote_number = ?",
      [quoteId],
    );

    if (!rows.length) {
      response = Response.json(
        { success: false, message: "Quotation not found" },
        { status: 404 },
      );
      return response;
    }

    const quote = rows[0];

    const body = await req.json();

    if (!body.has_changes) {
      response = Response.json({
        success: true,
        message: "No changes made",
        created_new: false,
        customer_id: quote.customer_id,
      });
      return response;
    }

    const {
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
      round_off,
      grand_total,
      cgstRate,
      sgstRate,
      igstRate,
      quote_date,
    } = body;

    const effectiveState =
      state_name && String(state_name).trim()
        ? String(state_name).trim()
        : getStateFromGSTIN(gstin_no) || quote.state || null;

    const finalShipTo =
      ship_to !== undefined ? String(ship_to ?? "").trim() : quote.ship_to;
    if (ship_to !== undefined && !finalShipTo) {
      response = Response.json(
        { success: false, message: "Ship to address is required" },
        { status: 400 },
      );
      return response;
    }

    const finalCustomerId = quote.customer_id;

    await conn.beginTransaction();

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const todayPrefix = `QUOTE${dateStr}`;

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
        const lastQuote = existing[0].quote_number || "";
        const lastIncrement = parseInt(lastQuote.replace(todayPrefix, ""), 10);
        if (!Number.isNaN(lastIncrement)) increment = lastIncrement + 1;
      }

      finalQuoteNumber = `${todayPrefix}${increment.toString().padStart(3, "0")}`;

      try {
        await conn.execute(
          `INSERT INTO quotations_records
           (quote_number, quote_date, customer_id, company_name, company_address, state, gstin, ship_to, qty, gst, cgst_rate, sgst_rate, igst_rate, emp_name, subtotal, round_off, grand_total, term_con, payment_term_days, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            finalQuoteNumber,
            quote_date ?? quote.quote_date,
            finalCustomerId,
            company !== undefined ? String(company ?? "") : quote.company_name,
            company_location !== undefined
              ? String(company_location ?? "")
              : quote.company_address,
            effectiveState ?? quote.state,
            gstin_no !== undefined ? String(gstin_no ?? "") : quote.gstin,
            finalShipTo,
            items ? items.length : quote.qty,
            (cgst || 0) + (sgst || 0) + (igst || 0),
            cgstRate ?? quote.cgst_rate,
            sgstRate ?? quote.sgst_rate,
            igstRate ?? quote.igst_rate,
            payload.username,
            subtotal ?? quote.subtotal,
            round_off ?? quote.round_off ?? 0,
            grand_total ?? quote.grand_total,
            terms !== undefined ? String(terms ?? "") : quote.term_con,
            payment_term_days ?? quote.payment_term_days,
          ],
        );
        break;
      } catch (err) {
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

    if (items && Array.isArray(items) && items.length > 0) {
      const isInterstate = igstRate > 0;

      for (const item of items) {
        const taxable = (item.quantity || 0) * (item.price || 0);
        const gstAmt = taxable * ((item.gst || 0) / 100);
        const total = taxable + gstAmt;
        const cgstAmt = isInterstate ? 0 : gstAmt / 2;
        const sgstAmt = isInterstate ? 0 : gstAmt / 2;
        const igstAmt = isInterstate ? gstAmt : 0;

        await conn.execute(
          `INSERT INTO quotation_items
            (quote_number, item_code, item_name, hsn_sac, specification, quantity, unit,
             price_per_unit, taxable_price, total_taxable_amt, gst, total_price,
             cgsttax, cgsttxamt, sgsttax, sgstxamt, igsttax, igsttamt, img_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            finalQuoteNumber,
            item.productCode || item.item_code || "",
            item.name || item.item_name || "",
            item.hsn || item.hsn_sac || "",
            item.specification || "",
            item.quantity || 0,
            item.unit || "",
            item.price || item.price_per_unit || 0,
            taxable,
            taxable,
            item.gst || 0,
            total,
            isInterstate ? 0 : (item.gst || 0) / 2,
            cgstAmt,
            isInterstate ? 0 : (item.gst || 0) / 2,
            sgstAmt,
            isInterstate ? item.gst || 0 : 0,
            igstAmt,
            item.imageUrl || item.img_url || "",
          ],
        );
      }
    }

    await conn.commit();

    response = Response.json({
      success: true,
      message: "New quotation created successfully",
      created_new: true,
      new_quote_number: finalQuoteNumber,
      customer_id: finalCustomerId,
    });
    return response;
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore rollback errors */
      }
    }
    console.error("Admin quotation update error:", err);
    response = Response.json(
      { success: false, message: "Server error: " + err.message },
      { status: 500 },
    );
    return response;
  } finally {
    try {
      if (conn) conn.release();
    } catch {
      /* ignore release errors */
    }
  }
}
