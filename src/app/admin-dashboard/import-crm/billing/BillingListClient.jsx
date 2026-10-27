"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, CreditCard } from "lucide-react";
import toast from "react-hot-toast";

/* ─── helpers ─────────────────────────────────────────────────────── */
function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function numMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fileLabel(p) {
  if (!p || String(p).trim() === "") return null;
  const parts = String(p).replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
}
function billingFileUrl(storedPath, billingId) {
  if (!storedPath || !billingId) return null;
  const p = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");
  const prefix = "import-crm-billing/";
  if (!p.startsWith(prefix)) return null;
  const rest = p.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const fname = rest.slice(slash + 1);
  if (!fname) return null;
  return `/api/import-crm/billing-file/${billingId}/${encodeURIComponent(fname)}`;
}

function paymentProofUrl(storedPath, billingId) {
  if (!storedPath || !billingId) return null;
  const p = String(storedPath).replace(/\\/g, "/").replace(/^\/+/, "");
  const prefix = "import-crm-billing-payment/";
  if (!p.startsWith(prefix)) return null;
  const rest = p.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const fname = rest.slice(slash + 1);
  if (!fname) return null;
  return `/api/import-crm/billing-payment-file/${billingId}/${encodeURIComponent(fname)}`;
}

const PAYMENT_MODES = ["Bank transfer", "NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash", "Other"];

