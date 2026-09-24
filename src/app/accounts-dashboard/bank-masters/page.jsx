"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Plus, X, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

const EMPTY_FORM = {
  bank_name: "",
  ifsc: "",
  account_number: "",
  branch_address: "",
  account_holder_name: "",
};

export default function BankMastersPage() {
  const router = useRouter();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null); // null = add, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchBanks = async () => {
    try {
      const res = await fetch("/api/bank-masters", { credentials: "include" });
      const data = await res.json();
      if (res.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBanks(data.banks || []);
    } catch (err) {
      toast.error(err.message || "Failed to load banks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const openAddModal = () => {
    setEditingBank(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (bank) => {
    setEditingBank(bank);
    setForm({
      bank_name: bank.bank_name || "",
      ifsc: bank.ifsc || "",
      account_number: bank.account_number || "",
      branch_address: bank.branch_address || "",
      account_holder_name: bank.account_holder_name || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBank(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.bank_name.trim()) {
      toast.error("Bank name is required");
      return;
    }
    setSubmitting(true);
    try {
      const isEdit = editingBank != null;
      const url = isEdit ? `/api/bank-masters/${editingBank.id}` : "/api/bank-masters";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(isEdit ? "Bank updated" : "Bank added");
      closeModal();
      fetchBanks();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bank) => {
    if (!window.confirm(`Delete "${bank.bank_name}"? This cannot be undone.`)) return;
    setDeletingId(bank.id);
    try {
      const res = await fetch(`/api/bank-masters/${bank.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Bank deleted");
      setBanks((prev) => prev.filter((b) => b.id !== bank.id));
    } catch (err) {
      toast.error(err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="max-w-5xl mx-auto p-6 w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-semibold mb-2">Access Denied</h2>
          <p className="text-red-700">You don't have permission to access Bank Management. This page is only accessible to Accountants and Administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-700">Bank Management</h1>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow text-sm font-medium w-fit"
        >
          <Plus size={16} />
          Add Bank
        </button>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : banks.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No banks added yet. Click "Add Bank" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr className="text-left font-semibold text-gray-700">
                  <th className="p-3">ID</th>
                  <th className="p-3">Bank Name</th>
                  <th className="p-3">IFSC</th>
                  <th className="p-3">Account Number</th>
                  <th className="p-3">Account Holder</th>
                  <th className="p-3">Branch Address</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {banks.map((bank) => (
                  <tr key={bank.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-500">{bank.id}</td>
                    <td className="p-3 font-medium">{bank.bank_name}</td>
                    <td className="p-3 font-mono text-xs">{bank.ifsc || "—"}</td>
                    <td className="p-3 font-mono text-xs">{bank.account_number || "—"}</td>
                    <td className="p-3">{bank.account_holder_name || "—"}</td>
                    <td className="p-3 max-w-[200px] truncate text-gray-500" title={bank.branch_address}>
                      {bank.branch_address || "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditModal(bank)}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingBank ? "Edit Bank" : "Add Bank"}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="bank_name"
                  value={form.bank_name}
                  onChange={handleChange}
                  placeholder="e.g. HDFC Bank"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC</label>
                  <input
                    name="ifsc"
                    value={form.ifsc}
                    onChange={handleChange}
                    placeholder="e.g. HDFC0001234"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    name="account_number"
                    value={form.account_number}
                    onChange={handleChange}
                    placeholder="e.g. 12345678901234"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                <input
                  name="account_holder_name"
                  value={form.account_holder_name}
                  onChange={handleChange}
                  placeholder="e.g. DYNACLEAN TECHNOLOGIES PVT LTD"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Address</label>
                <textarea
                  name="branch_address"
                  value={form.branch_address}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Branch address"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingBank ? "Update Bank" : "Add Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
