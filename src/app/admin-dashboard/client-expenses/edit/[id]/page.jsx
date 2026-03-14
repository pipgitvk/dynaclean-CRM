"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function EditClientExpensePage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromStatements = searchParams.get("from") === "statements";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [headOptions, setHeadOptions] = useState([]);
  const [subHeadOptions, setSubHeadOptions] = useState([]);
  const [form, setForm] = useState({
    expense_name: "",
    client_name: "",
    group_name: "",
    tax_rate: "",
    tax_applicable: "No",
    tax_type: "",
    main_head: "Direct",
    head: "",
    sub_head: "",
    supply: "goods",
    type_of_ledger: "",
    amount: "",
    hsn: "",
    cgst: "",
    sgst: "",
    igst: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [expRes, catRes, subCatRes] = await Promise.all([
          fetch(`/api/client-expenses/${id}`),
          fetch("/api/expense-categories", { credentials: "include" }),
          fetch("/api/expense-sub-categories", { credentials: "include" }),
        ]);
        const row = await expRes.json();
        if (!expRes.ok) {
          setError("Client expense not found");
          return;
        }
        const cat = await catRes.json().catch(() => ({}));
        const subCat = await subCatRes.json().catch(() => ({}));
        let heads = (cat?.categories || []).map((c) => c.name);
        let subHeadsList = (subCat?.subCategories || []).map((c) => c.name);
        const loadedHead = row.head || "";
        const loadedSubHead = Array.isArray(row.sub_heads) && row.sub_heads[0] ? row.sub_heads[0] : "";
        if (loadedHead && !heads.includes(loadedHead)) heads = [loadedHead, ...heads];
        if (loadedSubHead && !subHeadsList.includes(loadedSubHead)) subHeadsList = [loadedSubHead, ...subHeadsList];
        setHeadOptions(heads);
        setSubHeadOptions(subHeadsList);
        const loadedForm = {
          expense_name: row.expense_name || "",
          client_name: row.client_name || "",
          group_name: row.group_name || "",
          tax_rate: row.gst_rate != null ? String(row.gst_rate) : "",
          tax_applicable: row.tax_applicable ? "Yes" : "No",
          tax_type: row.tax_type || "",
          main_head: row.main_head || "Direct",
          head: loadedHead,
          sub_head: loadedSubHead,
          supply: row.supply || "goods",
          type_of_ledger: row.type_of_ledger || "",
          amount: row.amount != null ? String(row.amount) : "",
          hsn: row.hsn || "",
          cgst: row.cgst != null ? String(row.cgst) : "",
          sgst: row.sgst != null ? String(row.sgst) : "",
          igst: row.igst != null ? String(row.igst) : "",
        };
        setForm(recalcTax(loadedForm));
      } catch (e) {
        setError("Failed to load client expense");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const recalcTax = (f) => {
    if (f.tax_applicable !== "Yes" || !f.tax_type) return f;
    const amt = parseFloat(f.amount);
    const rate = parseFloat(f.tax_rate);
    if (isNaN(amt) || amt <= 0 || isNaN(rate) || rate < 0) return f;
    const next = { ...f };
    if (f.tax_type === "CGST+SGST") {
      const half = (amt * rate) / 200;
      next.cgst = half.toFixed(2);
      next.sgst = half.toFixed(2);
      next.igst = "";
    } else if (f.tax_type === "IGST") {
      next.igst = ((amt * rate) / 100).toFixed(2);
      next.cgst = "";
      next.sgst = "";
    }
    return next;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (["amount", "tax_rate", "tax_type"].includes(name)) {
        return recalcTax(next);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/client-expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_name: form.expense_name,
          client_name: form.client_name,
          group_name: form.group_name || null,
          gst_rate: form.tax_applicable === "Yes" && form.tax_rate != null && form.tax_rate !== "" ? Number(form.tax_rate) : null,
          tax_applicable: form.tax_applicable === "Yes",
          tax_type: form.tax_applicable === "Yes" ? (form.tax_type || null) : null,
          cgst: form.tax_type === "CGST+SGST" && form.cgst != null && form.cgst !== "" ? Number(form.cgst) : null,
          sgst: form.tax_type === "CGST+SGST" && form.sgst != null && form.sgst !== "" ? Number(form.sgst) : null,
          igst: form.tax_type === "IGST" && form.igst != null && form.igst !== "" ? Number(form.igst) : null,
          main_head: form.main_head,
          head: form.head || null,
          supply: form.supply || null,
          sub_heads: form.sub_head ? [form.sub_head] : [],
          type_of_ledger: form.type_of_ledger || null,
          amount: form.amount != null && form.amount !== "" ? Number(form.amount) : null,
          hsn: form.hsn || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success("Client expense updated successfully!");
      router.push(`/admin-dashboard/client-expenses/${id}`);
    } catch (e) {
      setError(e.message || "Failed to save");
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error && !form.expense_name) return <div className="p-6 text-red-600">{error}</div>;

  const showSubHead = form.main_head === "Direct" || form.main_head === "Indirect";

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Edit Client Expense #{id}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Main Head *</label>
            <select
              name="main_head"
              value={form.main_head}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            >
              <option value="Direct">Direct</option>
              <option value="Indirect">Indirect</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Head</label>
            <select
              name="head"
              value={form.head}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              <option value="">Select head</option>
              {headOptions.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          {showSubHead && (
            <div>
              <label className="block text-sm font-medium mb-1">Sub-head</label>
              <select
                name="sub_head"
                value={form.sub_head}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              >
                <option value="">Select sub-head</option>
                {subHeadOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Expense Name *</label>
            <input
              name="expense_name"
              value={form.expense_name}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Client Name *</label>
            <input
              name="client_name"
              value={form.client_name}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Group Name</label>
            <input
              name="group_name"
              value={form.group_name}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Amount</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={handleChange}
              readOnly={fromStatements}
              className={`w-full border p-2 rounded ${fromStatements ? "bg-gray-50 cursor-not-allowed" : ""}`}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Tax applicable</label>
            <select
              name="tax_applicable"
              value={form.tax_applicable}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>
          {form.tax_applicable === "Yes" && (
            <>
              <div>
                <label className="block text-sm mb-1">Tax Rate (%)</label>
                <input
                  name="tax_rate"
                  type="number"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Tax type</label>
                <select
                  name="tax_type"
                  value={form.tax_type}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                >
                  <option value="">Select tax type</option>
                  <option value="CGST+SGST">CGST+SGST</option>
                  <option value="IGST">IGST</option>
                </select>
              </div>
              {form.tax_type === "CGST+SGST" && (
                <>
                  <div>
                    <label className="block text-sm mb-1">CGST</label>
                    <input
                      name="cgst"
                      type="number"
                      step="0.01"
                      value={form.cgst}
                      readOnly
                      className="w-full border p-2 rounded bg-gray-50"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">SGST</label>
                    <input
                      name="sgst"
                      type="number"
                      step="0.01"
                      value={form.sgst}
                      readOnly
                      className="w-full border p-2 rounded bg-gray-50"
                      placeholder="0"
                    />
                  </div>
                </>
              )}
              {form.tax_type === "IGST" && (
                <div>
                  <label className="block text-sm mb-1">IGST</label>
                  <input
                    name="igst"
                    type="number"
                    step="0.01"
                    value={form.igst}
                    readOnly
                    className="w-full border p-2 rounded bg-gray-50"
                    placeholder="0"
                  />
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-sm mb-1">Supply</label>
            <select
              name="supply"
              value={form.supply}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            >
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Type of Ledger</label>
            <input
              name="type_of_ledger"
              value={form.type_of_ledger}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">HSN</label>
            <input
              name="hsn"
              value={form.hsn}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-yellow-600 text-white rounded disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
