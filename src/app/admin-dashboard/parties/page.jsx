"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Pencil,
  MessageCircle,
  Phone,
  Bell,
  Loader2,
  Database,
} from "lucide-react";
import toast from "react-hot-toast";
import LedgerTableClient from "@/app/admin-dashboard/ledger/[companyName]/LedgerTableClient";

function formatAmount(n) {
  return (
    "₹ " +
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function computeLedgerNet(entries) {
  const debit = (entries || []).reduce(
    (sum, row) => sum + Number(row.debit || 0),
    0,
  );
  const credit = (entries || []).reduce(
    (sum, row) => sum + Number(row.credit || 0),
    0,
  );
  return debit - credit;
}

/** Same Dr/Cr as LedgerTableClient net balance card */
function formatLedgerNet(net) {
  const value = Number(net || 0);
  if (Math.abs(value) <= 0.01) {
    return { amount: 0, suffix: null, colorClass: "text-gray-500" };
  }
  if (value >= 0) {
    return { amount: value, suffix: "Dr", colorClass: "text-red-600" };
  }
  return { amount: Math.abs(value), suffix: "Cr", colorClass: "text-green-600" };
}

function formatSidebarNetBalance(p) {
  const net = Number(p.net_balance ?? p.balance ?? 0);
  if (p.balanceFromLedger && p.balance_side) {
    if (p.balance_side === "flat") {
      return { amount: 0, suffix: null, colorClass: "text-gray-500" };
    }
    if (p.balance_side === "Dr") {
      return {
        amount: Math.abs(net),
        suffix: "Dr",
        colorClass: "text-red-600",
      };
    }
    return {
      amount: Math.abs(net),
      suffix: "Cr",
      colorClass: "text-green-600",
    };
  }
  return formatLedgerNet(net);
}

async function fetchPartiesList() {
  const res = await fetch("/api/parties/list");
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || "Failed to load parties");
  }
  return data.parties || [];
}

function rowKey(p) {
  const cid =
    p.customer_id != null ? String(p.customer_id).trim() : "";
  if (cid) return `cid:${cid}`;
  return `name:${(p.name || "").toLowerCase()}`;
}

function displayCustomerId(p) {
  if (p?.customer_id == null) return "";
  const id = String(p.customer_id).trim();
  return id && id !== "0" ? id : "";
}

function formatSidebarCustomerMeta(p) {
  const id = displayCustomerId(p);
  const clientName = String(p?.client_name || "").trim();
  if (!id) return clientName;
  if (clientName) return `${clientName} (${id})`;
  return `(${id})`;
}

