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
        const allowedRoles = ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "HR HEAD", "SALES", "TEAM LEADER"];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const pool = await getDbConnection();

        // Build SQL query based on role
        let sql = `
      SELECT 
        order_id,
        quote_number,
        client_name,
        contact,
        created_by,
        totalamt,
        payment_amount,
        payment_status,
        duedate,
        created_at,
        company_name,
        is_returned
      FROM neworder
      WHERE (payment_status IS NULL OR payment_status != 'paid')
        AND (is_returned = 0 OR is_returned = 2 OR is_returned IS NULL)
        AND (is_cancelled = 0 or is_cancelled IS NULL)
    `;

        // Filter for SALES role - only their own orders
        if (role === "SALES") {
            sql += ` AND created_by = ?`;
        }

        sql += ` ORDER BY duedate ASC`;

        const [rows] = role === "SALES"
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
                is_partially_returned: order.is_returned === 2
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
