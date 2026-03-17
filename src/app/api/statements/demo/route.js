import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import ExcelJS from "exceljs";

const JWT_SECRET = process.env.JWT_SECRET;

const DEMO_ROWS = [
  {
    trans_id: "DEMO001",
    date: "2026-01-15",
    txn_dated_deb: "2026-01-15",
    txn_posted_date: "2026-01-16",
    cheq_no: "CHQ123456",
    description: "Sample credit transaction",
    debit: "",
    credit: "10000.00",
    balance: "10000.00",
  },
  {
    trans_id: "DEMO002",
    date: "2026-01-16",
    txn_dated_deb: "2026-01-16",
    txn_posted_date: "2026-01-17",
    cheq_no: "",
    description: "Sample debit transaction",
    debit: "2500.00",
    credit: "",
    balance: "7500.00",
  },
  {
    trans_id: "DEMO003",
    date: "2026-01-18",
    txn_dated_deb: "2026-01-18",
    txn_posted_date: "2026-01-19",
    cheq_no: "CHQ789012",
    description: "Payment received",
    debit: "",
    credit: "20000.00",
    balance: "27500.00",
  },
];

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "xlsx";

    if (format === "csv") {
      const headers = ["trans_id", "date", "txn_dated_deb", "txn_posted_date", "cheq_no", "description", "debit", "credit", "balance"];
      const csv = [
        headers.join(","),
        ...DEMO_ROWS.map((r) =>
          headers.map((h) => {
            const v = r[h] || "";
            return typeof v === "string" && (v.includes(",") || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v;
          }).join(",")
        ),
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=statements_demo.csv",
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Statements", { views: [{ state: "frozen", ySplit: 2 }] });

    const headerNames = [
      "Trans ID",
      "Date",
      "Txn Dated Deb",
      "Txn Posted Date",
      "Cheq No",
      "Description",
      "Debit",
      "Credit",
      "Balance",
    ];
    const headerKeys = ["trans_id", "date", "txn_dated_deb", "txn_posted_date", "cheq_no", "description", "debit", "credit", "balance"];

    sheet.addRow(headerNames);
    DEMO_ROWS.forEach((r) => sheet.addRow(headerKeys.map((k) => r[k] ?? "")));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 14;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 24;
    sheet.getColumn(7).width = 12;
    sheet.getColumn(8).width = 12;
    sheet.getColumn(9).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=statements_demo.xlsx",
      },
    });
  } catch (err) {
    console.error("[statements-demo] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
