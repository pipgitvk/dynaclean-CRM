import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import dayjs from "dayjs";

export async function POST(req) {
    try {
        const { from, to } = await req.json();

        let dateFilter = "";
        const params = [];

        if (from && to) {
            dateFilter = "AND n.invoice_date BETWEEN ? AND ?";
            params.push(from, to);
        } else if (from) {
            dateFilter = "AND n.invoice_date >= ?";
            params.push(from);
        }

        const sql = `
      SELECT DISTINCT
        n.invoice_date as date,
        n.created_by as employee_name,
        c.first_name as customer_name,
        c.company as company_name,
        c.gstin as reg_no,
        c.address as customer_address,
        qi.item_name as product_name,
        qi.specification as model,
        qi.quantity as qty,
        qi.price_per_unit as sale_price_unit,
        qi.gst as tax_percent,
        qi.total_price as total_sale_amount,
        n.ship_to as delivery_address,
        COALESCE(
          (
            SELECT psr.amount_per_unit
            FROM product_stock_request psr
            WHERE psr.product_code COLLATE utf8mb3_unicode_ci = qi.item_code COLLATE utf8mb3_unicode_ci
            ORDER BY psr.id DESC
            LIMIT 1
          ),
          (
            SELECT ssr.amount_per_unit
            FROM spare_stock_request ssr
            WHERE ssr.spare_name COLLATE utf8mb3_unicode_ci = qi.item_name COLLATE utf8mb3_unicode_ci
            ORDER BY ssr.id DESC
            LIMIT 1
          ),
          0
        ) as purchase_price_unit
      FROM neworder n
      LEFT JOIN quotations_records qr ON n.quote_number COLLATE utf8mb3_unicode_ci = qr.quote_number COLLATE utf8mb3_unicode_ci
      LEFT JOIN customers c ON qr.customer_id = c.customer_id
      LEFT JOIN quotation_items qi ON n.quote_number COLLATE utf8mb3_unicode_ci = qi.quote_number COLLATE utf8mb3_unicode_ci
      WHERE n.invoice_number IS NOT NULL AND n.invoice_number != ''
      ${dateFilter}
      ORDER BY n.invoice_date DESC
    `;

        const conn = await getDbConnection();
        const [rows] = await conn.execute(sql, params);

        // Process rows to calculate profit/loss and format data
        const processedRows = rows.map((row) => {
            const salePrice = parseFloat(row.sale_price_unit) || 0;
            const purchasePrice = parseFloat(row.purchase_price_unit) || 0;
            const qty = parseInt(row.qty) || 0;
            const taxPercent = parseFloat(row.tax_percent) || 0;

            const totalSale = salePrice * qty;

            // Assuming Profit = (Unit Sale Price - Unit Purchase Price) * Qty
            const profitLoss = (salePrice - purchasePrice) * qty;

            return {
                ...row,
                purchase_price: purchasePrice,
                sale_price: salePrice,
                profit_loss: profitLoss,
                tax: (totalSale * taxPercent) / 100, // Approximate tax amount
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
