import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import ExcelJS from "exceljs";

const JWT_SECRET = process.env.JWT_SECRET;

/** ExcelJS cells: rich text, formula result, hyperlink */
function normalizeCellValue(val) {
  if (val == null || val === "") return null;
  if (val instanceof Date) return val;
  if (typeof val === "object") {
    if (val.richText && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text || "").join("").trim() || null;
    }
    if (val.text != null) return String(val.text).trim() || null;
    if (val.result != null) return normalizeCellValue(val.result);
    if (val.hyperlink != null && val.text != null) return String(val.text).trim() || null;
  }
  return val;
}

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseDate(val) {
  const raw = normalizeCellValue(val);
  if (raw == null || raw === "") return null;
  // Excel serial date (number of days since 1899-12-30)
  if (typeof raw === "number" && raw > 0) {
    const d = new Date((raw - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  // Date object from ExcelJS — calendar date in local timezone
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const day = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(raw).trim();
  if (!s || s === "-" || s.toLowerCase() === "null") return null;
  // Excel serial as string (e.g. "44927")
  const serial = Number(s);
  if (!isNaN(serial) && serial > 10000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  // DD/MMM/YYYY or DD-MMM-YYYY (e.g. 15/Apr/2026)
  const dmyText = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3,9})[\/\-](\d{4})$/i);
  if (dmyText) {
    const [, dayStr, monStr, yearStr] = dmyText;
    const monKey = monStr.slice(0, 3).toLowerCase();
    const month = MONTH_MAP[monKey];
    if (month) {
      const d = new Date(Number(yearStr), month - 1, Number(dayStr));
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }
    }
  }
  // DD/MM/YYYY or DD-MM-YYYY (numeric month)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  if (debitAmt > 0 && creditAmt > 0) {
    return debitAmt >= creditAmt
      ? { type: "Debit", amount: debitAmt }
      : { type: "Credit", amount: creditAmt };
  }
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
    let parseSkipped = []; // rows rejected during parsing (missing fields)

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
          if (idx != null && cells[idx] != null) return normalizeCellValue(cells[idx]);
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
        const balanceRaw = getCol(cells, [
          "balance",
          "bal",
          "running_balance",
          "closing_balance",
          "available_balance",
          "closingbal",
        ]);
        const balanceVal = parseAmount(balanceRaw);
        const hasClosingBal =
          balanceRaw != null &&
          String(balanceRaw).trim() !== "" &&
          String(balanceRaw).trim() !== "-";
        if (!date || !transId || !ta) {
          const missing = [];
          if (!date) missing.push("Date");
          if (!transId) missing.push("Trans ID");
          if (!ta) missing.push("Amount/Type");
          parseSkipped.push({
            row: i + 1,
            trans_id: transId || "-",
            date: getCol(cells, ["date", "txn_date", "transaction_date", "value_date"]) || "-",
            description: description || "-",
            reason: `Missing required fields: ${missing.join(", ")}`,
          });
          continue;
        }
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
          closing_balance: hasClosingBal ? balanceVal : null,
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
          if (idx != null && vals[idx] != null) return normalizeCellValue(vals[idx]);
        }
        return null;
      };
      for (let i = 1; i < dataRows.length; i++) {
        const vals = dataRows[i]?.values || [];
        const anyCell = vals.slice(1).some((cell) => {
          const n = normalizeCellValue(cell);
          return n != null && String(n).trim() !== "" && String(n).trim() !== "-";
        });
        if (!anyCell) continue;

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
        const balanceRaw = getCol(vals, [
          "balance",
          "bal",
          "running_balance",
          "closing_balance",
          "available_balance",
          "closingbal",
        ]);
        const balanceVal = parseAmount(balanceRaw);
        const hasClosingBal =
          balanceRaw != null &&
          String(balanceRaw).trim() !== "" &&
          String(balanceRaw).trim() !== "-";
        if (!date || !transId || !ta) {
          const missing = [];
          if (!date) missing.push("Date");
          if (!transId) missing.push("Trans ID");
          if (!ta) missing.push("Amount/Type");
          parseSkipped.push({
            row: i + 1,
            trans_id: transId || "-",
            date: String(getCol(vals, ["date", "txn_date", "transaction_date", "value_date"]) || "-"),
            description: description || "-",
            reason: `Missing required fields: ${missing.join(", ")}`,
          });
          continue;
        }
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
          closing_balance: hasClosingBal ? balanceVal : null,
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

    try {
      await conn.execute("SELECT closing_balance FROM statements LIMIT 1");
    } catch (_) {
      try {
        await conn.execute(
          "ALTER TABLE statements ADD COLUMN closing_balance DECIMAL(18,2) NULL"
        );
      } catch (__) {}
    }

    // Same Trans ID can appear twice in bank files (e.g. UGST + CGST split). DB has UNIQUE(trans_id).
    // Assign unique IDs: S123__2, S123__3 … so every row inserts instead of being skipped.
    const [existingTidRows] = await conn.execute("SELECT trans_id FROM statements");
    const usedTransIds = new Set(
      (existingTidRows || []).map((x) => String(x.trans_id || "").trim()).filter(Boolean)
    );
    const allocateUniqueTransId = (base) => {
      let tid = String(base || "").trim() || `IMP-${Date.now()}`;
      const orig = tid.slice(0, 85);
      let n = 1;
      while (usedTransIds.has(tid)) {
        n += 1;
        const suffix = `__${n}`;
        tid = `${orig.slice(0, Math.max(1, 100 - suffix.length))}${suffix}`;
      }
      usedTransIds.add(tid);
      return tid;
    };
    for (const r of rows) {
      r.trans_id = allocateUniqueTransId(r.trans_id);
    }

    let continuityWarning = null;

    // Soft continuity check — warning only, does NOT block import
    try {
      const [allRows] = await conn.execute(
        `SELECT id, date, type, amount FROM statements ORDER BY date ASC, id ASC`
      );
      if (allRows.length > 0) {
        let lastClosingBalance = 0;
        for (const r of allRows) {
          const amt = Number(r.amount || 0);
          lastClosingBalance += r.type === "Credit" ? amt : -amt;
        }
        const lastBalance = Math.round(lastClosingBalance * 100) / 100;
        const firstRow = rows[0];
        const firstType = firstRow.type || "Credit";
        const firstClosingBalance = Number(firstRow.balance ?? 0);
        const firstAmount = Number(firstRow.amount || 0);
        const firstOpeningBalance =
          firstType === "Debit"
            ? Math.round((firstClosingBalance + firstAmount) * 100) / 100
            : Math.round((firstClosingBalance - firstAmount) * 100) / 100;

        if (Math.abs(lastBalance - firstOpeningBalance) > 0.01) {
          continuityWarning = `Balance mismatch: DB closing balance ₹${lastBalance.toLocaleString("en-IN")} vs file opening balance ₹${firstOpeningBalance.toLocaleString("en-IN")} — import continued anyway`;
        }
      }
    } catch (_) {
      // ignore continuity check errors
    }

    let inserted = 0;
    let skipped = 0;
    const skippedRows = [...parseSkipped]; // start with parse-level skips

    for (const r of rows) {
      try {
        const [existing] = await conn.execute("SELECT id FROM statements WHERE trans_id = ?", [r.trans_id]);
        if (existing.length > 0) {
          skipped++;
          skippedRows.push({
            trans_id: r.trans_id,
            date: r.date,
            description: r.description || "-",
            type: r.type,
            amount: r.amount,
            reason: "Duplicate Trans ID (already exists)",
            rowData: r,
          });
          continue;
        }
        await conn.execute(
          `INSERT INTO statements (trans_id, date, txn_dated_deb, txn_posted_date, cheq_no, description, type, amount, closing_balance)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.trans_id,
            r.date,
            r.txn_dated_deb || null,
            r.txn_posted_date || null,
            r.cheq_no || null,
            r.description || null,
            r.type || "Credit",
            r.amount || 0,
            r.closing_balance != null ? Number(r.closing_balance) : null,
          ]
        );
        inserted++;
      } catch (e) {
        if (e?.code === "ER_DUP_ENTRY") {
          skipped++;
          skippedRows.push({
            trans_id: r.trans_id,
            date: r.date,
            description: r.description || "-",
            type: r.type,
            amount: r.amount,
            reason: "Duplicate Trans ID (already exists)",
            rowData: r,
          });
        } else throw e;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: rows.length,
      skipped_rows: skippedRows,
      warning: continuityWarning,
    });
  } catch (err) {
    console.error("[statements-import] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Import failed" }, { status: 500 });
  }
}
