import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET() {
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { role, username } = payload;

        // Check if user has access to this report
        const allowedRoles = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "HR HEAD", "SALES", "TEAM LEADER", "DIRECTOR", "GEM PORTAL", "GEM"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const pool = await getDbConnection();

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
        c.customer_id
      FROM neworder AS o
      LEFT JOIN customers AS c 
        ON o.contact = c.phone COLLATE utf8mb4_unicode_ci
      WHERE (o.payment_status IS NULL OR o.payment_status != 'paid')
        AND (o.is_returned = 0 OR o.is_returned = 2 OR o.is_returned IS NULL)
        AND (o.is_cancelled = 0 or o.is_cancelled IS NULL)
    `;

        // Filter for SALES and GEM roles - only their own orders
        if (role === "SALES" || role === "GEM PORTAL" || role === "GEM") {
            sql += ` AND created_by = ?`;
        }

        sql += ` ORDER BY duedate ASC`;

        const [rows] = (role === "SALES" || role === "GEM PORTAL" || role === "GEM")
            ? await pool.query(sql, [username])
            : await pool.query(sql);

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
            const remaining = totalAmt - paidAmount;

            // Get latest deduction for this order
            let latestDeduction = null;
            try {
                const [deductions] = await pool.query(
                    `SELECT deduction_type, recorded_date FROM payment_deductions 
                     WHERE order_id = ? 
                     ORDER BY recorded_date DESC 
                     LIMIT 1`,
                    [order.order_id]
                );
                if (deductions.length > 0) {
                    latestDeduction = deductions[0].deduction_type;
                }
            } catch (err) {
                console.error(`Error fetching deduction for order ${order.order_id}:`, err);
            }

            return {
                order_id: order.order_id,
                client_name: order.client_name,
                company_name: order.company_name,
                contact: order.contact,
                created_by: order.created_by,
                total_amount: totalAmt,
                paid_amount: paidAmount,
                remaining_amount: remaining,
                due_date: order.duedate,
                payment_status: order.payment_status || 'pending',
                created_at: order.created_at,
                is_partially_returned: order.is_returned === 2,
                customer_id: order.customer_id,
                latest_deduction: latestDeduction
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
