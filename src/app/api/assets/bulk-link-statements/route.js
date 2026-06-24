import { getDbConnection } from "@/lib/db";

export async function POST(request) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const body = await request.json();
    let { statementIds, assetIds, initialLinkedStatementIds = [] } = body;

    console.log("[assets-bulk-link] Received body:", body);

    // Convert all IDs to numbers
    statementIds = (statementIds || []).map(id => Number(id));
    assetIds = (assetIds || []).map(id => Number(id));
    initialLinkedStatementIds = (initialLinkedStatementIds || []).map(id => Number(id));

    console.log("[assets-bulk-link] Processed statementIds:", statementIds);
    console.log("[assets-bulk-link] Processed assetIds:", assetIds);

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await conn.beginTransaction();

    try {
      // Step 1: Get all statements (both selected and previously linked)
      const relevantStatementIds = new Set([
        ...(statementIds || []),
        ...initialLinkedStatementIds,
      ]);
      
      const [relevantStatements] = await conn.query(
        "SELECT id FROM statements WHERE id IN (?)",
        [[...relevantStatementIds]]
      );

      const selectedStatementIdsSet = new Set(statementIds || []);

      // Step 2: Delete existing links for statements that should be unlinked
      for (const stmt of relevantStatements) {
        if (!selectedStatementIdsSet.has(stmt.id)) {
          // This statement was previously linked but is no longer selected
          // Delete its links to these assets
          for (const assetId of assetIds) {
            await conn.execute(
              "DELETE FROM statement_asset_links WHERE statement_id = ? AND asset_id = ?",
              [stmt.id, assetId]
            );
          }
        }
      }

      // Step 3: Add new links for selected statements to all selected assets
      for (const stmtId of statementIds) {
        for (const assetId of assetIds) {
          // Insert or ignore if already exists
          await conn.execute(
            "INSERT IGNORE INTO statement_asset_links (statement_id, asset_id) VALUES (?, ?)",
            [stmtId, assetId]
          );
        }
      }

      // Step 4: Update statement status based on whether it has any asset links
      for (const stmt of relevantStatements) {
        const [links] = await conn.query(
          "SELECT COUNT(*) as count FROM statement_asset_links WHERE statement_id = ?",
          [stmt.id]
        );
        
        const hasLinks = links[0]?.count > 0;
        const status = hasLinks ? "Settled" : "Unsettled";
        
        await conn.execute(
          "UPDATE statements SET linked_module_type = ?, invoice_status = ? WHERE id = ?",
          [hasLinks ? "Assets" : null, status, stmt.id]
        );
      }

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
    console.error("[assets-bulk-link] ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
}
