import Link from "next/link";
import { Building2, User, IndianRupee, ListChecks, ChevronRight } from "lucide-react";
import { getDbConnection } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export const dynamic = "force-dynamic";

export default async function ClientExpensesCardsPage() {
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

  let rows = [];
  try {
    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `SELECT ce.id, ce.client_name, ce.group_name, ce.amount,
              GROUP_CONCAT(cesh.sub_head SEPARATOR ', ') as sub_head
       FROM client_expenses ce
       LEFT JOIN client_expense_sub_heads cesh ON ce.id = cesh.client_expense_id
       GROUP BY ce.id
       ORDER BY ce.id DESC`,
    );
    rows = result;
  } catch (err) {
    console.error("[client-expenses cards] DB error:", err?.message);
  }

  const summaryMap = {};
  for (const row of rows) {
    const client = row.client_name || "—";
    const group = row.group_name || "—";
    const key = `${client}|||${group}`;
    if (!summaryMap[key]) {
      summaryMap[key] = {
        key,
        client_name: client,
        group_name: group,
        totalAmount: 0,
        hasSubHead: false,
      };
    }
    summaryMap[key].totalAmount += Number(row.amount || 0);
    if (row.sub_head && String(row.sub_head).trim() !== "") {
      summaryMap[key].hasSubHead = true;
    }
  }

  const summaryCards = Object.values(summaryMap).sort(
    (a, b) =>
      a.client_name.localeCompare(b.client_name) ||
      a.group_name.localeCompare(b.group_name),
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-700">Client Expenses – Summary</h1>
            <Link
              href="/admin-dashboard/client-expenses/cards"
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 whitespace-nowrap"
            >
              Refresh
            </Link>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
          <Link
            href="/admin-dashboard/client-expenses/add"
            className="w-full sm:w-auto inline-flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
          >
            Add Client Expense
          </Link>
          <Link
            href="/admin-dashboard/client-expenses/category"
            className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
          >
            Category
          </Link>
          <Link
            href="/admin-dashboard/client-expenses/sub-category"
            className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg shadow text-sm font-medium whitespace-nowrap"
          >
            Sub-category
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Link
            key={card.key}
            href={`/admin-dashboard/client-expenses?client=${encodeURIComponent(
              card.client_name,
            )}&group=${encodeURIComponent(card.group_name)}`}
            className={[
              "group relative block text-left rounded-xl border overflow-hidden",
              "shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1",
              card.hasSubHead
                ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-400"
                : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {/* Accent bar */}
            <div
              className={[
                "absolute left-0 top-0 bottom-0 w-1",
                card.hasSubHead ? "bg-gradient-to-b from-blue-500 to-indigo-600" : "bg-gradient-to-b from-slate-400 to-slate-600",
              ].join(" ")}
            />
            <div className="p-4 pl-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="font-medium">group_name:</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 truncate">{card.group_name}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/80 border border-gray-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="font-medium">client_name:</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 truncate">{card.client_name}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  <span className="text-lg font-bold text-gray-800">₹{card.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <span
                  className={[
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                    card.hasSubHead
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600",
                  ].join(" ")}
                >
                  <ListChecks className="w-3 h-3" />
                  {card.hasSubHead ? "Has sub-heads" : "No sub-head"}
                </span>
              </div>
            </div>
          </Link>
        ))}

        {summaryCards.length === 0 && (
          <p className="text-sm text-gray-500 col-span-full">
            No client expenses found.
          </p>
        )}
      </div>
    </div>
  );
}

