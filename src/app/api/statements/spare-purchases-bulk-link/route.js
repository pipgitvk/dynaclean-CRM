import { getDbConnection } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { statementId, purchaseIds } = body;

    if (!statementId || !Array.isArray(purchaseIds) || purchaseIds.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const conn = await getDbConnection();
    await conn.beginTransaction();

    try {
      const [statementRows] = await conn.execute(
        "SELECT id, linked_purchase_ids FROM statements WHERE id = ?",
        [Number(statementId)]
      );

      if (statementRows.length === 0) {
        await conn.rollback();
        return new Response(JSON.stringify({ error: "Statement not found" }), { 
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const statement = statementRows[0];
      let currentTokens = [];
      
      if (statement.linked_purchase_ids) {
        try {
          const parsed = JSON.parse(statement.linked_purchase_ids);
          if (Array.isArray(parsed)) currentTokens = parsed;
        } catch {
          const split = String(statement.linked_purchase_ids).split(",");
          currentTokens = split;
        }
      }

      purchaseIds.forEach(pid => {
        const token = `SP${Number(pid)}`;
        if (!currentTokens.includes(token)) {
          currentTokens.push(token);
        }
      });

      const nextLinkedIds = currentTokens.length > 0 ? JSON.stringify(currentTokens) : null;
      const nextStatus = currentTokens.length > 0 ? "Settled" : "Unsettled";

      await conn.execute(
        "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?",
        [nextLinkedIds, nextStatus, Number(statementId)]
      );

      await conn.commit();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (error) {
    console.error("[spare-purchases-bulk-link] ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
