"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Loader2, PhoneCall, X } from "lucide-react";
import {
  getNextFollowupDateBounds,
  validateNextFollowupDate,
} from "@/lib/manualPaymentFollowupValidation";

export default function ManualPaymentFollowupModal({ open, onClose, payment, onSaved }) {
  const [followedDate, setFollowedDate] = useState("");
  const [communicationMode, setCommunicationMode] = useState("Call");
  const [nextFollowupDate, setNextFollowupDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFollowedDate(dayjs().format("YYYY-MM-DDTHH:mm"));
    setCommunicationMode("Call");
    setNextFollowupDate("");
    setNotes("");
  }, [open, payment?.id]);

  const { min: nextFollowupMin, max: nextFollowupMax } = getNextFollowupDateBounds();

  if (!open || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">Add Followup</div>
            <div className="text-xs text-gray-600">
              Payment #{payment.id}
              {payment.customer_name ? ` | ${payment.customer_name}` : ""}
              {payment.customer_phone ? ` | ${payment.customer_phone}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-700">
                Followed Date
              </label>
              <input
                type="datetime-local"
                value={followedDate}
                readOnly
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-700">
                Communication Mode
              </label>
              <select
                value={communicationMode}
                onChange={(e) => setCommunicationMode(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Call">Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Visit">Visit</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-700">
                Next Followup Date <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
                min={nextFollowupMin}
                max={nextFollowupMax}
                required
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Required. From now up to 1 month ahead only.
              </p>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs font-semibold text-gray-700">
                Amount
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                ₹{Number(payment.amount || 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-gray-700">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Call details / customer response / payment plan..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              if (!notes.trim()) {
                alert("Notes required");
                return;
              }

              const nextDateCheck = validateNextFollowupDate(nextFollowupDate);
              if (!nextDateCheck.ok) {
                alert(nextDateCheck.error);
                return;
              }
              try {
                setSubmitting(true);
                const res = await fetch("/api/manual-payment-pending/followups", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    payment_id: payment.id,
                    customer_name: payment.customer_name || null,
                    customer_phone: payment.customer_phone || null,
                    followed_date: followedDate || null,
                    communication_mode: communicationMode || null,
                    next_followup_date: nextFollowupDate || null,
                    notes: notes.trim(),
                  }),
                });

                const data = await res.json();
                if (!res.ok || !data?.success) {
                  throw new Error(data?.error || "Failed to save followup");
                }

                alert("Followup saved");
                onSaved?.();
              } catch (e) {
                alert(e?.message || "Failed to save followup");
              } finally {
                setSubmitting(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={16} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
