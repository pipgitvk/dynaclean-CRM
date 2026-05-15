import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, IndianRupee, ChevronRight, ArrowLeft, Plus } from "lucide-react";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

/** Cards UI uses this when `group_name` is null/empty in DB — must not match SQL as literal. */
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

/**
 * When the same expense line exists twice (template + statement clone) with the same
 * amount and name, keep the row whose sub-heads are a strict subset of the other —
 * the narrower row reflects the user's statement allocation.
 */
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
      const setB = new Set(Sb);
      if (Sa.length > Sb.length && [...Sb].every((s) => setA.has(s))) {
        dropIdx.add(i);
        break;
      }
    }
  }
  return parsed.filter((_, i) => !dropIdx.has(i)).map((p) => p.r);
}

export default async function SubHeadCardsPage({ searchParams }) {
  const sp = await searchParams;
  const client = sp?.client || null;
  const group = sp?.group || null;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return <p className="text-red-600 p-4">Unauthorized</p>;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
  } catch {
    return <p className="text-red-600 p-4">Invalid Token</p>;
  }

  if (!client || !group) {
    redirect("/admin-dashboard/client-expenses/cards");
  }

  let rows = [];
  try {
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
    rows = dropBroaderDuplicateSubRows(result);
  } catch (err) {
    console.error("[sub-head-cards] DB error:", err?.message);
  }

  const uniqueSubHeads = getUniqueSubHeads(rows);
  const subHeadCards = uniqueSubHeads.map((sh) => {
    let totalAmount = 0;
    let count = 0;
    for (const row of rows) {
      const shList = (row.sub_head || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (shList.includes(sh)) {
        // Full amount goes to each selected sub-head row (no splitting).
        totalAmount += Number(row.amount || 0);
        count += 1;
      }
    }
    return { sub_head: sh, totalAmount, count };
  });

  const baseParams = `client=${encodeURIComponent(client)}&group=${encodeURIComponent(group)}`;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/admin-dashboard/client-expenses/cards"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-700">
              Sub-heads — {client} / {group}
            </h1>
            <Link
              href={`/admin-dashboard/client-expenses/sub-head-cards?${baseParams}`}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 whitespace-nowrap"
            >
              Refresh
            </Link>
            <Link
              href={`/admin-dashboard/client-expenses/add?${baseParams}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Plus size={16} />
              Add Sub-head
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {subHeadCards.map((card) => (
          <Link
            key={card.sub_head}
            href={`/admin-dashboard/client-expenses?${baseParams}&sub_head=${encodeURIComponent(card.sub_head)}`}
            className="group relative block text-left rounded-xl border overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200 hover:border-slate-400"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-500 to-slate-600" />
            <div className="p-4 pl-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <Layers className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="font-medium">sub_head:</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">{card.sub_head}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  <span className="text-lg font-bold text-gray-800">
                    ₹{card.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {card.count} expense{card.count !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </Link>
        ))}

        {subHeadCards.length === 0 && (
          <p className="text-sm text-gray-500 col-span-full">
            No sub-heads found for this client/group.
          </p>
        )}
      </div>
    </div>
  );
}
