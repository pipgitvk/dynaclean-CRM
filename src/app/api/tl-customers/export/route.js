import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { fetchTLCustomersList } from "@/lib/fetchTLCustomersList";
import { applyTLCustomersChipFilter } from "@/lib/tlCustomersChipFilter";
import {
  TL_CUSTOMERS_EXPORT_COLUMNS,
  tlCustomerToExportRow,
} from "@/lib/tlCustomersExportRows";
import { normalizeSearchParam } from "@/lib/tlCustomersListSql";

export const dynamic = "force-dynamic";

function searchParamsFromUrl(url) {
  const sp = new URL(url).searchParams;
  const obj = {};
  for (const [key, value] of sp.entries()) {
    obj[key] = value;
  }
  return obj;
}

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const format = normalizeSearchParam(
      new URL(request.url).searchParams.get("format"),
    );
    if (format !== "excel" && format !== "pdf") {
      return NextResponse.json({ message: "Invalid format." }, { status: 400 });
    }

    const raw = searchParamsFromUrl(request.url);
    const activeFilter = normalizeSearchParam(raw.activeFilter) || "all";
    delete raw.format;
    delete raw.activeFilter;

    const conn = await getDbConnection();
    const { rows, showTLOnly, showPreBookingOnly, isSuperAdmin, filters } =
      await fetchTLCustomersList(conn, payload, raw, {
        mode: "full",
        paginate: false,
      });

    const filtered = applyTLCustomersChipFilter(rows, activeFilter, {
      tlOnly: showTLOnly,
      isSuperAdmin,
      statusFilter: filters.status,
      preBookingOnly: showPreBookingOnly,
    });

    const exportRows = filtered.map((c) =>
      tlCustomerToExportRow(c, { showTLOnly }),
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `tl-customers_${stamp}`;

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("TL Customers");
      sheet.columns = TL_CUSTOMERS_EXPORT_COLUMNS.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width,
      }));
      exportRows.forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const head = TL_CUSTOMERS_EXPORT_COLUMNS.map((c) => c.header);
    const body = exportRows.map((row) =>
      TL_CUSTOMERS_EXPORT_COLUMNS.map((c) => String(row[c.key] ?? "")),
    );
    autoTable(doc, {
      head: [head],
      body,
      styles: { fontSize: 6, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      margin: { top: 36, left: 12, right: 12 },
      didDrawPage: (data) => {
        doc.setFontSize(10);
        doc.text(`TL Customers (${exportRows.length} rows)`, 12, 24);
      },
    });
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[tl-customers/export]", error);
    return NextResponse.json({ message: "Export failed." }, { status: 500 });
  }
}
