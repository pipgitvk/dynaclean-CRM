"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { formatClientExpenseShort } from "@/lib/formatClientExpenseOptionLabel";

function headSubLines(e) {
  const head = e?.head != null && String(e.head).trim() !== "" ? String(e.head).trim() : "";
  let subStr = "";
  if (Array.isArray(e?.sub_heads)) {
    subStr = e.sub_heads.map((s) => String(s || "").trim()).filter(Boolean).join(", ");
  } else if (e?.sub_heads_joined != null && String(e.sub_heads_joined).trim() !== "") {
    subStr = String(e.sub_heads_joined).trim();
  }
  return { head, subStr };
}

function subParts(subStr) {
  if (!subStr || typeof subStr !== "string") return [];
  return subStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalize API / form allocation so ticks restore reliably after reopen. */
function normalizeStatementExpenseAllocation(raw) {
  if (raw == null) return null;
  let o = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      o = JSON.parse(t);
    } catch {
      return null;
    }
  }
  if (typeof o !== "object" || o === null || Array.isArray(o)) return null;
  const includeHead = o.includeHead !== false;
  const includeSubs = Array.isArray(o.includeSubs)
    ? o.includeSubs.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const headLabel =
    o.headLabel != null && String(o.headLabel).trim() !== ""
      ? String(o.headLabel).trim()
      : null;
  return { includeHead, includeSubs, headLabel };
}

/**
 * Single Expense ID control: short labels; expand → tick Head / Sub-heads; Select applies allocation to linked expense.
 * @param allocation Saved allocation `{ includeHead, includeSubs, headLabel }` or null
 * @param onChange (clientExpenseId, allocation | null)
 */
