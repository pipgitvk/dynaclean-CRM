import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET(req) {
  let conn;

  try {
    const { searchParams } = new URL(req.url);

    // Filters
    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // WHERE clause builder (matches invoice-list route logic)
    let whereClause = "WHERE 1=1";
    const values = [];

    if (search) {
      whereClause += `
        AND (
          i.invoice_number LIKE ? OR
          i.customer_name LIKE ? OR
          i.gst_number LIKE ? OR
          i.employee_name LIKE ? OR
          ii.item_code LIKE ? OR
          ii.item_name LIKE ? OR
          ii.hsn_code LIKE ?
        )
      `;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (fromDate) {
      whereClause += " AND DATE(i.invoice_date) >= DATE(?)";
      values.push(fromDate);
    }

    if (toDate) {
      whereClause += " AND DATE(i.invoice_date) <= DATE(?)";
      values.push(toDate);
    }

    conn = await getDbConnection();

    // Fetch all matching invoices (using LEFT JOIN for search compatibility)
    const [rows] = await conn.execute(
      `
      SELECT DISTINCT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.customer_name AS buyer_name,
        i.gst_number,
        i.employee_name,
        COALESCE(i.cgst, 0) + COALESCE(i.sgst, 0) + COALESCE(i.igst, 0) AS tax_amount,
        i.grand_total,
        i.created_at
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      ${whereClause}
      ORDER BY i.created_at DESC
      `,
      values,
    );

    // Fetch items for each invoice
    const invoicesWithItems = await Promise.all(
      rows.map(async (invoice) => {
        const [items] = await conn.execute(
          `SELECT 
            item_code, 
            item_name, 
            quantity, 
            hsn_code, 
            taxable_value, 
            cgst_amount, 
            sgst_amount, 
            igst_amount,
            rate AS price_per_unit
          FROM invoice_items 
          WHERE invoice_id = ?`,
          [invoice.id]
        );
        return {
          ...invoice,
          items: items || []
        };
      })
    );

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Invoices");

    // Set columns
    worksheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Invoice Number", key: "invoice_number", width: 15 },
      { header: "Buyer Name", key: "buyer_name", width: 25 },
      { header: "GSTIN", key: "gst_number", width: 18 },
      { header: "Employee Name", key: "employee_name", width: 18 },
      { header: "Invoice Date", key: "invoice_date", width: 15 },
      { header: "Tax Amount", key: "tax_amount", width: 15 },
      { header: "Taxable Amt", key: "taxable_amount", width: 15 },
      { header: "Grand Total", key: "grand_total", width: 15 },
      { header: "Item Code", key: "item_code", width: 12 },
      { header: "Item Name", key: "item_name", width: 20 },
      { header: "HSN Code", key: "hsn_code", width: 12 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Taxable Value", key: "taxable_value", width: 15 },
      { header: "CGST", key: "cgst_amount", width: 12 },
      { header: "SGST", key: "sgst_amount", width: 12 },
      { header: "IGST", key: "igst_amount", width: 12 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };

    // Add rows with items
    invoicesWithItems.forEach((inv) => {
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach((item) => {
          worksheet.addRow({
            id: inv.id,
            invoice_number: inv.invoice_number || "-",
            buyer_name: inv.buyer_name || "-",
            gst_number: inv.gst_number || "-",
            employee_name: inv.employee_name || "-",
            invoice_date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("en-IN") : "-",
            tax_amount: Number(inv.tax_amount) || 0,
            taxable_amount: Number(item.taxable_value) || 0,
            grand_total: Number(inv.grand_total) || 0,
            item_code: item.item_code || "-",
            item_name: item.item_name || "-",
            hsn_code: item.hsn_code || "-",
            quantity: item.quantity || 0,
            taxable_value: Number(item.taxable_value) || 0,
            cgst_amount: Number(item.cgst_amount) || 0,
            sgst_amount: Number(item.sgst_amount) || 0,
            igst_amount: Number(item.igst_amount) || 0,
          });
        });
      } else {
        worksheet.addRow({
          id: inv.id,
          invoice_number: inv.invoice_number || "-",
          buyer_name: inv.buyer_name || "-",
          gst_number: inv.gst_number || "-",
          employee_name: inv.employee_name || "-",
          invoice_date: inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("en-IN") : "-",
          tax_amount: Number(inv.tax_amount) || 0,
          taxable_amount: 0,
          grand_total: Number(inv.grand_total) || 0,
          item_code: "-",
          item_name: "-",
          hsn_code: "-",
          quantity: 0,
          taxable_value: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
        });
      }
    });

    // Format number columns
    worksheet.columns.forEach((col) => {
      if (["tax_amount", "taxable_amount", "taxable_value", "cgst_amount", "sgst_amount", "igst_amount", "grand_total"].includes(col.key)) {
        col.numFmt = "#,##0.00";
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Invoices_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Invoice export API error:", err);

    return NextResponse.json(
      { error: "Failed to export invoices" },
      { status: 500 },
    );
  } finally {
    if (conn) conn.release?.();
  }
}
