import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePaymentPendingFollowupsTable } from "@/lib/ensurePaymentPendingFollowupsTable";
import { PAYMENT_PENDING_ORDER_SQL_WHERE } from "@/lib/paymentPendingFilters";

export async function GET() {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { role, username } = payload;

        // Check if user has access to this report
        const allowedRoles = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "HR HEAD", "SALES", "SALES CUM BACKOFFICE", "TEAM LEADER", "DIRECTOR", "GEM PORTAL", "GEM"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const pool = await getDbConnection();
        await ensurePaymentPendingFollowupsTable();

        // Build SQL query based on role
        let sql = `
      SELECT 
        o.order_id,
        o.quote_number,
        o.client_name,
        o.contact,
        o.created_by,
        o.totalamt,
        o.payment_amount,
        o.payment_status,
        o.duedate,
        o.created_at,
        o.company_name,
        o.is_returned,
        c.customer_id,
        ppf_latest.next_followup_date AS next_followup_date
      FROM neworder AS o
      LEFT JOIN customers AS c 
        ON o.contact COLLATE utf8mb4_unicode_ci = c.phone COLLATE utf8mb4_unicode_ci
      LEFT JOIN (
        SELECT ppf.order_id, ppf.next_followup_date
        FROM payment_pending_followups ppf
        INNER JOIN (
          SELECT order_id, MAX(id) AS max_id
          FROM payment_pending_followups
          GROUP BY order_id
        ) t ON t.order_id = ppf.order_id AND t.max_id = ppf.id
      ) ppf_latest ON ppf_latest.order_id COLLATE utf8mb4_unicode_ci = o.order_id COLLATE utf8mb4_unicode_ci
      WHERE ${PAYMENT_PENDING_ORDER_SQL_WHERE}
    `;

        // Filter for SALES and GEM roles - only their own orders
        // SALES CUM BACKOFFICE sees ALL orders (no filter)
        if (role === "SALES" || role === "GEM PORTAL" || role === "GEM") {
            sql += ` AND o.created_by COLLATE utf8mb4_unicode_ci = ?`;
        }

        sql += ` ORDER BY duedate ASC`;

        const [rows] = (role === "SALES" || role === "GEM PORTAL" || role === "GEM")
            ? await pool.query(sql, [username])
            : await pool.query(sql);

        const deductionByOrder = new Map();
        if (rows.length > 0) {
            try {
                const orderIds = rows.map((order) => order.order_id);
                const placeholders = orderIds.map(() => "?").join(",");
                const [deductionRows] = await pool.query(
                    `SELECT order_id, deduction_type, amount, recorded_date
                     FROM payment_deductions
                     WHERE order_id IN (${placeholders})
                     ORDER BY recorded_date DESC`,
                    orderIds
                );
                for (const deduction of deductionRows) {
                    if (!deductionByOrder.has(deduction.order_id)) {
                        deductionByOrder.set(deduction.order_id, {
                            latest: deduction.deduction_type,
                            total: 0
                        });
                    }
                    const existing = deductionByOrder.get(deduction.order_id);
                    existing.total += parseFloat(deduction.amount || 0);
                }
            } catch (err) {
                console.error("Error fetching payment deductions:", err);
            }
        }

        // Calculate remaining amount for each order
        const orders = await Promise.all(rows.map(async (order) => {
            let totalAmt = parseFloat(order.totalamt || 0);

            // If partially returned, calculate adjusted total
            if (order.is_returned === 2 && order.quote_number) {
                try {
                    // Get returned items for this order
                    const [returnedItems] = await pool.query(
                        `SELECT item_code, quantity_returned FROM order_return_items WHERE order_id = ?`,
                        [order.order_id]
                    );

                    if (returnedItems.length > 0) {
                        // Get prices from quotation_items
                        const itemCodes = returnedItems.map(item => item.item_code);
                        const placeholders = itemCodes.map(() => '?').join(',');

                        const [quotationItems] = await pool.query(
                            `SELECT item_code, total_price, quantity FROM quotation_items 
                             WHERE quote_number = ? AND item_code IN (${placeholders})`,
                            [order.quote_number, ...itemCodes]
                        );

                        // Calculate total value of returned items
                        let returnedValue = 0;
                        returnedItems.forEach(returnedItem => {
                            const quotItem = quotationItems.find(q => q.item_code === returnedItem.item_code);
                            if (quotItem) {
                                // Calculate price per unit and multiply by returned quantity
                                const pricePerUnit = parseFloat(quotItem.total_price) / parseInt(quotItem.quantity);
                                returnedValue += pricePerUnit * returnedItem.quantity_returned;
                            }
                        });

                        // Adjust total amount by subtracting returned items value
                        totalAmt = totalAmt - returnedValue;
                    }
                } catch (err) {
                    console.error(`Error calculating returned value for order ${order.order_id}:`, err);
                    // Continue with original total if calculation fails
                }
            }

            // Parse payment_amount which might be comma-separated values
            const paymentAmounts = (order.payment_amount || "")
                .toString()
                .split(",")
                .map(s => parseFloat(s.trim()) || 0);

            const paidAmount = paymentAmounts.reduce((sum, amt) => sum + amt, 0);
            const deductionInfo = deductionByOrder.get(order.order_id);
            const deductionAmount = deductionInfo?.total || 0;
            const remaining = totalAmt - paidAmount - deductionAmount;

            return {
                order_id: order.order_id,
                client_name: order.client_name,
                company_name: order.company_name,
                contact: order.contact,
                created_by: order.created_by,
                total_amount: totalAmt,
                paid_amount: paidAmount,
                deduction_amount: deductionAmount,
                remaining_amount: remaining,
                due_date: order.duedate,
                next_followup_date: order.next_followup_date || null,
                payment_status: order.payment_status || 'pending',
                created_at: order.created_at,
                is_partially_returned: order.is_returned === 2,
                customer_id: order.customer_id,
                latest_deduction: deductionInfo?.latest || null
            };
        }));

        // Filter out orders with zero or negative remaining amount
        const pendingOrders = orders.filter(order => order.remaining_amount > 0);

        return NextResponse.json({
            success: true,
            orders: pendingOrders,
            userRole: role
        });

    } catch (error) {
        console.error("Error fetching payment pending report:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
