"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, Pencil, Trash2 } from "lucide-react";

export default function ClientExpensesTable({ rows }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id, e) => {
    e?.preventDefault();
    if (!confirm("Are you sure you want to delete this client expense? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/client-expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Client expense deleted successfully!");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
        case "expense_name":
          return (row.expense_name || "").toLowerCase();
        case "client_name":
          return (row.client_name || "").toLowerCase();
        case "group_name":
          return (row.group_name || "").toLowerCase();
        case "main_head":
          return (row.main_head || "").toLowerCase();
        case "head":
          return (row.head || "").toLowerCase();
        case "supply":
          return (row.supply || "").toLowerCase();
        case "amount":
          return Number(row.amount || 0);
        case "created_at":
          return row.created_at ? dayjs(row.created_at).valueOf() : 0;
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

  const handleReset = () => {
    setSearchQuery("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
        <input
          type="text"
          placeholder="Search anything..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-lg w-full sm:w-auto"
        />
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
              <th onClick={() => handleSort("expense_name")} className="p-3 cursor-pointer select-none">Expense Name<SortIcon column="expense_name" /></th>
              <th onClick={() => handleSort("client_name")} className="p-3 cursor-pointer select-none">Client Name<SortIcon column="client_name" /></th>
              <th onClick={() => handleSort("group_name")} className="p-3 cursor-pointer select-none">Group Name<SortIcon column="group_name" /></th>
              <th onClick={() => handleSort("main_head")} className="p-3 cursor-pointer select-none">Main Head<SortIcon column="main_head" /></th>
              <th onClick={() => handleSort("head")} className="p-3 cursor-pointer select-none">Head<SortIcon column="head" /></th>
              <th onClick={() => handleSort("supply")} className="p-3 cursor-pointer select-none">Supply<SortIcon column="supply" /></th>
              <th onClick={() => handleSort("amount")} className="p-3 cursor-pointer select-none">Amount<SortIcon column="amount" /></th>
              <th onClick={() => handleSort("created_at")} className="p-3 cursor-pointer select-none">Created<SortIcon column="created_at" /></th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 divide-y divide-gray-200">
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3">{row.id}</td>
                  <td className="p-3">{row.expense_name}</td>
                  <td className="p-3">{row.client_name}</td>
                  <td className="p-3">{row.group_name || "-"}</td>
                  <td className="p-3">
                    <span className={row.main_head === "Direct" ? "text-blue-600" : "text-amber-600"}>
                      {row.main_head}
                    </span>
                  </td>
                  <td className="p-3">{row.head || "-"}</td>
                  <td className="p-3">{row.supply || "-"}</td>
                  <td className="p-3">{row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "-"}</td>
                  <td className="p-3">
                    {row.created_at ? dayjs(row.created_at).format("DD MMM YYYY") : "-"}
                  </td>
                  <td className="p-3 flex gap-2 items-center">
                    <Link
                      href={`/admin-dashboard/client-expenses/${row.id}`}
                      className="text-blue-600 hover:underline"
                      title="View"
                    >
                      <Eye size={16} />
                    </Link>
                    <Link
                      href={`/admin-dashboard/client-expenses/edit/${row.id}`}
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
                <td colSpan="9" className="p-4 text-center text-gray-500">
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
            <div><strong>Expense Name:</strong> {row.expense_name}</div>
            <div><strong>Client Name:</strong> {row.client_name}</div>
            <div><strong>Group Name:</strong> {row.group_name || "-"}</div>
            <div><strong>Main Head:</strong> <span className={row.main_head === "Direct" ? "text-blue-600" : "text-amber-600"}>{row.main_head}</span></div>
            <div><strong>Head:</strong> {row.head || "-"}</div>
            <div><strong>Supply:</strong> {row.supply || "-"}</div>
            <div><strong>Amount:</strong> {row.amount != null ? `₹${Number(row.amount).toFixed(2)}` : "-"}</div>
            <div><strong>Created:</strong> {row.created_at ? dayjs(row.created_at).format("DD MMM YYYY") : "-"}</div>
            <div className="flex items-center gap-4 pt-2">
              <Link href={`/admin-dashboard/client-expenses/${row.id}`} className="text-blue-600 hover:underline">
                <Eye size={16} />
              </Link>
              <Link href={`/admin-dashboard/client-expenses/edit/${row.id}`} className="text-yellow-600 hover:text-yellow-800">
                <Pencil size={16} />
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
    </div>
  );
}
