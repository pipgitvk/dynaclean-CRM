import { getDbConnection } from "@/lib/db";

export async function POST(request, { params }) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const { assetId } = await request.json();
    const stmtId = Number(params.id);

    console.log("[link-asset] Received:", { stmtId, assetId, assetIdType: typeof assetId });

    if (!assetId || isNaN(Number(assetId)) || Number(assetId) <= 0) {
      return new Response(
        JSON.stringify({ error: "Valid Asset ID required", received: assetId }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (isNaN(stmtId) || stmtId <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid statement ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await conn.beginTransaction();

    try {
      // Insert link into junction table
      await conn.execute(
        "INSERT IGNORE INTO statement_asset_links (statement_id, asset_id) VALUES (?, ?)",
        [stmtId, assetId]
      );

      // Check if this statement has any asset links
      const [links] = await conn.query(
        "SELECT COUNT(*) as count FROM statement_asset_links WHERE statement_id = ?",
        [stmtId]
      );

      if (links[0]?.count > 0) {
        // Update statement status to Settled
        await conn.execute(
          "UPDATE statements SET linked_module_type = ?, invoice_status = ? WHERE id = ?",
          ["Assets", "Settled", stmtId]
        );
      }

      await conn.commit();
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (error) {
    console.error("[link-asset] ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    conn.release();
  }
}
