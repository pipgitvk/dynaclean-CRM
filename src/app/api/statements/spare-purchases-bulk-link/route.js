import db from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json();
    const { statementId, purchaseIds } = body;

    if (!statementId || !Array.isArray(purchaseIds) || purchaseIds.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const statement = await db.statement.findUnique({
      where: { id: Number(statementId) },
    });

    if (!statement) {
      return new Response(JSON.stringify({ error: "Statement not found" }), { status: 404 });
    }

    const existingLinkedIds = [];
    if (statement.linked_purchase_ids) {
      try {
        const parsed = JSON.parse(statement.linked_purchase_ids);
        if (Array.isArray(parsed)) existingLinkedIds.push(...parsed);
      } catch {
        const split = String(statement.linked_purchase_ids).split(",");
        existingLinkedIds.push(...split);
      }
    }

    const newLinkedIds = [...existingLinkedIds];
    for (const pid of purchaseIds) {
      const key = `SP${Number(pid)}`;
      if (!newLinkedIds.includes(key)) {
        newLinkedIds.push(key);
      }
    }

    const updatedStatement = await db.statement.update({
      where: { id: Number(statementId) },
      data: {
        linked_purchase_ids: JSON.stringify(newLinkedIds),
        invoice_status: "Settled",
      },
    });

    return new Response(JSON.stringify({ success: true, statement: updatedStatement }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in spare-purchases-bulk-link:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
