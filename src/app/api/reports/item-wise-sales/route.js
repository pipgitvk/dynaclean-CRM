import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { ensureProductAccessoriesColumns } from "@/lib/ensureProductAccessoriesColumns";
import {
  finalMachineBuyPrice,
  isBatteryAccessory,
} from "@/lib/itemWiseSalesBatteryBuyPrice";

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
        qi.quote_number AS quote_number,
        qi.item_code AS item_code,
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
        const buyPriceByRow = await machineBuyPricesWithMandatoryBattery(conn, rows);

        const processedRows = rows.map((row, index) => {
            const salePrice = parseFloat(row.sale_price_unit) || 0;
            const purchasePrice =
                buyPriceByRow[index] ?? (parseFloat(row.purchase_price_unit) || 0);
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

function chunk(list, size) {
    const out = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

async function queryIn(conn, sqlPrefix, values, sqlSuffix = "") {
    if (!values.length) return [];
    const rows = [];
    for (const part of chunk(values, 400)) {
        const placeholders = part.map(() => "?").join(", ");
        const [found] = await conn.query(
            `${sqlPrefix} (${placeholders}) ${sqlSuffix}`,
            part,
        );
        rows.push(...found);
    }
    return rows;
}

/**
 * Unit buy price per report row.
 * Battery accessory package_status "added" is included in the machine buy price.
 * package_status "available" is not added.
 */
async function machineBuyPricesWithMandatoryBattery(conn, rows) {
    const base = rows.map((row) => parseFloat(row.purchase_price_unit) || 0);
    if (!rows.length) return base;

    try {
        await ensureProductAccessoriesColumns(conn);

        const codes = [...new Set(rows.map((row) => String(row.item_code || "").trim()).filter(Boolean))];
        const names = [...new Set(rows.map((row) => String(row.model || "").trim()).filter(Boolean))];
        const products = [
            ...(await queryIn(
                conn,
                "SELECT item_code, item_name FROM products_list WHERE item_code IN",
                codes,
            )),
            ...(await queryIn(
                conn,
                "SELECT item_code, item_name FROM products_list WHERE item_name IN",
                names,
            )),
        ];

        const productByCode = new Map();
        const productByName = new Map();
        for (const product of products) {
            const code = String(product.item_code || "").trim();
            const name = String(product.item_name || "").trim().toLowerCase();
            if (code) productByCode.set(code, code);
            if (code && name) productByName.set(name, code);
        }

        const productCodes = [...new Set([...productByCode.values(), ...productByName.values()])];
        if (!productCodes.length) return base;

        const accessories = await queryIn(
            conn,
            `SELECT pa.product_code, pa.spare_id, pa.accessory_name, pa.is_mandatory, pa.qty, pa.package_status,
                    sl.item_name AS spare_name, sl.spare_number
             FROM product_accessories pa
             LEFT JOIN spare_list sl ON sl.id = pa.spare_id
             WHERE pa.package_status = 'added'
               AND pa.product_code IN`,
            productCodes,
        );
        const batteries = accessories.filter(isBatteryAccessory);
        if (!batteries.length) return base;

        const spareIds = [...new Set(batteries.map((row) => row.spare_id).filter((id) => id != null))];
        const spareNames = [
            ...new Set(
                batteries
                    .map((row) => String(row.spare_name || row.accessory_name || "").trim())
                    .filter(Boolean),
            ),
        ];
        const priceBySpareKey = new Map();
        const priceRows = [
            ...(await queryIn(
                conn,
                `SELECT id, spare_id, spare_name, amount_per_unit
                 FROM spare_stock_request
                 WHERE spare_id IN`,
                spareIds,
                "ORDER BY id DESC",
            )),
            ...(await queryIn(
                conn,
                `SELECT id, spare_id, spare_name, amount_per_unit
                 FROM spare_stock_request
                 WHERE spare_name IN`,
                spareNames,
                "ORDER BY id DESC",
            )),
        ].sort((a, b) => Number(b.id) - Number(a.id));

        for (const priceRow of priceRows) {
            const idKey = priceRow.spare_id != null ? `id:${String(priceRow.spare_id).trim()}` : "";
            const nameKey = String(priceRow.spare_name || "").trim().toLowerCase();
            const amount = parseFloat(priceRow.amount_per_unit) || 0;
            if (idKey && !priceBySpareKey.has(idKey)) priceBySpareKey.set(idKey, amount);
            if (nameKey && !priceBySpareKey.has(`name:${nameKey}`)) {
                priceBySpareKey.set(`name:${nameKey}`, amount);
            }
        }

        const batteriesByProduct = new Map();
        for (const battery of batteries) {
            const code = String(battery.product_code || "").trim();
            if (!batteriesByProduct.has(code)) batteriesByProduct.set(code, []);
            batteriesByProduct.get(code).push(battery);
        }

        const productCodeForRow = rows.map((row) => {
            const code = String(row.item_code || "").trim();
            const name = String(row.model || "").trim().toLowerCase();
            return productByCode.get(code) || productByName.get(name) || productByName.get(code.toLowerCase()) || null;
        });

        return base.map((machineBuyPrice, index) => {
            const productCode = productCodeForRow[index];
            if (!productCode) return machineBuyPrice;
            return finalMachineBuyPrice(
                machineBuyPrice,
                batteriesByProduct.get(productCode) || [],
                priceBySpareKey,
            );
        });
    } catch (error) {
        console.error("item-wise-sales battery buy price:", error);
        return base;
    }
}
