"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { X, Search } from "lucide-react";

function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PartyPaymentStatementLinkModal({
  open,
  onClose,
  partyPaymentId,
  selectedIds,
  onConfirm,
}) {
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setPicked(Array.isArray(selectedIds) ? [...selectedIds] : []);
    setSearch("");
  }, [open, selectedIds]);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    try {
      const q =
        partyPaymentId != null && partyPaymentId !== ""
          ? `?party_payment_id=${encodeURIComponent(partyPaymentId)}`
          : "";
      const res = await fetch(`/api/party-payments/unsettled-statements${q}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load statements");
      setStatements(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      toast.error(err.message || "Failed to load unsettled statements");
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, [partyPaymentId]);

  useEffect(() => {
    if (open) fetchStatements();
  }, [open, fetchStatements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statements;
    return statements.filter((s) => {
      const hay = [
        s.id,
        s.trans_id,
        s.description,
        s.amount,
        s.date,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [statements, search]);

  const selectedTotals = useMemo(() => {
    const idSet = new Set(picked.map(Number));
    let credit = 0;
    let debit = 0;
    for (const s of statements) {
      if (!idSet.has(Number(s.id))) continue;
      const amt = Math.abs(Number(s.amount) || 0);
      const type = String(s.type || "").trim();
      if (type === "Credit") credit += amt;
      else if (type === "Debit") debit += amt;
    }
    return {
      credit: Number(credit.toFixed(2)),
      debit: Number(debit.toFixed(2)),
    };
  }, [picked, statements]);

  const toggle = (id) => {
    const n = Number(id);
    setPicked((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  };

  const handleConfirm = () => {
    if (!picked.length) {
      toast.error("Select at least one unsettled statement");
      return;
    }
    const idSet = new Set(picked.map(Number));
    const selectedRows = statements.filter((s) => idSet.has(Number(s.id)));
    let latestDate = "";
    for (const row of selectedRows) {
      const d = row.date ? String(row.date).slice(0, 10) : "";
      if (d && (!latestDate || d > latestDate)) latestDate = d;
    }
    onConfirm?.({
      statementIds: picked.map(Number),
      amountIn: selectedTotals.credit,
      amountOut: selectedTotals.debit,
      paymentDate: latestDate,
    });
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment link — unsettled statements</h3>
            <p className="text-sm text-gray-500">
              Unsettled <strong>Credit</strong> → In amount; unsettled <strong>Debit</strong> → Out amount.
            </p>
            <p className="text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Credit (In):{" "}
                <span className="font-semibold text-green-700">
                  {formatInr(selectedTotals.credit)}
                </span>
              </span>
              <span>
                Debit (Out):{" "}
                <span className="font-semibold text-red-700">
                  {formatInr(selectedTotals.debit)}
                </span>
              </span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search UTR, description, amount…"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Loading statements…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No unsettled credit or debit statements found.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((s) => {
                const id = Number(s.id);
                const checked = picked.includes(id);
                return (
                  <li key={s.id}>
                    <label className="flex items-start gap-3 py-3 cursor-pointer hover:bg-gray-50 rounded-lg px-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-x-3 text-sm font-medium text-gray-900">
                          <span
                            className={
                              String(s.type || "").trim() === "Debit"
                                ? "text-red-700"
                                : "text-green-700"
                            }
                          >
                            {String(s.type || "—").trim()}
                            {": "}
                            {formatInr(Math.abs(Number(s.amount) || 0))}
                          </span>
                          <span className="text-gray-500">{s.date ? String(s.date).slice(0, 10) : "—"}</span>
                          <span className="text-gray-500 font-mono text-xs">UTR: {s.trans_id || "—"}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{s.description || "—"}</p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t px-5 py-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply to In / Out
          </button>
        </div>
      </div>
    </div>
  );
}
