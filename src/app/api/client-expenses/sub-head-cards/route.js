import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

function isBlankGroupQueryParam(g) {
  const s = String(g ?? "").trim();
  if (s === "") return true;
  if (s === "—") return true;
  if (s === "\u2014") return true;
  if (s === "–" || s === "\u2013") return true;
  return false;
}

function getUniqueSubHeads(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const shList = (row.sub_head || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sh of shList) {
      if (!seen.has(sh)) {
        seen.add(sh);
        result.push(sh);
      }
    }
  }
  result.sort((a, b) => {
    return a.localeCompare(b);
  });
  return result;
}

function dropBroaderDuplicateSubRows(rows) {
  const parsed = rows.map((r) => ({
    r,
    shList: (r.sub_head || "").split(",").map((s) => s.trim()).filter(Boolean),
    amt: Number(r.amount || 0),
    name: String(r.expense_name || "").trim(),
  }));
  const dropIdx = new Set();
  for (let i = 0; i < parsed.length; i++) {
    for (let j = 0; j < parsed.length; j++) {
      if (i === j) continue;
      const a = parsed[i];
      const b = parsed[j];
      if (!a.name || a.name !== b.name) continue;
      if (!Number.isFinite(a.amt) || a.amt !== b.amt) continue;
      const Sa = a.shList;
      const Sb = b.shList;
      if (Sa.length === 0 || Sb.length === 0) continue;
      const setA = new Set(Sa);
      if (Sa.length > Sb.length && Sb.every((s) => setA.has(s))) {
        dropIdx.add(i);
        break;
      }
    }
  }
  return parsed.filter((_, i) => !dropIdx.has(i)).map((p) => p.r);
}

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { searchParams } = new URL(req.url);
    const client = searchParams.get("client");
    const group = searchParams.get("group");
    if (!client || !group) {
      return NextResponse.json({ error: "client and group are required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const blankGroup = isBlankGroupQueryParam(group);
    const [result] = await conn.execute(
      blankGroup
        ? `SELECT ce.id,
                  MAX(ce.expense_name) as expense_name,
                  MAX(ce.amount) as amount,
                  GROUP_CONCAT(cesh.sub_head SEPARATOR ', ') as sub_head
           FROM client_expenses ce
           LEFT JOIN client_expense_sub_heads cesh ON ce.id = cesh.client_expense_id
           WHERE ce.client_name = ?
             AND (ce.group_name IS NULL OR TRIM(COALESCE(ce.group_name, '')) = '')
           GROUP BY ce.id
           ORDER BY ce.id DESC`
        : `SELECT ce.id,
                  MAX(ce.expense_name) as expense_name,
                  MAX(ce.amount) as amount,
                  GROUP_CONCAT(cesh.sub_head SEPARATOR ', ') as sub_head
           FROM client_expenses ce
           LEFT JOIN client_expense_sub_heads cesh ON ce.id = cesh.client_expense_id
           WHERE ce.client_name = ? AND ce.group_name = ?
           GROUP BY ce.id
           ORDER BY ce.id DESC`,
      blankGroup ? [client] : [client, group],
    );

    const rows = dropBroaderDuplicateSubRows(result);
    const uniqueSubHeads = getUniqueSubHeads(rows);
    const cards = uniqueSubHeads.map((sh) => {
      let totalAmount = 0;
      let count = 0;
      for (const row of rows) {
        const shList = (row.sub_head || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (shList.includes(sh)) {
          // Full amount applies to selected sub-heads (no splitting).
          totalAmount += Number(row.amount || 0);
          count += 1;
        }
      }
      return { sub_head: sh, totalAmount, count };
    });

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("[sub-head-cards-api] GET error:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

