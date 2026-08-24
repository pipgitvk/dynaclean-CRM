import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// POST - Bulk assign/reassign leads to an employee
export async function POST(request) {
    let pool;
    let connection;
    try {
        const payload = await getSessionPayload();
        if (!payload) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only allow admin and sales roles to perform bulk operations
        if (!["ADMIN", "SUPERADMIN", "SALES", "SALES CUM BACKOFFICE"].includes(payload.role)) {
            return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
        }

        const body = await request.json();
        const { customer_ids, employee_username } = body;

        if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
            return NextResponse.json(
                { error: "customer_ids array is required and must not be empty" },
                { status: 400 }
            );
        }

        if (!employee_username) {
            return NextResponse.json(
                { error: "employee_username is required" },
                { status: 400 }
            );
        }

        // Get pool and then get a connection for transaction
        pool = await getDbConnection();
        connection = await pool.getConnection();

        // Start transaction for data integrity
        await connection.beginTransaction();

        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        try {
            // Update customers in bulk
            for (const customer_id of customer_ids) {
                try {
                    const [existing] = await connection.execute(
                        `SELECT customer_id, lead_source, first_name, last_name, phone, email
                         FROM customers WHERE customer_id = ?`,
                        [customer_id]
                    );

                    if (!existing.length) {
                        failureCount++;
                        errors.push({ customer_id, error: "Customer not found" });
                        continue;
                    }

                    const prev = existing[0];
                    const previousEmployee = prev.lead_source || "—";
                    const customerName =
                        [prev.first_name, prev.last_name].filter(Boolean).join(" ") || "—";

                    // Reassign lead: reset status/stage to New for the new assignee
                    await connection.execute(
                        `UPDATE customers
                         SET
                           lead_source = ?,
                           assigned_to = ?,
                           sales_representative = ?,
                           status = 'New',
                           stage = 'New',
                           next_follow_date = NOW()
                         WHERE customer_id = ?`,
                        [employee_username, payload.username, employee_username, customer_id]
                    );

                    const reassignNote = `Re-assigned lead from ${previousEmployee} to ${employee_username} by ${payload.username}`;
                    await connection.execute(
                        `INSERT INTO customers_followup
                         (customer_id, name, contact, email, next_followup_date, followed_date, comm_mode, notes, followed_by)
                         VALUES (?, ?, ?, ?, NOW(), NULL, ?, ?, ?)`,
                        [
                            customer_id,
                            customerName,
                            prev.phone || "",
                            prev.email || "",
                            "System",
                            reassignNote,
                            payload.username,
                        ]
                    );

                    // Also update in TL_followups if exists
                    await connection.execute(
                        `UPDATE TL_followups SET assigned_employee = ? WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
                        [employee_username, customer_id]
                    );

                    successCount++;
                } catch (err) {
                    failureCount++;
                    errors.push({ customer_id, error: err.message });
                    console.error(`Error updating customer ${customer_id}:`, err);
                }
            }

            // Commit transaction
            await connection.commit();

            return NextResponse.json({
                success: true,
                message: `Bulk assignment completed: ${successCount} succeeded, ${failureCount} failed`,
                successCount,
                failureCount,
                errors: failureCount > 0 ? errors : undefined
            });
        } catch (error) {
            // Rollback on error
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error("Error in bulk assign leads:", error);
        return NextResponse.json(
            { error: "Failed to perform bulk assignment" },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release(); // Release connection back to pool
        }
    }
}