export default function PartiesPage() {
  const [search, setSearch] = useState("");
  const [parties, setParties] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [selectedKey, setSelectedKey] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState(null);
  const [ledgerSyncLoading, setLedgerSyncLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me");
        const data = await res.json();
        if (!cancelled && res.ok) {
          const role = String(data.userRole || data.role || "").toUpperCase();
          setIsSuperAdmin(role === "SUPERADMIN");
        }
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const loaded = await fetchPartiesList();
        if (cancelled) return;
        setParties(loaded);
        if (loaded.length > 0 && !selectedKey) {
          setSelectedKey(rowKey(loaded[0]));
        }
      } catch (err) {
        if (!cancelled) setListError(err?.message || String(err));
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => parties.find((p) => rowKey(p) === selectedKey) ?? null,
    [parties, selectedKey]
  );

  useEffect(() => {
    if (!selected || !selected.name) {
      setLedgerEntries([]);
      setLedgerLoading(false);
      return;
    }
    setLedgerLoading(true);
    setLedgerEntries([]);
    setLedgerError(null);

    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ name: selected.name });
        if (selected.customer_id) {
          params.set("customer_id", String(selected.customer_id));
        }
        const url = "/api/parties/__unused__/ledger?" + params.toString();
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          throw new Error(data.error || data.message || "Failed to load ledger");
        }
        setLedgerEntries(data.entries || []);
        try {
          const loaded = await fetchPartiesList();
          if (!cancelled) setParties(loaded);
        } catch (_) {}
      } catch (err) {
        if (!cancelled) {
          setLedgerError(err?.message || String(err));
          setLedgerEntries([]);
        }
      } finally {
        if (!cancelled) setLedgerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, selected?.name, selected?.customer_id]);

  const selectedLedgerNet = useMemo(() => {
    if (!selectedKey || ledgerLoading) return null;
    return computeLedgerNet(ledgerEntries);
  }, [selectedKey, ledgerEntries, ledgerLoading]);

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (
        Array.isArray(p.searchableNames) &&
        p.searchableNames.some((name) =>
          String(name || "").toLowerCase().includes(q),
        )
      ) {
        return true;
      }
      if (p.phone && String(p.phone).includes(q)) return true;
      if (p.gstin && String(p.gstin).toLowerCase().includes(q)) return true;
      if (p.customer_id && String(p.customer_id).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [parties, search]);

  const handleSyncAllLedgers = useCallback(async () => {
    if (
      !window.confirm(
        "Save all party ledgers to the database? This may take several minutes.",
      )
    ) {
      return;
    }
    setLedgerSyncLoading(true);
    try {
      const res = await fetch("/api/parties/ledger/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncAll: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || data.message || "Failed to save ledgers to database",
        );
      }
      const failed = Number(data.parties_failed || 0);
      const synced = Number(data.parties_synced || 0);
      if (synced === 0 && failed > 0) {
        const hint =
          Array.isArray(data.error_messages) && data.error_messages[0]
            ? data.error_messages[0]
            : "See console for details";
        toast.error(`Ledger sync failed: ${hint}`);
        console.warn("[ledger sync errors]", data.errors, data.error_messages);
        return;
      }
      const skippedParties = Number(data.parties_skipped || 0);
      const inserted = Number(data.lines_inserted || 0);
      toast.success(
        skippedParties > 0
          ? `Added ${inserted} new lines; ${skippedParties} parties already in DB (skipped)`
          : `Saved ${data.total_lines ?? 0} lines for ${synced} parties` +
            (failed > 0 ? ` (${failed} failed)` : ""),
      );
      if (failed > 0 && Array.isArray(data.errors) && data.errors.length > 0) {
        console.warn("[ledger sync errors]", data.errors);
      }
      try {
        const loaded = await fetchPartiesList();
        setParties(loaded);
      } catch (_) {}
    } catch (err) {
      toast.error(err?.message || "Ledger sync failed");
    } finally {
      setLedgerSyncLoading(false);
    }
  }, []);

  return (
    <div className="h-[calc(100vh-2rem)] w-full bg-gray-50 flex flex-col">
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Left Panel – Party List */}
        <aside className="w-[320px] flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Party Name"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleSyncAllLedgers}
                disabled={ledgerSyncLoading}
                title="Save all party ledgers to party_ledger_lines table"
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {ledgerSyncLoading ? (
                  <Loader2 size={14} className="animate-spin shrink-0" />
                ) : (
                  <Database size={14} className="shrink-0" />
                )}
                {ledgerSyncLoading ? "Saving ledgers…" : "Save all ledgers to DB"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto] text-xs font-medium text-gray-600 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-1 px-3 py-2 border-r border-gray-100">
              Party Name
              <Filter size={12} className="text-red-500" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2">
              Net Balance
              <Filter size={12} className="text-gray-400" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {listLoading ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
                <span className="text-sm text-gray-500">Loading parties…</span>
              </div>
            ) : listError ? (
              <div className="p-6 text-center text-sm text-red-500">
                {listError}
              </div>
            ) : filteredParties.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No parties found
              </div>
            ) : (
              filteredParties.map((p) => {
                const isSelected = rowKey(p) === selectedKey;
                const partyForNet =
                  isSelected && selectedLedgerNet !== null
                    ? {
                        ...p,
                        net_balance: selectedLedgerNet,
                        balance: selectedLedgerNet,
                        balanceFromLedger: true,
                        balance_side:
                          Math.abs(selectedLedgerNet) <= 0.01
                            ? "flat"
                            : selectedLedgerNet >= 0
                              ? "Dr"
                              : "Cr",
                      }
                    : p;
                const { amount, suffix, colorClass } =
                  formatSidebarNetBalance(partyForNet);
                const customerMeta = formatSidebarCustomerMeta(p);
                return (
                  <button
                    key={rowKey(p)}
                    type="button"
                    onClick={() => setSelectedKey(rowKey(p))}
                    className={`w-full grid grid-cols-[1fr_auto] items-center px-3 py-3 text-left text-sm transition-colors ${
                      isSelected ? "bg-blue-100" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span
                        className={`font-medium truncate block ${
                          isSelected ? "text-gray-900" : "text-gray-700"
                        }`}
                        title={p.name}
                      >
                        {p.name}
                      </span>
                      {customerMeta ? (
                        <span
                          className={`text-xs mt-0.5 block truncate ${
                            isSelected ? "text-gray-500" : "text-gray-400"
                          }`}
                          title={customerMeta}
                        >
                          {customerMeta}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`font-semibold tabular-nums whitespace-nowrap self-start text-right ${colorClass}`}
                    >
                      <div className="leading-tight">{formatAmount(amount)}</div>
                      {suffix && (
                        <div className="text-[10px] font-medium opacity-75 mt-0.5">
                          {suffix}
                        </div>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Panel – Party Details + Ledger Table */}
        <section className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Party header */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-800 truncate">
                    {selected ? selected.name : "Select a party"}
                  </h2>
                  <button
                    type="button"
                    className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                    title="Edit party"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs uppercase tracking-wide">
                      Phone Number
                    </div>
                    <div className="text-gray-800 font-medium mt-0.5">
                      {selected?.phone || selected?.client_number || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs uppercase tracking-wide">
                      Billing Address
                    </div>
                    <div className="text-gray-800 font-medium mt-0.5 break-words">
                      {selected?.billing_address || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs uppercase tracking-wide">
                      Customer ID
                    </div>
                    <div className="text-gray-800 font-medium mt-0.5">
                      {displayCustomerId(selected) || "—"}
                    </div>
                  </div>
                  {selected?.gstin && (
                    <div>
                      <div className="text-gray-400 text-xs uppercase tracking-wide">
                        GSTIN
                      </div>
                      <div className="text-gray-800 font-medium mt-0.5">
                        {selected.gstin}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 flex items-center justify-center"
                  title="Chat"
                >
                  <MessageCircle size={18} />
                </button>
                <button
                  type="button"
                  className="w-9 h-9 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"
                  title="WhatsApp / Call"
                >
                  <Phone size={18} />
                </button>
                <button
                  type="button"
                  className="relative w-9 h-9 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 flex items-center justify-center"
                  title="Notifications"
                >
                  <Bell size={18} />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Ledger Table – same component used on ledger page */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm overflow-auto">
            {ledgerLoading ? (
              <div className="p-10 flex items-center justify-center">
                <Loader2
                  size={20}
                  className="animate-spin text-blue-600 mr-3"
                />
                <span className="text-sm text-gray-500">
                  Loading ledger entries…
                </span>
              </div>
            ) : ledgerError ? (
              <div className="p-10 text-center">
                <p className="text-red-500 text-sm mb-2">
                  Failed to load ledger
                </p>
                <p className="text-gray-500 text-xs">{ledgerError}</p>
                {!selected && (
                  <p className="text-gray-400 text-xs mt-2">
                    Select a party from the left panel
                  </p>
                )}
              </div>
            ) : selected ? (
              <div className="p-4 w-full">
                <LedgerTableClient
                  key={selectedKey}
                  rows={ledgerEntries}
                  companyName={selected.name}
                  customerId={selected.customer_id || null}
                />
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-gray-400">
                Select a party from the left panel to view ledger
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
