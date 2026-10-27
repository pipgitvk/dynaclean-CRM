import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
    try {
        const { from, to, employee } = await req.json();

        let dateFilter = "";
        const params = [];

        if (from && to) {
            dateFilter = "AND n.invoice_date BETWEEN ? AND ?";
            params.push(from, to);
        } else if (from) {
            dateFilter = "AND n.invoice_date >= ?";
            params.push(from);
        }

        let employeeFilter = "";
        const emp = employee != null ? String(employee).trim() : "";
        if (emp) {
            employeeFilter = "AND n.created_by = ?";
            params.push(emp);
        }

        const sql = `
      SELECT
        c.customer_id AS customer_id,
        c.lead_source AS lead_source,
        n.invoice_date AS order_date,
        c.first_name AS customer_name,
        c.company AS company_name,
        n.created_by AS employee_name,
        qi.item_name AS model,
        qi.quantity AS qty,
        qi.price_per_unit AS sale_price_unit,
        qi.gst AS tax_percent,
        qi.total_price AS total_sale_amount,
        COALESCE(
          qi.total_taxable_amt,
          qi.taxable_price,
          qi.price_per_unit * qi.quantity
        ) AS amount_without_gst_raw,
        n.payment_status AS payment_status,
        COALESCE(
          (
            SELECT psr.amount_per_unit
            FROM product_stock_request psr
            WHERE psr.product_code COLLATE utf8mb4_unicode_ci = qi.item_code COLLATE utf8mb4_unicode_ci
            ORDER BY psr.id DESC
            LIMIT 1
          ),
          (
            SELECT ssr.amount_per_unit
            FROM spare_stock_request ssr
            WHERE ssr.spare_name COLLATE utf8mb4_unicode_ci = qi.item_name COLLATE utf8mb4_unicode_ci
            ORDER BY ssr.id DESC
            LIMIT 1
          ),
          0
        ) AS purchase_price_unit
      FROM neworder n
      LEFT JOIN quotations_records qr ON n.quote_number COLLATE utf8mb4_unicode_ci = qr.quote_number COLLATE utf8mb4_unicode_ci
      LEFT JOIN customers c ON qr.customer_id = c.customer_id
      LEFT JOIN quotation_items qi ON n.quote_number COLLATE utf8mb4_unicode_ci = qi.quote_number COLLATE utf8mb4_unicode_ci
      WHERE n.invoice_number IS NOT NULL AND n.invoice_number != ''
      ${dateFilter}
      ${employeeFilter}
      ORDER BY n.invoice_date DESC
    `;

        const conn = await getDbConnection();
        const [rows] = await conn.execute(sql, params);

        const processedRows = rows.map((row) => {
            const salePrice = parseFloat(row.sale_price_unit) || 0;
            const purchasePrice = parseFloat(row.purchase_price_unit) || 0;
            const qty = parseInt(row.qty, 10) || 0;
            const taxPercent = parseFloat(row.tax_percent) || 0;
            const totalSale = salePrice * qty;
            const profitLoss = (salePrice - purchasePrice) * qty;
            const tax = (totalSale * taxPercent) / 100;
            const amountWithoutGst = parseFloat(row.amount_without_gst_raw) || 0;

            return {
                customer_id: row.customer_id ?? null,
                lead_source: row.lead_source ?? "",
                order_date: row.order_date,
                customer_name: row.customer_name ?? "",
                company_name: row.company_name ?? "",
                employee_name: row.employee_name ?? "",
                model: row.model ?? "",
                qty,
                sale_price: salePrice,
                purchase_price: purchasePrice,
                tax,
                profit_loss: profitLoss,
                total_sale_amount: parseFloat(row.total_sale_amount) || totalSale,
                amount_without_gst: amountWithoutGst,
                payment_status: row.payment_status ?? "",
            };
        });

        return NextResponse.json(processedRows);
    } catch (error) {
        console.error("Error fetching item wise sales report:", error);
        return NextResponse.json(
            { error: "Failed to fetch report data", details: error.message, stack: error.stack },
            { status: 500 }
        );
    }
}
