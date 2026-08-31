import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { parseLinkedStatementIds } from "@/lib/statementLinkedPurchases";

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
    const linkedTokens = parseLinkedStatementIds(purchase.linked_statement_ids);
    const transIdTokens = [];
    const numericIdTokens = [];

    for (const token of linkedTokens) {
      const value = String(token).trim();
      if (!value) continue;
      if (/^\d+$/.test(value)) {
        numericIdTokens.push(Number(value));
      }
      transIdTokens.push(value);
    }

    let statements = [];

    if (transIdTokens.length > 0 || numericIdTokens.length > 0) {
      const conditions = [];
      const params = [];

      if (transIdTokens.length > 0) {
        conditions.push(`trans_id IN (${transIdTokens.map(() => "?").join(", ")})`);
        params.push(...transIdTokens);
      }
      if (numericIdTokens.length > 0) {
        conditions.push(`id IN (${numericIdTokens.map(() => "?").join(", ")})`);
        params.push(...numericIdTokens);
      }

      const [stmtRows] = await conn.execute(
        `SELECT id, trans_id, date, description, amount, type, invoice_status
         FROM statements
         WHERE ${conditions.join(" OR ")}
         ORDER BY date DESC, id DESC`,
        params
      );
      const seen = new Set();
      statements = stmtRows.filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
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