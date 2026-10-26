"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, IndianRupee, X } from "lucide-react";
import dayjs from "dayjs";
import PurchaseLedgerModal from "./PurchaseLedgerModal";

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

export default function PurchaseLedgerPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    fetch("/api/purchase-companies", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCompanies(data.companies ?? []);
        else setError(data.error || "Failed to load companies");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.trim().toLowerCase();
    return companies.filter((c) => c.company_name?.toLowerCase().includes(q));
  }, [companies, search]);

  const totals = useMemo(() => ({
    companies: companies.length,
    purchases: companies.reduce((s, c) => s + Number(c.purchase_count || 0), 0),
    amount: companies.reduce((s, c) => s + Number(c.total_amount || 0), 0),
  }), [companies]);

  const handleCardClick = (companyName) => {
    setSelectedCompany(companyName);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 w-full">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500 max-w-[1600px] mx-auto p-4 md:p-6 w-full">
        <p className="text-lg font-semibold">Failed to load companies</p>
        <p className="text-sm mt-1 text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Purchase Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totals.companies} companies · {totals.purchases} purchases total
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Users,        label: "Total Companies", value: totals.companies,              color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: FileText,     label: "Total Purchases", value: totals.purchases,             color: "text-purple-600", bg: "bg-purple-50" },
          { icon: IndianRupee,  label: "Total Amount",   value: `₹${fmt(totals.amount)}`,   color: "text-green-600",  bg: "bg-green-50"  },
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
          placeholder="Search company name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* Company Cards Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          {search ? `No companies matching "${search}"` : "No companies found."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((company) => (
            <CompanyCard
              key={company.company_name}
              company={company}
              onClick={() => handleCardClick(company.company_name)}
            />
          ))}
        </div>
      )}

      {/* Purchase Ledger Modal */}
      {selectedCompany && (
        <PurchaseLedgerModal
          companyName={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}

function CompanyCard({ company, onClick }) {
  const initials = getInitials(company.company_name);
  const bgColor = avatarColor(company.company_name);
  const lastDate = company.last_purchase_date
    ? dayjs(company.last_purchase_date).format("DD MMM YYYY")
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
            {company.company_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Last: {lastDate}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Purchases</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">
            {company.purchase_count}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total</p>
          <p className="text-base font-bold text-green-600 mt-0.5">
            ₹{fmt(company.total_amount)}
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
