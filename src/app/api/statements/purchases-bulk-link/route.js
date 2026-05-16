import { getDbConnection } from "@/lib/db";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";

export async function PATCH(req) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const { purchase_ids, statement_id } = await req.json();

    if (!purchase_ids || !Array.isArray(purchase_ids) || purchase_ids.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No purchase IDs provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!statement_id) {
      return new Response(JSON.stringify({ ok: false, error: "No statement ID provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await conn.beginTransaction();

    try {
      const [statementRows] = await conn.execute(
        "SELECT id, linked_purchase_ids FROM statements WHERE id = ?",
        [statement_id]
      );

      if (statementRows.length === 0) {
        await conn.rollback();
        return new Response(JSON.stringify({ ok: false, error: "Statement not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const statement = statementRows[0];
      const currentTokens = parseLinkedPurchaseTokens(statement.linked_purchase_ids);

      purchase_ids.forEach((id) => {
        const token = `PP${id}`;
        if (!currentTokens.includes(token)) {
          currentTokens.push(token);
        }
      });

      const nextLinkedIds =
        currentTokens.length > 0 ? JSON.stringify(currentTokens) : null;
      const nextStatus = currentTokens.length > 0 ? "Settled" : "Unsettled";

      await conn.execute(
        "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?",
        [nextLinkedIds, nextStatus, statement_id]
      );

      await conn.commit();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (e) {
    console.error(`[purchase-bulk-link] ERROR:`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
}
