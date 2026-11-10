"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import CustomerIdSearchField from "@/components/Customers/CustomerIdSearchField";
import PartyPaymentStatementLinkModal from "@/components/party-payments/PartyPaymentStatementLinkModal";
import {
  derivePartyPaymentStatus,
  normalizePartyPaymentAmounts,
  partyPaymentStatusLabel,
} from "@/lib/partyPaymentsCompute";

export const PARTY_PAYMENT_EMPTY_FORM = {
  customer_id: "",
  name: "",
  company_name: "",
  phone: "",
  payment_date: "",
  amount_in: "",
  amount_out: "",
  balance: "",
  linked_statement_ids: [],
};

function parseLinkedIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((id) => Number(id)).filter((id) => id > 0);
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.map((id) => Number(id)).filter((id) => id > 0);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function rowToForm(row) {
  if (!row) return { ...PARTY_PAYMENT_EMPTY_FORM };
  return {
    customer_id: row.customer_id || "",
    name: row.name || "",
    company_name: row.company_name || "",
    phone: row.phone || "",
    payment_date: row.payment_date ? String(row.payment_date).slice(0, 10) : "",
    amount_in: row.amount_in != null ? String(row.amount_in) : "",
    amount_out: row.amount_out != null ? String(row.amount_out) : "",
    balance: row.balance != null ? String(row.balance) : "",
    linked_statement_ids: parseLinkedIds(row.linked_statement_ids),
  };
}

/**
 * Add / edit party payment — same UI as party-payments page "Add Entry".
 */
export default function PartyPaymentEntryModal({
  open,
  onClose,
  onSuccess,
  editing = null,
  initialForm = null,
}) {
  const [form, setForm] = useState(PARTY_PAYMENT_EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const initialFormRef = useRef(initialForm);
  initialFormRef.current = initialForm;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm(rowToForm(editing));
    } else {
      const seed = initialFormRef.current;
      setForm({
        ...PARTY_PAYMENT_EMPTY_FORM,
        ...(seed && typeof seed === "object" ? seed : {}),
        linked_statement_ids: Array.isArray(seed?.linked_statement_ids)
          ? [...seed.linked_statement_ids]
          : PARTY_PAYMENT_EMPTY_FORM.linked_statement_ids,
      });
    }
    setLinkModalOpen(false);
  }, [open, editing]);

  const hasLinkedStatements = (form.linked_statement_ids?.length ?? 0) > 0;

  const preview = useMemo(
    () => normalizePartyPaymentAmounts(form),
    [form.amount_in, form.amount_out],
  );

  const closeModal = () => {
    setLinkModalOpen(false);
    onClose?.();
  };

  const applyStatementLink = ({
    statementIds,
    amountIn,
    amountOut,
    paymentDate,
  }) => {
    setForm((prev) => ({
      ...prev,
      linked_statement_ids: statementIds,
      amount_in: amountIn > 0 ? String(amountIn) : "",
      amount_out:
        amountOut > 0 ? String(amountOut) : amountIn > 0 ? prev.amount_out : "",
      payment_date: paymentDate || prev.payment_date,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const applyCustomerFromMaster = (customer) => {
    if (!customer) return;
    const name =
      String(customer.customer_name || "").trim() ||
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    setForm((prev) => ({
      ...prev,
      customer_id: String(customer.customer_id ?? prev.customer_id),
      name: name || prev.name,
      company_name: customer.company ? String(customer.company) : prev.company_name,
      phone: customer.phone ? String(customer.phone) : prev.phone,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id.trim()) {
      toast.error("Customer ID is required");
      return;
    }
    if (!String(form.phone || "").trim()) {
      toast.error("Phone is required — select a customer with a valid phone");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, ...normalizePartyPaymentAmounts(form) };
      const isEdit = editing != null;
      const url = isEdit
        ? `/api/party-payments/${editing.id}`
        : "/api/party-payments";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isEdit ? "Updated" : "Added");
      closeModal();
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
  <>
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {editing ? "Edit Party Payment" : "Add Party Payment"}
          </h2>
          <button
            type="button"
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomerIdSearchField
              customerId={form.customer_id}
              required
              onCustomerIdChange={(cid) =>
                setForm((prev) => ({
                  ...prev,
                  customer_id: cid,
                  name: "",
                  company_name: "",
                  phone: "",
                }))
              }
              onCustomerSelect={applyCustomerFromMaster}
            />
            <ReadOnlyField label="Name" name="name" value={form.name} />
            <ReadOnlyField
              label="Company Name"
              name="company_name"
              value={form.company_name}
            />
            <ReadOnlyField
              label="Phone"
              name="phone"
              value={form.phone}
              required
            />
            {editing?.created_by ? (
              <ReadOnlyField
                label="Created By"
                name="created_by_display"
                value={editing.created_by}
              />
            ) : null}
            <Field
              label="Payment Date"
              name="payment_date"
              type="date"
              value={form.payment_date}
              onChange={handleChange}
            />
            <div className="sm:col-span-2 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <ReadOnlyField
                    label="In (₹)"
                    name="amount_in"
                    value={form.amount_in}
                    placeholder="Use Payment link"
                    hint="Credit statements via Payment link (In)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(true)}
                  className="px-4 py-2 mb-0.5 rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm font-medium whitespace-nowrap"
                >
                  Payment link
                  {hasLinkedStatements
                    ? ` (${form.linked_statement_ids.length})`
                    : ""}
                </button>
                {hasLinkedStatements ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        linked_statement_ids: [],
                        amount_in: "",
                      }))
                    }
                    className="px-3 py-2 mb-0.5 text-sm text-red-600 hover:underline"
                  >
                    Clear link
                  </button>
                ) : null}
              </div>
            </div>
            <Field
              label="Out (₹)"
              name="amount_out"
              type="number"
              step="0.01"
              value={form.amount_out}
              onChange={handleChange}
            />
            <ReadOnlyField
              label="Balance (₹)"
              name="balance"
              value={
                preview.balance > 0
                  ? preview.balance.toFixed(2)
                  : form.balance || "0.00"
              }
              hint="Auto: In − Out"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <StatusBadge status={preview.status} />
              <p className="text-xs text-gray-400 mt-1">
                Auto from In vs Out (un-utilize / partial-utilize / utilize)
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>

    <PartyPaymentStatementLinkModal
      open={linkModalOpen}
      onClose={() => setLinkModalOpen(false)}
      partyPaymentId={editing?.id}
      selectedIds={form.linked_statement_ids}
      onConfirm={applyStatementLink}
    />
  </>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  step,
  required,
  hint,
  readOnly = false,
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        step={step}
        required={required}
        readOnly={readOnly}
        onChange={readOnly ? undefined : onChange}
        className={`w-full border rounded-lg px-3 py-2 focus:outline-none ${
          readOnly
            ? "border-gray-200 bg-gray-50 text-gray-800 cursor-not-allowed"
            : "border-gray-300 focus:ring-2 focus:ring-blue-500"
        }`}
      />
      {hint ? <p className="text-xs text-gray-400 mt-0.5">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ status }) {
  const label = partyPaymentStatusLabel(status);
  const styles =
    status === "utilize"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "partial-utilize"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles}`}
    >
      {label}
    </span>
  );
}

function ReadOnlyField({
  label,
  name,
  value,
  required,
  placeholder = "Select customer above",
  hint = "Filled from customer master",
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        type="text"
        name={name}
        value={value}
        readOnly
        required={required}
        tabIndex={-1}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-800 cursor-not-allowed focus:outline-none"
      />
      {hint ? <p className="text-xs text-gray-400 mt-0.5">{hint}</p> : null}
    </div>
  );
}
