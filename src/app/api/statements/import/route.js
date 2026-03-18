import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import ExcelJS from "exceljs";

const JWT_SECRET = process.env.JWT_SECRET;

function parseDate(val) {
  if (val == null || val === "") return null;
  // Excel serial date (number of days since 1899-12-30)
  if (typeof val === "number" && val > 0) {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Date object from Excel
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s || s === "-" || s.toLowerCase() === "null") return null;
  // Excel serial as string (e.g. "44927")
  const serial = Number(s);
  if (!isNaN(serial) && serial > 10000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // DD/MM/YYYY or DD-MM-YYYY (India format)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseAmount(val) {
  if (val == null || val === "") return 0;
  const n = Number(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseType(val) {
  const s = String(val || "").trim().toLowerCase();
  if (s.startsWith("deb") || s === "dr" || s === "debit") return "Debit";
  return "Credit";
}

function getTypeAndAmountFromDebitCredit(debitVal, creditVal, typeVal, amountVal) {
  const debitAmt = parseAmount(debitVal);
  const creditAmt = parseAmount(creditVal);
  if (debitAmt > 0 && creditAmt > 0) return null;
  if (debitAmt > 0) return { type: "Debit", amount: debitAmt };
  if (creditAmt > 0) return { type: "Credit", amount: creditAmt };
  const amt = parseAmount(amountVal);
  if (amt > 0) return { type: parseType(typeVal), amount: amt };
  return null;
}

export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = (file.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";

    let rows = [];

    if (ext === "csv" || file.type === "text/csv") {
      const text = buffer.toString("utf-8");
      const parseCSVLine = (line) => {
        const out = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            inQuotes = !inQuotes;
          } else if (c === "," && !inQuotes) {
            out.push(cur.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
            cur = "";
          } else {
            cur += c;
          }
        }
        out.push(cur.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
        return out;
      };
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        return NextResponse.json({ error: "CSV must have header and at least one row" }, { status: 400 });
      }
      const headerCells = parseCSVLine(lines[0]);
      const headers = headerCells.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const headerMap = {};
      headers.forEach((h, i) => {
        headerMap[h] = i;
        headerMap[h.replace(/_/g, "")] = i;
      });
      const getCol = (cells, keys) => {
        for (const k of keys) {
          const idx = headerMap[k];
          if (idx != null && cells[idx] != null) return cells[idx];
        }
        return null;
      };
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        const transId = getCol(cells, ["trans_id", "transid", "transaction_id"]) || `IMP-${Date.now()}-${i}`;
        const date = parseDate(getCol(cells, ["date", "txn_date", "transaction_date", "value_date", "transactiondate"]));
        const txnDatedDeb = parseDate(getCol(cells, ["txn_dated_deb", "txndateddeb", "txn_dated", "datedeb"]));
        const txnPostedDate = parseDate(getCol(cells, ["txn_posted_date", "txnposteddate", "posted_date", "posting_date", "posteddate"]));
        const cheqNo = getCol(cells, ["cheq_no", "cheqno", "cheque_no"]) || null;
        const description = getCol(cells, ["description", "desc", "remarks"]) || "";
        const ta = getTypeAndAmountFromDebitCredit(
          getCol(cells, ["debit"]),
          getCol(cells, ["credit"]),
          getCol(cells, ["type", "credit_debit", "dr_cr"]),
          getCol(cells, ["amount", "amt"])
        );
        const balanceVal = parseAmount(getCol(cells, ["balance", "bal"]));
        if (!date || !transId || !ta) continue;
        rows.push({
          trans_id: transId,
          date,
          txn_dated_deb: txnDatedDeb,
          txn_posted_date: txnPostedDate,
          cheq_no: cheqNo,
          description,
          type: ta.type,
          amount: ta.amount,
          balance: balanceVal,
        });
      }
    } else if (["xlsx", "xls"].includes(ext) || file.type?.includes("spreadsheet")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return NextResponse.json({ error: "No worksheet found" }, { status: 400 });
      }
      const dataRows = [];
      sheet.eachRow((row, rowNumber) => {
        const vals = row.values || [];
        dataRows.push({ rowNumber, values: vals });
      });
      if (dataRows.length < 2) {
        return NextResponse.json({ error: "Excel must have header and at least one row" }, { status: 400 });
      }
      const headerRow = dataRows[0]?.values || [];
      const headers = headerRow.slice(1).map((h, i) => String(h || "").trim().toLowerCase().replace(/\s+/g, "_"));
      const headerMap = {};
      headers.forEach((h, i) => {
        const idx = i + 1;
        if (h) headerMap[h] = idx;
        if (h) headerMap[h.replace(/_/g, "")] = idx;
      });
      const getCol = (vals, keys) => {
        for (const k of keys) {
          const idx = headerMap[k];
          if (idx != null && vals[idx] != null) return vals[idx];
        }
        return null;
      };
      for (let i = 1; i < dataRows.length; i++) {
        const vals = dataRows[i]?.values || [];
        const transId = getCol(vals, ["trans_id", "transid", "transaction_id"]) || `IMP-${Date.now()}-${i}`;
        const date = parseDate(getCol(vals, ["date", "txn_date", "transaction_date", "value_date", "transactiondate"]));
        const txnDatedDeb = parseDate(getCol(vals, ["txn_dated_deb", "txndateddeb", "txn_dated", "datedeb"]));
        const txnPostedDate = parseDate(getCol(vals, ["txn_posted_date", "txnposteddate", "posted_date", "posting_date", "posteddate"]));
        const cheqNo = getCol(vals, ["cheq_no", "cheqno", "cheque_no"]) || null;
        const description = getCol(vals, ["description", "desc", "remarks"]) || "";
        const ta = getTypeAndAmountFromDebitCredit(
          getCol(vals, ["debit"]),
          getCol(vals, ["credit"]),
          getCol(vals, ["type", "credit_debit", "dr_cr"]),
          getCol(vals, ["amount", "amt"])
        );
        const balanceVal = parseAmount(getCol(vals, ["balance", "bal"]));
        if (!date || !transId || !ta) continue;
        rows.push({
          trans_id: transId,
          date,
          txn_dated_deb: txnDatedDeb,
          txn_posted_date: txnPostedDate,
          cheq_no: cheqNo,
          description,
          type: ta.type,
          amount: ta.amount,
          balance: balanceVal,
        });
      }
    } else if (ext === "pdf" || file.type === "application/pdf") {
      return NextResponse.json({
        error: "PDF import is not supported. Please use CSV or Excel (.xlsx) format. Download the demo file for the correct format.",
      }, { status: 400 });
    } else {
      return NextResponse.json({
        error: "Unsupported format. Use CSV or Excel (.xlsx). Download demo file for correct format.",
      }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Validation: last record (type + balance) must match first row of import
    const [allRows] = await conn.execute(
      `SELECT id, date, type, amount FROM statements ORDER BY date ASC, id ASC`
    );
    if (allRows.length > 0) {
      // Compute last record's closing balance (Debit = -, Credit = +)
      let lastClosingBalance = 0;
      for (const r of allRows) {
        const amt = Number(r.amount || 0);
        lastClosingBalance += r.type === "Credit" ? amt : -amt;
      }
      const lastBalance = Math.round(lastClosingBalance * 100) / 100;

      // First row of import: balance in file is closing balance after that tx
      // Opening balance = closing + amount (Debit) or closing - amount (Credit)
      const firstRow = rows[0];
      const firstType = firstRow.type || "Credit";
      const firstClosingBalance = Number(firstRow.balance ?? 0);
      const firstAmount = Number(firstRow.amount || 0);
      const firstOpeningBalance =
        firstType === "Debit"
          ? Math.round((firstClosingBalance + firstAmount) * 100) / 100
          : Math.round((firstClosingBalance - firstAmount) * 100) / 100;

      if (Math.abs(lastBalance - firstOpeningBalance) > 0.01) {
        return NextResponse.json(
          {
            error: `Import rejected: Last balance (₹${lastBalance.toLocaleString("en-IN")}) does not match first row opening balance (₹${firstOpeningBalance.toLocaleString("en-IN")}). Ensure continuity.`,
          },
          { status: 400 }
        );
      }
    }

    let inserted = 0;
    let skipped = 0;
    for (const r of rows) {
      try {
        const [existing] = await conn.execute("SELECT id FROM statements WHERE trans_id = ?", [r.trans_id]);
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        await conn.execute(
          `INSERT INTO statements (trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.trans_id,
            r.date,
            r.txn_dated_deb || null,
            r.txn_posted_date || null,
            r.cheq_no || null,
            r.description || null,
            r.type || "Credit",
            r.amount || 0,
          ]
        );
        inserted++;
      } catch (e) {
        if (e?.code === "ER_DUP_ENTRY") skipped++;
        else throw e;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: rows.length,
    });
  } catch (err) {
    console.error("[statements-import] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Import failed" }, { status: 500 });
  }
}