export default function StatementExpensePicker({
  expenses,
  value,
  allocation,
  onChange,
  statementTransId,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [includeHead, setIncludeHead] = useState(true);
  const [selectedSubs, setSelectedSubs] = useState(() => new Set());
  const rootRef = useRef(null);
  /** In-session ticks before "Select", keyed by expense id (survives close/reopen). */
  const draftAllocationRef = useRef(new Map());
  const lastAutoSyncRef = useRef("");
  /** Option overrides (template fetch) keyed by expenseKey. */
  const [optionOverrides, setOptionOverrides] = useState({});

  useEffect(() => {
    const fn = (ev) => {
      if (rootRef.current && !rootRef.current.contains(ev.target)) {
        setOpen(false);
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const tx =
    statementTransId != null && String(statementTransId).trim() !== ""
      ? String(statementTransId).trim()
      : null;
  const rawList = useMemo(() => expenses ?? [], [expenses]);
  const list = useMemo(() => {
    const arr = rawList;
    if (!tx) return arr;

    // If a statement-linked clone exists (transaction_id == trans_id) for a given expense group,
    // hide other rows in that group to prevent accidental re-cloning.
    const keyOf = (e) =>
      `${String(e?.expense_name ?? "").trim()}|${String(e?.client_name ?? "").trim()}|${String(e?.group_name ?? "").trim()}`;

    const hasDedicated = new Set();
    for (const e of arr) {
      if (String(e?.transaction_id ?? "").trim() === tx) {
        hasDedicated.add(keyOf(e));
      }
    }
    if (hasDedicated.size === 0) return arr;
    return arr.filter((e) => {
      const k = keyOf(e);
      if (!hasDedicated.has(k)) return true;
      return String(e?.transaction_id ?? "").trim() === tx;
    });
  }, [rawList, tx]);
  const selected = list.find((e) => String(e.id) === String(value));
  const normAlloc = useMemo(() => normalizeStatementExpenseAllocation(allocation), [allocation]);

  function expenseKey(e) {
    return `${String(e?.expense_name ?? "").trim()}|${String(e?.client_name ?? "").trim()}|${String(e?.group_name ?? "").trim()}`;
  }

  function bestOptionSource(expenseRow) {
    if (!expenseRow) return expenseRow;
    const k = expenseKey(expenseRow);
    const ov = optionOverrides?.[k];
    if (ov) {
      return {
        ...expenseRow,
        head: ov.head,
        sub_heads_joined: ov.subStr,
      };
    }
    const candidates = rawList.filter((x) => expenseKey(x) === k);
    if (candidates.length === 0) return expenseRow;
    let best = candidates[0];
    let bestCount = subParts(headSubLines(best).subStr).length;
    for (const c of candidates) {
      const cnt = subParts(headSubLines(c).subStr).length;
      if (cnt > bestCount) {
        best = c;
        bestCount = cnt;
      }
    }
    return best;
  }

  // When expanding a statement-linked row, try to fetch the template (transaction_id empty)
  // so we can show the full list of sub-head options even if the clone currently has only a subset.
  useEffect(() => {
    if (!expandedId) return;
    const exp = list.find((x) => String(x.id) === String(expandedId));
    if (!exp) return;
    const k = expenseKey(exp);
    if (optionOverrides?.[k]) return;
    const candidates = rawList.filter((x) => expenseKey(x) === k);
    const template = candidates.find((x) => String(x?.transaction_id ?? "").trim() === "");
    if (!template) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/client-expenses/${Number(template.id)}`, {
          credentials: "include",
        });
        const data = await r.json();
        if (!r.ok || !data || data.error) return;
        const head = data.head != null ? String(data.head).trim() : "";
        const subStr = Array.isArray(data.sub_heads)
          ? data.sub_heads.map((s) => String(s || "").trim()).filter(Boolean).join(", ")
          : "";
        if (cancelled) return;
        setOptionOverrides((prev) => ({
          ...prev,
          [k]: { head, subStr },
        }));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expandedId, list, rawList, optionOverrides]);

  // Keep draft in sync with the saved allocation for the currently selected expense.
  // This prevents reopen → "all ticks" when the user had just unticked some items in the session.
  useEffect(() => {
    const sid = value != null && String(value).trim() !== "" ? String(value) : null;
    if (!sid) return;
    if (normAlloc) {
      draftAllocationRef.current.set(sid, {
        includeHead: normAlloc.includeHead,
        includeSubs: Array.isArray(normAlloc.includeSubs) ? normAlloc.includeSubs : [],
      });
    } else {
      draftAllocationRef.current.delete(sid);
    }
  }, [value, normAlloc]);

  const saveDraftForExpanded = useCallback(() => {
    const id = expandedId;
    if (id == null) return;
    const sid = String(id);
    draftAllocationRef.current.set(sid, { includeHead, includeSubs: [...selectedSubs] });
  }, [expandedId, includeHead, selectedSubs]);

  useEffect(() => {
    saveDraftForExpanded();
  }, [saveDraftForExpanded]);

  // Auto-sync ticks → parent allocation while editing (so "Save Changes" works even without pressing Select).
  useEffect(() => {
    if (disabled) return;
    if (expandedId == null) return;
    const exp = list.find((x) => String(x.id) === String(expandedId));
    if (!exp) return;

    const sid = String(exp.id);
    // Only auto-sync for the currently selected expense (or when no selection yet).
    const selectedId = value != null && String(value).trim() !== "" ? String(value) : "";
    if (selectedId && selectedId !== sid) return;

    const src = bestOptionSource(exp);
    const { head, subStr } = headSubLines(src);
    const parts = subParts(subStr);
    const hasCat = !!head || parts.length > 0;
    if (!hasCat) return;

    const headOk = !!head && !!includeHead;
    const subs = parts.filter((p) => selectedSubs.has(p));

    // Don't push invalid "nothing selected" state automatically; user must keep at least one tick.
    if (!headOk && subs.length === 0) return;

    const nextAlloc = { includeHead: headOk, includeSubs: subs, headLabel: head || null };
    const sig = JSON.stringify({ sid, nextAlloc });
    if (sig === lastAutoSyncRef.current) return;
    lastAutoSyncRef.current = sig;

    onChange(sid, nextAlloc);
  }, [disabled, expandedId, includeHead, selectedSubs, list, value, onChange]);

  function initTicksForExpense(expenseRow) {
    if (!expenseRow) return;
    const src = bestOptionSource(expenseRow);
    const { head, subStr } = headSubLines(src);
    const parts = subParts(subStr);
    const sid = String(expenseRow.id);
    const sameRow = value != null && String(value) === sid;
    const draft = draftAllocationRef.current.get(sid);
    if (draft) {
      setIncludeHead(!!draft.includeHead && !!head);
      const allowed = new Set(parts);
      setSelectedSubs(new Set((draft.includeSubs || []).filter((s) => allowed.has(s))));
      return;
    }
    if (sameRow && normAlloc) {
      setIncludeHead(normAlloc.includeHead && !!head);
      const allowed = new Set(parts);
      const subs = normAlloc.includeSubs.filter((s) => allowed.has(s));
      setSelectedSubs(new Set(subs));
      return;
    }
    setIncludeHead(!!head);
    setSelectedSubs(new Set(parts));
  }

  // Apply ticks when row expands, saved allocation loads, or expense list gets the row.
  useEffect(() => {
    if (!expandedId) return;
    const e = list.find((x) => String(x.id) === String(expandedId));
    if (!e) return;
    initTicksForExpense(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initTicksForExpense uses latest normAlloc/value/draft
  }, [normAlloc, value, expandedId, list]);

  const toggleSub = (sh) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(sh)) next.delete(sh);
      else next.add(sh);
      return next;
    });
  };

  const confirmSelect = (e) => {
    const src = bestOptionSource(e);
    const { head, subStr } = headSubLines(src);
    const parts = subParts(subStr);
    const hasCat = !!head || parts.length > 0;
    const expanded = String(expandedId) === String(e.id);
    let ih = includeHead;
    let subs = selectedSubs;
    if (!expanded) {
      ih = !!head;
      subs = new Set(parts);
    }

    if (hasCat) {
      const headOk = ih && !!head;
      const anySub = parts.some((p) => subs.has(p));
      if (!headOk && !anySub) {
        toast.error("Select Head and/or at least one Sub-head — amount applies only to ticked items.");
        return;
      }
      onChange(String(e.id), {
        includeHead: headOk,
        includeSubs: parts.filter((p) => subs.has(p)),
        headLabel: head || null,
      });
      draftAllocationRef.current.set(String(e.id), {
        includeHead: headOk,
        includeSubs: parts.filter((p) => subs.has(p)),
      });
    } else {
      onChange(String(e.id), null);
      draftAllocationRef.current.delete(String(e.id));
    }
    setOpen(false);
    setExpandedId(null);
  };

  const toggleExpand = (id, ev) => {
    ev.stopPropagation();
    setExpandedId((cur) => (cur === id ? null : id));
  };

  return (
    <div className="relative" ref={rootRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">Expense ID</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-left text-sm bg-white flex items-center justify-between gap-2 min-h-[2.5rem] disabled:opacity-60 disabled:cursor-not-allowed hover:border-gray-400"
      >
        <span className={`truncate ${selected ? "text-gray-900" : "text-gray-500"}`}>
          {selected ? formatClientExpenseShort(selected) : "Select expense"}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full border border-gray-200 rounded-md bg-white shadow-lg max-h-96 overflow-y-auto py-1">
          {list.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No expenses loaded</p>
          ) : (
            list.map((e) => {
              const { head, subStr } = headSubLines(e);
              const parts = subParts(subStr);
              const isExp = expandedId != null && String(expandedId) === String(e.id);
              const hasCat = !!head || parts.length > 0;
              return (
                <div key={e.id} className="border-b border-gray-100 last:border-0">
                  <div className="flex items-stretch gap-0">
                    <button
                      type="button"
                      disabled={disabled}
                      className="shrink-0 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs disabled:opacity-50"
                      onClick={(ev) => toggleExpand(e.id, ev)}
                      title={isExp ? "Hide details" : "Show Head / Sub-head"}
                      aria-expanded={isExp}
                    >
                      {isExp ? "▾" : "▸"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      title="Select this expense (Head/Sub ticks apply)"
                      className="flex-1 min-w-0 text-left px-2 py-2.5 text-sm text-gray-900 hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => !disabled && confirmSelect(e)}
                    >
                      {formatClientExpenseShort(e)}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      className="shrink-0 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 border-l border-gray-100 disabled:opacity-50"
                      onClick={() => confirmSelect(e)}
                    >
                      Select
                    </button>
                  </div>
                  {isExp && (
                    <div className="pl-9 pr-3 pb-3 pt-1 text-xs bg-slate-50/90 border-t border-gray-100">
                      {!hasCat ? (
                        <p className="text-gray-500 py-1">No Head / Sub-head on this expense.</p>
                      ) : (
                        <>
                          <p className="text-gray-600 mb-2">
                            Tick Head/Sub where this statement amount applies, then click the expense name or Select.
                            Linked client expense stores only the ticked lines.
                          </p>
                          {head ? (
                            <label className="flex items-start gap-2 py-1 cursor-pointer">
                              <input
                                type="checkbox"
                                className="mt-0.5 w-4 h-4 accent-amber-600 rounded border-gray-300"
                                checked={includeHead}
                                disabled={disabled}
                                onChange={() => setIncludeHead((v) => !v)}
                              />
                              <span>
                                <span className="font-semibold text-gray-800">Head:</span> {head}
                              </span>
                            </label>
                          ) : (
                            <p className="text-gray-400 py-0.5">Head: —</p>
                          )}
                          {parts.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <span className="font-semibold text-gray-800">Sub:</span>
                              {parts.map((sh) => (
                                <label
                                  key={sh}
                                  className="flex items-center gap-2 pl-1 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-amber-600 rounded border-gray-300"
                                    checked={selectedSubs.has(sh)}
                                    disabled={disabled}
                                    onChange={() => toggleSub(sh)}
                                  />
                                  <span>{sh}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
