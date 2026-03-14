"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, Pencil, Trash2, X } from "lucide-react";

export default function StatementTable({ rows }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [deletingId, setDeletingId] = useState(null);
  const [modalId, setModalId] = useState(null);
  const [expense, setExpense] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);

  const totalSettled = rows.filter((r) => r.client_expense_id).length;
  const totalUnsettled = rows.filter((r) => !r.client_expense_id).length;

  const filteredRows = rows.filter((row) => {
    if (!statusFilter) return true;
    if (statusFilter === "Settled") return !!row.client_expense_id;
    if (statusFilter === "Unsettled") return !row.client_expense_id;
    return true;
  });

  const handleDelete = async (id, e) => {
    e?.preventDefault();
    if (!confirm("Are you sure you want to delete this statement? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/statements/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Statement deleted successfully!");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const key = sortConfig.key;

    const getVal = (row) => {
      switch (key) {
        case "id":
          return Number(row.id || 0);
        case "trans_id":
          return (row.trans_id || "").toLowerCase();
        case "date":
          return row.date ? dayjs(row.date).valueOf() : 0;
        case "txn_dated_deb":
          return row.txn_dated_deb ? dayjs(row.txn_dated_deb).valueOf() : 0;
        case "cheq_no":
          return (row.cheq_no || "").toLowerCase();
        case "description":
          return (row.description || "").toLowerCase();
        case "type":
          return (row.type || "").toLowerCase();
        case "amount":
          return Number(row.amount || 0);
        case "status":
          return (row.client_expense_id ? "settled" : "unsettled");
        default:
          return 0;
      }
    };

    const va = getVal(a);
    const vb = getVal(b);
    if (typeof va === "string" || typeof vb === "string") {
      return va.localeCompare(vb) * dir;
    }
    return (va - vb) * dir;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return <span className="ml-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>;
  };

  const handleReset = () => setStatusFilter("");

  useEffect(() => {
    if (!modalId) {
      setExpense(null);
      setExpenseLoading(false);
      return;
    }
    setExpenseLoading(true);
    setExpense(null);
    fetch(`/api/statements/${modalId}`)
      .then((r) => r.json())
      .then((row) => {
        if (row?.error) throw new Error(row.error);
        if (row.client_expense_id) {
          return fetch(`/api/client-expenses/${row.client_expense_id}`).then((r) => r.json());
        }
        return null;
      })
      .then((exp) => {
        setExpense(exp && !exp.error ? exp : null);
      })
      .catch((e) => {
        toast.error(e.message || "Failed to load");
        setModalId(null);
      })
      .finally(() => setExpenseLoading(false));
  }, [modalId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-green-700 font-medium">Total Settled</p>
          <p className="text-2xl font-bold text-green-800">{totalSettled}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-sm">
          <p className="text-sm text-amber-700 font-medium">Total Unsettled</p>
          <p className="text-2xl font-bold text-amber-800">{totalUnsettled}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-48"
        >
          <option value="">All</option>
          <option value="Settled">Settled</option>
          <option value="Unsettled">Unsettled</option>
        </select>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-300 rounded-lg text-sm cursor-pointer w-full sm:w-auto"
        >
          Reset
        </button>
      </div>

      <div className="hidden md:block overflow-auto bg-white shadow rounded-lg">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr className="text-left font-semibold text-gray-700">
              <th onClick={() => handleSort("id")} className="p-3 cursor-pointer select-none">ID<SortIcon column="id" /></th>
              <th onClick={() => handleSort("trans_id")} className="p-3 cursor-pointer select-none">Trans ID<SortIcon column="trans_id" /></th>
              <th onClick={() => handleSort("date")} className="p-3 cursor-pointer select-none">Date<SortIcon column="date" /></th>
              <th onClick={() => handleSort("txn_dated_deb")} className="p-3 cursor-pointer select-none">Txn Dated Deb<SortIcon column="txn_dated_deb" /></th>
              <th onClick={() => handleSort("cheq_no")} className="p-3 cursor-pointer select-none">Cheq No<SortIcon column="cheq_no" /></th>
              <th onClick={() => handleSort("description")} className="p-3 cursor-pointer select-none">Description<SortIcon column="description" /></th>
              <th onClick={() => handleSort("type")} className="p-3 cursor-pointer select-none">Type<SortIcon column="type" /></th>
              <th onClick={() => handleSort("amount")} className="p-3 cursor-pointer select-none">Amount<SortIcon column="amount" /></th>
              <th onClick={() => handleSort("status")} className="p-3 cursor-pointer select-none">Status<SortIcon column="status" /></th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 divide-y divide-gray-200">
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3">{row.id}</td>
                  <td className="p-3">{row.trans_id}</td>
                  <td className="p-3">
                    {row.date ? dayjs(row.date).format("DD MMM YYYY") : "-"}
                  </td>
                  <td className="p-3">
                    {row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00"
                      ? dayjs(row.txn_dated_deb).format("DD MMM YYYY")
                      : "-"}
                  </td>
                  <td className="p-3">{row.cheq_no || "-"}</td>
                  <td className="p-3 max-w-[200px] truncate" title={row.description}>{row.description || "-"}</td>
                  <td className="p-3">
                    <span className={row.type === "Credit" ? "text-green-600" : "text-red-600"}>
                      {row.type}
                    </span>
                  </td>
                  <td className="p-3">₹{Number(row.amount || 0).toFixed(2)}</td>
                  <td className="p-3">
                    <span className={row.client_expense_id ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {row.client_expense_id ? "Settled" : "Unsettled"}
                    </span>
                  </td>
                  <td className="p-3 flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setModalId(row.id)}
                      className="text-blue-600 hover:underline"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <Link
                      href={`/admin-dashboard/statements/edit/${row.id}`}
                      className="text-yellow-600 hover:text-yellow-800"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(row.id, e)}
                      disabled={deletingId === row.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="p-4 text-center text-gray-500">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4">
        {sortedRows.length === 0 && (
          <div className="text-center text-gray-500">No entries found.</div>
        )}
        {sortedRows.map((row) => (
          <div
            key={row.id}
            className="border rounded-lg p-4 shadow-sm bg-white text-sm space-y-1"
          >
            <div><strong>ID:</strong> {row.id}</div>
            <div><strong>Trans ID:</strong> {row.trans_id}</div>
            <div><strong>Date:</strong> {row.date ? dayjs(row.date).format("DD MMM YYYY") : "-"}</div>
            <div><strong>Txn Dated Deb:</strong> {row.txn_dated_deb && row.txn_dated_deb !== "0000-00-00" ? dayjs(row.txn_dated_deb).format("DD MMM YYYY") : "-"}</div>
            <div><strong>Cheq No:</strong> {row.cheq_no || "-"}</div>
            <div><strong>Description:</strong> {row.description || "-"}</div>
            <div><strong>Type:</strong> <span className={row.type === "Credit" ? "text-green-600" : "text-red-600"}>{row.type}</span></div>
            <div><strong>Amount:</strong> ₹{Number(row.amount || 0).toFixed(2)}</div>
            <div><strong>Status:</strong> <span className={row.client_expense_id ? "text-green-600" : "text-amber-600"}>{row.client_expense_id ? "Settled" : "Unsettled"}</span></div>
            <div className="flex items-center gap-4 pt-2">
              <button type="button" onClick={() => setModalId(row.id)} className="text-blue-600 hover:underline">
                <Eye size={16} /> View
              </button>
              <Link href={`/admin-dashboard/statements/edit/${row.id}`} className="text-yellow-600 hover:text-yellow-800">
                <Pencil size={16} /> Edit
              </Link>
              <button
                type="button"
                onClick={(e) => handleDelete(row.id, e)}
                disabled={deletingId === row.id}
                className="text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Expense View Modal */}
      {modalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Client Expense Details</h3>
              <button
                type="button"
                onClick={() => setModalId(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {expenseLoading ? (
                <div className="py-8 text-center text-gray-500">Loading...</div>
              ) : expense ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-2">
                      <p><span className="font-medium">ID:</span> {expense.id}</p>
                      <p><span className="font-medium">Expense Name:</span> {expense.expense_name}</p>
                      <p><span className="font-medium">Client Name:</span> {expense.client_name}</p>
                      <p><span className="font-medium">Group Name:</span> {expense.group_name || "-"}</p>
                      <p><span className="font-medium">Tax applicable:</span> {expense.tax_applicable ? "Yes" : "No"}</p>
                      {expense.tax_applicable && (
                        <>
                          {expense.gst_rate != null && <p><span className="font-medium">Tax Rate:</span> {Number(expense.gst_rate)}%</p>}
                          {expense.tax_type && <p><span className="font-medium">Tax type:</span> {expense.tax_type}</p>}
                          {expense.tax_type === "CGST+SGST" && (
                            <>
                              <p><span className="font-medium">CGST:</span> {expense.cgst != null ? `₹${Number(expense.cgst).toFixed(2)}` : "-"}</p>
                              <p><span className="font-medium">SGST:</span> {expense.sgst != null ? `₹${Number(expense.sgst).toFixed(2)}` : "-"}</p>
                            </>
                          )}
                          {expense.tax_type === "IGST" && <p><span className="font-medium">IGST:</span> {expense.igst != null ? `₹${Number(expense.igst).toFixed(2)}` : "-"}</p>}
                        </>
                      )}
                      <p><span className="font-medium">Main Head:</span> <span className={expense.main_head === "Direct" ? "text-blue-600" : "text-amber-600"}>{expense.main_head}</span></p>
                      <p><span className="font-medium">Head:</span> {expense.head || "-"}</p>
                      <p><span className="font-medium">Supply:</span> {expense.supply || "-"}</p>
                      {expense.sub_heads?.length > 0 && <p><span className="font-medium">Sub-head:</span> {expense.sub_heads[0]}</p>}
                    </div>
                    <div className="space-y-2">
                      <p><span className="font-medium">Type of Ledger:</span> {expense.type_of_ledger || "-"}</p>
                      <p><span className="font-medium">HSN:</span> {expense.hsn || "-"}</p>
                      <p><span className="font-medium">Amount:</span> {expense.amount != null ? `₹${Number(expense.amount).toFixed(2)}` : "-"}</p>
                      <p><span className="font-medium">Created:</span> {expense.created_at ? dayjs(expense.created_at).format("DD MMM YYYY HH:mm") : "-"}</p>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Link
                      href={`/admin-dashboard/client-expenses/edit/${expense.id}?from=statements`}
                      className="px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Edit Expenses
                    </Link>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">No expense linked to this statement</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
