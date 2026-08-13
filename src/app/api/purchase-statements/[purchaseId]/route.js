import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(req, { params }) {
  try {
    const { purchaseId } = await params;
    console.log("API called with purchaseId:", purchaseId);
    
    if (!purchaseId || isNaN(parseInt(purchaseId))) {
      console.log("Invalid purchaseId validation failed");
      return NextResponse.json({ error: "Valid purchase ID required" }, { status: 400 });
    }
    
    const conn = await getDbConnection();
    console.log("Database connection established");
    
    // Get purchase details with linked statement IDs
    const [purchases] = await conn.execute(
      `SELECT id, product_name, net_amount, linked_statement_ids 
       FROM product_stock_request 
       WHERE id = ?`,
      [parseInt(purchaseId)]
    );
    
    console.log("Purchase query result:", purchases);
    
    if (purchases.length === 0) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    
    const purchase = purchases[0];
    let linkedStatementIds = [];
    
    // Parse linked statement trans_ids
    if (purchase.linked_statement_ids) {
      try {
        linkedStatementIds = JSON.parse(purchase.linked_statement_ids);
      } catch (e) {
        console.warn(`Invalid JSON in linked_statement_ids for purchase ${purchaseId}`);
        linkedStatementIds = [];
      }
    }
    
    let statements = [];
    
    // Get statement details if there are linked trans_ids
    if (linkedStatementIds.length > 0) {
      const placeholders = linkedStatementIds.map(() => '?').join(',');
      const [stmtRows] = await conn.execute(
        `SELECT id, trans_id, date, description, amount, type, invoice_status
         FROM statements 
         WHERE trans_id IN (${placeholders})
         ORDER BY date DESC, id DESC`,
        linkedStatementIds
      );
      statements = stmtRows;
    }
    
    // Calculate totals
    const totalLinkedAmount = statements.reduce((sum, stmt) => sum + (parseFloat(stmt.amount) || 0), 0);
    const remainingAmount = (parseFloat(purchase.net_amount) || 0) - totalLinkedAmount;
    
    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        product_name: purchase.product_name,
        net_amount: purchase.net_amount
      },
      statements,
      summary: {
        totalLinkedAmount,
        remainingAmount,
        statementCount: statements.length
      }
    });
    
  } catch (error) {
    console.error("Error fetching purchase statements:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}