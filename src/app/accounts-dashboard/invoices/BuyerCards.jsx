"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, IndianRupee } from "lucide-react";
import dayjs from "dayjs";

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
];

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const fmt = (n) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function BuyerCards() {
  const router = useRouter();
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [buyerPage, setBuyerPage] = useState(1);
  const buyerPageSize = 20;
  const [buyerMeta, setBuyerMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ buyers: 0, invoices: 0, amount: 0 });
  const searchDebounceRef = useRef(null);

  const fetchBuyers = useCallback(async (page, searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(buyerPageSize),
      });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/invoice-buyers?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load buyers");
        setBuyers([]);
        return;
      }
      setBuyers(data.buyers ?? []);
      setBuyerMeta(data.meta ?? { page: 1, total: 0, totalPages: 1 });
      setSummary(data.summary ?? { buyers: 0, invoices: 0, amount: 0 });
      setBuyerPage(data.meta?.page ?? page);
    } catch (e) {
      setError(e.message);
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  }, [buyerPageSize]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const delay = search.trim() ? 350 : 0;
    searchDebounceRef.current = setTimeout(() => {
      fetchBuyers(1, search);
    }, delay);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search, fetchBuyers]);

  const goToBuyerPage = (page) => {
    if (page < 1 || page > buyerMeta.totalPages || page === buyerPage) return;
    fetchBuyers(page, search);
  };

  const totalBuyerPages = buyerMeta.totalPages || 1;
  const buyerTotal = buyerMeta.total || 0;

  const handleCardClick = (buyerName) => {
    router.push(`/accounts-dashboard/invoices/buyer/${encodeURIComponent(buyerName)}`);
  };

  if (loading && buyers.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && buyers.length === 0) {
    return (
      <div className="text-center py-20 text-red-500">
        <p className="text-lg font-semibold">Failed to load buyers</p>
        <p className="text-sm mt-1 text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Invoice Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {summary.buyers} buyers · {summary.invoices} invoices total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/accounts-dashboard/invoices/new"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 self-start sm:self-auto"
          >
            <FileText size={16} />
            Add Invoice
          </a>
          <a
            href="/user-dashboard/invoices"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-purple-700 self-start sm:self-auto"
          >
            <FileText size={16} />
            List
          </a>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Users,        label: "Total Buyers",   value: summary.buyers,              color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: FileText,     label: "Total Invoices", value: summary.invoices,             color: "text-purple-600", bg: "bg-purple-50" },
          { icon: IndianRupee,  label: "Total Amount",   value: `₹${fmt(summary.amount)}`,   color: "text-green-600",  bg: "bg-green-50"  },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl border border-gray-200 ${bg} p-4`}>
            <div className={`rounded-full p-2 ${bg}`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search buyer name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setBuyerPage(1);
          }}
          className="w-full rounded-xl border border-gray-300 bg-white text-gray-800 pl-9 pr-9 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Buyer Cards Grid */}
      {loading && buyers.length > 0 && (
        <p className="text-sm text-gray-500 text-center">Loading buyers…</p>
      )}

      {buyers.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          {search ? `No buyers matching "${search}"` : "No buyers found."}
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
          {buyers.map((buyer) => (
            <BuyerCard
              key={`${buyer.customer_id}-${buyer.buyer_name}`}
              buyer={buyer}
              onClick={() => handleCardClick(buyer.buyer_name)}
            />
          ))}
        </div>
      )}

      {/* Buyer Cards Pagination */}
      {totalBuyerPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {(buyerPage - 1) * buyerPageSize + 1}–{Math.min(buyerPage * buyerPageSize, buyerTotal)} of {buyerTotal} buyers
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToBuyerPage(1)}
              disabled={buyerPage === 1 || loading}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              «
            </button>
            <button
              onClick={() => goToBuyerPage(buyerPage - 1)}
              disabled={buyerPage === 1 || loading}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: totalBuyerPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalBuyerPages || Math.abs(p - buyerPage) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-gray-400">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToBuyerPage(item)}
                    className={`px-3 py-1 text-xs border rounded ${
                      buyerPage === item
                        ? "bg-blue-600 text-white border-blue-600 font-semibold"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => goToBuyerPage(buyerPage + 1)}
              disabled={buyerPage === totalBuyerPages || loading}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => goToBuyerPage(totalBuyerPages)}
              disabled={buyerPage === totalBuyerPages || loading}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              »
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function BuyerCard({ buyer, onClick }) {
  const initials = getInitials(buyer.buyer_name);
  const bgColor = avatarColor(buyer.buyer_name);
  const lastDate = buyer.last_invoice_date
    ? dayjs(buyer.last_invoice_date).format("DD-MM-YYYY")
    : "—";

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`${bgColor} shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
            {buyer.buyer_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {buyer.customer_id ? `ID: ${buyer.customer_id}` : "ID: —"}
          </p>
          <p className="text-xs text-gray-400">
            Last: {lastDate}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Invoices</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">
            {buyer.invoice_count}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total</p>
          <p className="text-base font-bold text-green-600 mt-0.5">
            ₹{fmt(buyer.total_amount)}
          </p>
        </div>
      </div>

      {/* Hover hint */}
      <p className="mt-3 text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        View Ledger →
      </p>
    </button>
  );
}
