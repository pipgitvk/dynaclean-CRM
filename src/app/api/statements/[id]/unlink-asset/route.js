import { getDbConnection } from "@/lib/db";

export async function DELETE(request, { params }) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const { assetId } = await request.json();
    const stmtId = Number(params.id);

    if (!assetId) {
      return new Response(
        JSON.stringify({ error: "Asset ID required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await conn.beginTransaction();

    try {
      // Delete link from junction table
      await conn.execute(
        "DELETE FROM statement_asset_links WHERE statement_id = ? AND asset_id = ?",
        [stmtId, assetId]
      );

      // Check if this statement still has any asset links
      const [links] = await conn.query(
        "SELECT COUNT(*) as count FROM statement_asset_links WHERE statement_id = ?",
        [stmtId]
      );

      if (links[0]?.count === 0) {
        // No more links, update status to Unsettled
        await conn.execute(
          "UPDATE statements SET linked_module_type = ?, invoice_status = ? WHERE id = ?",
          [null, "Unsettled", stmtId]
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
    console.error("[unlink-asset] ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    conn.release();
  }
}
