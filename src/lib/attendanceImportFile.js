import ExcelJS from "exceljs";
import {
  normalizeImportHeaderCell,
  disambiguatePairHeaders,
  parseImportDateToYmd,
} from "@/lib/attendanceImportParse";

export const IMPORT_TIME_FIELDS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

export function cellValueToImportString(cellValue, fieldKey) {
  if (cellValue == null || cellValue === "") return "";
  if (
    fieldKey === "date" &&
    typeof cellValue === "number" &&
    Number.isFinite(cellValue) &&
    cellValue > 20000 &&
    cellValue < 100000
  ) {
    const base = new Date(1899, 11, 30);
    const d = new Date(base.getTime() + cellValue * 86400000);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-CA");
  }
  if (cellValue instanceof Date) {
    if (fieldKey === "date") {
      return cellValue.toLocaleDateString("en-CA");
    }
    return cellValue.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (typeof cellValue === "object" && cellValue.text != null) {
    return String(cellValue.text).trim();
  }
  if (typeof cellValue === "object" && cellValue.result != null) {
    return cellValueToImportString(cellValue.result, fieldKey);
  }
  return String(cellValue).trim();
}

export async function parseAttendanceImportFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) {
      throw new Error("CSV needs a header row and at least one data row.");
    }
    const headers = disambiguatePairHeaders(
      lines[0].split(",").map((h) => normalizeImportHeaderCell(h.trim()))
    );
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("#")) continue;
      const parts = line.split(",");
      if (parts.every((p) => !String(p).trim())) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = String(parts[idx] ?? "").trim();
      });
      rows.push(obj);
    }
    return rows;
  }

  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("No sheet found in workbook.");

  const hRow = sheet.getRow(1);
  const maxCol = hRow.cellCount;
  const headers = [];
  for (let c = 1; c <= maxCol; c++) {
    const raw = hRow.getCell(c).value;
    const text =
      raw == null
        ? ""
        : typeof raw === "object" && raw.text != null
          ? String(raw.text).trim()
          : String(raw).trim();
    headers.push(normalizeImportHeaderCell(text));
  }

  const headerKeys = disambiguatePairHeaders(headers);
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const col1 = cellValueToImportString(row.getCell(1).value, "username");
    if (col1.trim().startsWith("#")) return;
    const obj = {};
    let hasAny = false;
    for (let c = 1; c <= maxCol; c++) {
      const key = headerKeys[c - 1];
      if (!key) continue;
      const v = cellValueToImportString(row.getCell(c).value, key);
      if (v) hasAny = true;
      obj[key] = v;
    }
    if (hasAny) rows.push(obj);
  });
  return rows;
}

export function buildImportPayloadRows(parsed) {
  return parsed.map((obj) => {
    const row = {
      username: String(obj.username ?? "").trim(),
      date: parseImportDateToYmd(obj.date ?? ""),
    };
    for (const key of IMPORT_TIME_FIELDS) {
      const v = obj[key];
      if (v != null && String(v).trim() !== "") {
        row[key] = String(v).trim();
      }
    }
    if (obj.checkin_address != null && String(obj.checkin_address).trim() !== "") {
      row.checkin_address = String(obj.checkin_address).trim();
    }
    if (obj.checkout_address != null && String(obj.checkout_address).trim() !== "") {
      row.checkout_address = String(obj.checkout_address).trim();
    }
    return row;
  });
}
