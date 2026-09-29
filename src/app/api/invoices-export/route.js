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

    // WHERE clause builder
    let whereClause = "WHERE 1=1";
    const values = [];

    if (search) {
      whereClause += `
        AND (
          invoice_number LIKE ? OR
          customer_name LIKE ?
        )
      `;
      values.push(`%${search}%`, `%${search}%`);
    }

    if (fromDate) {
      whereClause += " AND COALESCE(order_date, invoice_date) >= ?";
      values.push(fromDate);
    }

    if (toDate) {
      whereClause += " AND COALESCE(order_date, invoice_date) <= ?";
      values.push(toDate);
    }

    conn = await getDbConnection();

    // Fetch all invoices
    const [rows] = await conn.execute(
      `
      SELECT
        id,
        invoice_number,
        COALESCE(order_date, invoice_date) AS order_date,
        customer_name as buyer_name,
        gst_number,
        employee_name,
        COALESCE(cgst, 0) AS cgst,
        COALESCE(sgst, 0) AS sgst,
        COALESCE(igst, 0) AS igst,
        grand_total,
        created_at
      FROM invoices
      ${whereClause}
      ORDER BY created_at DESC
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
            rate as price_per_unit
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
      { header: "Buyer Name", key: "buyer_name", width: 20 },
      { header: "GSTIN", key: "gst_number", width: 18 },
      { header: "Employee Name", key: "employee_name", width: 18 },
      { header: "Created At", key: "created_at", width: 15 },
      { header: "Tax Amount", key: "tax_amount", width: 15 },
      { header: "Taxable Amt", key: "taxable_amount", width: 15 },
      { header: "Grand Total", key: "grand_total", width: 15 },
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
            created_at: inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-",
            tax_amount: inv.tax_amount || 0,
            taxable_amount: item.taxable_value || 0,
            grand_total: inv.grand_total || 0,
            hsn_code: item.hsn_code || "-",
            quantity: item.quantity || 0,
            taxable_value: item.taxable_value || 0,
            cgst_amount: item.cgst_amount || 0,
            sgst_amount: item.sgst_amount || 0,
            igst_amount: item.igst_amount || 0,
          });
        });
      } else {
        worksheet.addRow({
          id: inv.id,
          invoice_number: inv.invoice_number || "-",
          buyer_name: inv.buyer_name || "-",
          gst_number: inv.gst_number || "-",
          employee_name: inv.employee_name || "-",
          created_at: inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-IN") : "-",
          tax_amount: inv.tax_amount || 0,
          taxable_amount: 0,
          grand_total: inv.grand_total || 0,
          hsn_code: "-",
          quantity: 0,
          taxable_value: 0,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: 0,
        });
      }
    });

    // Format numbers
    worksheet.columns.forEach((col) => {
      if (["tax_amount", "taxable_amount", "taxable_value", "cgst_amount", "sgst_amount", "igst_amount", "grand_total"].includes(col.key)) {
        col.numFmt = "₹#,##0.00";
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as downloadable file
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