/* ─── payment modal ─────────────────────────────────────────────────── */
function PaymentModal({ open, row, onClose, onDone }) {
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [transactionNo, setTransactionNo] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open && row) {
      setPaymentDate("");
      setPaymentMode("");
      setTransactionNo("");
      setAmountPaid(row.approved_amount != null ? String(row.approved_amount) : "");
      setAdminRemarks("");
      setProofFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, row]);

  if (!open || !row) return null;

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      if (paymentDate) fd.append("payment_date", paymentDate);
      if (paymentMode) fd.append("payment_mode", paymentMode);
      if (transactionNo) fd.append("payment_transaction_no", transactionNo);
      if (amountPaid) fd.append("amount_paid", amountPaid);
      if (adminRemarks) fd.append("admin_remarks", adminRemarks);
      if (proofFile) fd.append("payment_proof", proofFile);

      const res = await fetch(`/api/import-crm/billing/${row.id}/payment`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(data.message || "Payment recorded");
      onDone(row.id, {
        payment_date: paymentDate || null,
        payment_mode: paymentMode || null,
        payment_transaction_no: transactionNo || null,
        amount_paid: amountPaid !== "" ? amountPaid : null,
        payment_proof_file: data.payment_proof_file || null,
        payment_sent_at: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Record payment</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Fill payment details — agent will receive an email confirmation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info strip */}
        <div className="mx-5 mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
          <span className="font-semibold">Billing #{row.id}</span>
          <span className="mx-2 text-slate-300">·</span>
          Shipment #{row.shipment_id}
          <span className="mx-2 text-slate-300">·</span>
          {row.agent_email || "—"}
          {row.approved_amount != null && (
            <>
              <span className="mx-2 text-slate-300">·</span>
              <span className="font-semibold text-emerald-700">
                Approved: ₹ {Number(row.approved_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3.5 px-5 py-4">
          {/* Payment date */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Payment date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Payment mode */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Payment mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select mode…</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Transaction no */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Transaction / reference no.</label>
            <input
              type="text"
              value={transactionNo}
              onChange={(e) => setTransactionNo(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="e.g. TXN123456"
            />
          </div>

          {/* Amount paid */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Amount paid (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="0.00"
            />
          </div>

          {/* Payment proof */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Payment proof (screenshot / receipt)
            </label>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-indigo-400 hover:bg-indigo-50/20">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">PDF or image, max 15 MB</p>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Remarks (optional)</label>
            <textarea
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Any notes…"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Sending…" : "Record & send email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── status badge ─────────────────────────────────────────────────── */
const STATUS_CFG = {
  PENDING:  { label: "Pending",  cls: "bg-amber-100 text-amber-900" },
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-900" },
  HOLD:     { label: "Hold",     cls: "bg-yellow-100 text-yellow-900" },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-800" },
};
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

/* ─── action confirm modal ─────────────────────────────────────────── */
const ACTION_CFG = {
  APPROVED: {
    label: "Approve",
    title: "Approve billing",
    desc: "Mark this billing submission as approved.",
    btnCls: "bg-emerald-600 hover:bg-emerald-700 text-white",
    remarkLabel: "Remarks (optional)",
  },
  HOLD: {
    label: "Hold",
    title: "Put on hold",
    desc: "Put this billing submission on hold.",
    btnCls: "bg-yellow-500 hover:bg-yellow-600 text-white",
    remarkLabel: "Reason for hold (optional)",
  },
  REJECTED: {
    label: "Reject",
    title: "Reject billing",
    desc: "Reject this billing submission.",
    btnCls: "bg-red-600 hover:bg-red-700 text-white",
    remarkLabel: "Reason for rejection (optional)",
  },
  REASSIGN: {
    label: "Re-assign",
    title: "Re-assign billing form",
    desc: "This will reset the billing data and send a fresh form link to the agent's email.",
    btnCls: "bg-blue-600 hover:bg-blue-700 text-white",
    remarkLabel: "Note (optional)",
  },
};

function ActionModal({ open, action, row, onClose, onDone }) {
  const cfg = ACTION_CFG[action];
  const [remark, setRemark] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef(null);
  const remarkRef = useRef(null);

  useEffect(() => {
    if (open) {
      setRemark("");
      setApprovedAmount(
        action === "APPROVED" && row?.bill_amount != null
          ? String(row.bill_amount)
          : "",
      );
      setTimeout(() => {
        (action === "APPROVED" ? amountRef : remarkRef).current?.focus();
      }, 80);
    }
  }, [open, action, row]);

  if (!open || !cfg || !row) return null;

  async function submit() {
    setSaving(true);
    try {
      const body = { action, admin_remarks: remark || null };
      if (action === "APPROVED") body.approved_amount = approvedAmount || null;

      const res = await fetch(`/api/import-crm/billing/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Action failed");
      toast.success(data.message || `${cfg.label} done`);
      if (action === "REASSIGN" && data.billingUrl) {
        toast(`New link: ${data.billingUrl}`, { duration: 8000, icon: "🔗" });
      }
      onDone(row.id, action, remark, approvedAmount || null);
      onClose();
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{cfg.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{cfg.desc}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info strip */}
        <div className="mx-5 mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
          <span className="font-semibold">Billing #{row.id}</span>
          <span className="mx-2 text-slate-300">·</span>
          Shipment #{row.shipment_id}
          <span className="mx-2 text-slate-300">·</span>
          {row.agent_email || "—"}
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Approved amount — only for APPROVED action */}
          {action === "APPROVED" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Approved amount (₹)
                <span className="ml-1 text-slate-400 font-normal">
                  — bill amount: {row.bill_amount != null ? `₹ ${Number(row.bill_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                </span>
              </label>
              <input
                ref={amountRef}
                type="number"
                min="0"
                step="0.01"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="0.00"
              />
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              {cfg.remarkLabel}
            </label>
            <textarea
              ref={remarkRef}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter note…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60 ${cfg.btnCls}`}
          >
            {saving ? "Please wait…" : cfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── main component ───────────────────────────────────────────────── */
const HEADERS = [
  "ID", "Shipment", "Route", "Agent email",
  "Bill no.", "Bill date", "Amount", "With invoice",
  "Submission", "Status", "Bill file", "Remarks", "Actions",
];

export default function BillingListClient() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [modal, setModal] = useState({ open: false, action: null, row: null });
  const [payModal, setPayModal] = useState({ open: false, row: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import-crm/billing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setRows(data.rows || []);
    } catch (e) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openModal(action, row) {
    setModal({ open: true, action, row });
  }
  function closeModal() {
    setModal({ open: false, action: null, row: null });
  }

  const handlePaymentDone = useCallback((id, payData) => {
    setRows((prev) =>
      prev.map((r) => (r.id !== id ? r : { ...r, ...payData })),
    );
  }, []);

  // After a successful action update the row in state (no full reload)
  const handleDone = useCallback((id, action, adminRemarks, approvedAmt) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (action === "REASSIGN") {
          return { ...r, status: "PENDING", admin_remarks: adminRemarks, submitted_at: null, bill_no: null };
        }
        return {
          ...r,
          status: action,
          admin_remarks: adminRemarks,
          ...(action === "APPROVED" && { approved_amount: approvedAmt }),
        };
      }),
    );
  }, []);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.values(r)
        .filter((v) => v != null && v !== "")
        .map((v) => String(v))
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, searchText]);

  return (
    <>
      <ActionModal
        open={modal.open}
        action={modal.action}
        row={modal.row}
        onClose={closeModal}
        onDone={handleDone}
      />
      <PaymentModal
        open={payModal.open}
        row={payModal.row}
        onClose={() => setPayModal({ open: false, row: null })}
        onDone={handlePaymentDone}
      />

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search bill no, agent, shipment, amount…"
              autoComplete="off"
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="h-11 shrink-0 rounded-[10px] border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* table */}
      <div className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-500">
            Loading…
          </div>
        )}
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[90rem] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3 sm:text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length} className="px-4 py-12 text-center text-slate-500">
                    {searchText.trim()
                      ? "No rows match this search."
                      : "No billing submissions yet. Billing forms are sent to agents after you approve an award follow-up."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const fileUrl = billingFileUrl(r.bill_file, r.id);
                  const fname = fileLabel(r.bill_file);
                  const isImg = fname && /\.(jpe?g|png|gif|webp|bmp)$/i.test(fname);
                  const isPdf = fname && /\.pdf$/i.test(fname);
                  const status = r.status || "PENDING";

                  return (
                    <tr key={r.id} className="bg-white hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-900 sm:px-4 sm:py-3">
                        {r.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs sm:px-4 sm:py-3">
                        #{r.shipment_id}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2.5 text-xs text-slate-700 sm:px-4 sm:py-3">
                        <span className="line-clamp-2">
                          {r.ship_from || "—"} → {r.ship_to || "—"}
                        </span>
                      </td>
                      <td className="max-w-[12rem] break-all px-3 py-2.5 text-xs sm:px-4 sm:py-3">
                        {r.agent_email || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium sm:px-4 sm:py-3">
                        {r.bill_no || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:py-3">
                        {formatDateOnly(r.bill_date)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums sm:px-4 sm:py-3">
                        {numMoney(r.bill_amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                        {r.with_invoice ? (
                          <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            No
                          </span>
                        )}
                      </td>
                      {/* submission */}
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4 sm:py-3">
                        {r.submitted_at ? (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="inline-flex rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900">
                              Submitted
                            </span>
                            <span className="text-[10px] text-slate-500">{formatDate(r.submitted_at)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                            Awaiting
                          </span>
                        )}
                      </td>
                      {/* status */}
                      <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="inline-flex flex-col gap-0.5">
                          <StatusBadge status={status} />
                          {status === "APPROVED" && r.approved_amount != null && (
                            <span className="text-[11px] font-semibold tabular-nums text-emerald-700">
                              ₹ {Number(r.approved_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          {r.admin_remarks ? (
                            <span className="max-w-[8rem] truncate text-[10px] text-slate-400" title={r.admin_remarks}>
                              {r.admin_remarks}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      {/* file */}
                      <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                        {fileUrl && fname ? (
                          isImg ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-12 w-12 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm transition hover:ring-2 hover:ring-teal-300"
                              title={fname}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={fileUrl} alt="bill" className="h-full w-full object-cover" />
                            </a>
                          ) : isPdf ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-extrabold text-red-800 hover:bg-red-100"
                              title={fname}
                            >
                              PDF
                            </a>
                          ) : (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                              title={fname}
                            >
                              FILE
                            </a>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      {/* remarks */}
                      <td className="max-w-[8rem] px-3 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3">
                        <span className="line-clamp-2" title={r.remarks || ""}>{r.remarks || "—"}</span>
                      </td>
                      {/* actions */}
                      <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* These actions are only available before approval */}
                          {status !== "APPROVED" && (
                            <>
                              <button
                                type="button"
                                onClick={() => openModal("APPROVED", r)}
                                title="Approve"
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => openModal("HOLD", r)}
                                disabled={status === "HOLD"}
                                title="Hold"
                                className="rounded-md border border-yellow-200 bg-yellow-50 px-2.5 py-1 text-[11px] font-semibold text-yellow-800 hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Hold
                              </button>
                              <button
                                type="button"
                                onClick={() => openModal("REJECTED", r)}
                                disabled={status === "REJECTED"}
                                title="Reject"
                                className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => openModal("REASSIGN", r)}
                                title="Re-assign — reset form and send new link to agent"
                                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Re-assign
                              </button>
                            </>
                          )}
                          {/* Payment button — only when APPROVED */}
                          {status === "APPROVED" && (
                            <button
                              type="button"
                              onClick={() => setPayModal({ open: true, row: r })}
                              title={r.payment_sent_at ? "Payment already sent — click to update" : "Record payment & email agent"}
                              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                                r.payment_sent_at
                                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                  : "border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-700"
                              }`}
                            >
                              <CreditCard className="h-3 w-3" strokeWidth={2} />
                              {r.payment_sent_at ? "Update payment" : "Send payment"}
                            </button>
                          )}
                        </div>
                        {/* Payment summary under buttons */}
                        {r.payment_sent_at && (
                          <div className="mt-1.5 space-y-0.5 text-[10px] text-slate-500">
                            {r.payment_date && <p>Date: <span className="text-slate-700">{formatDateOnly(r.payment_date)}</span></p>}
                            {r.payment_mode && <p>Mode: <span className="text-slate-700">{r.payment_mode}</span></p>}
                            {r.payment_transaction_no && <p>Txn: <span className="font-mono text-slate-700">{r.payment_transaction_no}</span></p>}
                            {r.amount_paid != null && (
                              <p>Paid: <span className="font-semibold text-indigo-700">₹ {Number(r.amount_paid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
                            )}
                            {r.payment_proof_file && (() => {
                              const pUrl = paymentProofUrl(r.payment_proof_file, r.id);
                              return pUrl ? (
                                <p>
                                  <a href={pUrl} target="_blank" rel="noopener noreferrer"
                                     className="text-indigo-600 underline underline-offset-2">
                                    View proof
                                  </a>
                                </p>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
