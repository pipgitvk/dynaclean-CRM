"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export default function ThirdPartyEngineerPasswordForm() {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/third-party-engineer-portal/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: form.current_password,
          new_password: form.new_password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      toast.success("Password updated");
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <input
        type="password"
        placeholder="Current password"
        value={form.current_password}
        onChange={(e) => setForm((p) => ({ ...p, current_password: e.target.value }))}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
        required
      />
      <input
        type="password"
        placeholder="New password"
        value={form.new_password}
        onChange={(e) => setForm((p) => ({ ...p, new_password: e.target.value }))}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
        required
        minLength={6}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={form.confirm_password}
        onChange={(e) => setForm((p) => ({ ...p, confirm_password: e.target.value }))}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
