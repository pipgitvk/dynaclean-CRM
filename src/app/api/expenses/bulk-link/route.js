import { getDbConnection } from "@/lib/db";

export async function PATCH(req) {
  try {
    const { expense_ids, linked_statement_ids } = await req.json();

    if (!expense_ids || !Array.isArray(expense_ids) || expense_ids.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No expense IDs provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const conn = await getDbConnection();

    // 1. For each expense, clear current links and update with new ones
    for (const expenseId of expense_ids) {
      // Clear current links for this expense in statements table
      await conn.execute(
        "UPDATE statements SET client_expense_id = NULL WHERE client_expense_id = ?",
        [expenseId]
      );

      // Update expenses table with new statement IDs
      const sql = `UPDATE expenses SET linked_statement_ids = ? WHERE ID = ?`;
      await conn.execute(sql, [
        JSON.stringify(linked_statement_ids || []),
        expenseId,
      ]);

      // Update statements table with this expense ID
      if (linked_statement_ids && linked_statement_ids.length > 0) {
        const placeholders = linked_statement_ids.map(() => "?").join(",");
        await conn.execute(
          `UPDATE statements SET client_expense_id = ? WHERE id IN (${placeholders})`,
          [expenseId, ...linked_statement_ids]
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[expense-bulk-link] ERROR:`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
