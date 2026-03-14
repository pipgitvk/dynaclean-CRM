"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";

export default function SubCategoryPage() {
  const [name, setName] = useState("");
  const [subCategories, setSubCategories] = useState([]);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchSubCategories = () => {
    fetch("/api/expense-sub-categories", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.subCategories && setSubCategories(d.subCategories))
      .catch(() => toast.error("Failed to load sub-categories"));
  };

  useEffect(() => {
    fetchSubCategories();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      toast.error("Please enter name");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/expense-sub-categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setName("");
        toast.success("Sub-category added");
        fetchSubCategories();
      } else {
        toast.error(data.error || "Failed to add");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this sub-category?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expense-sub-categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Sub-category removed");
        fetchSubCategories();
      } else {
        toast.error(data.error || "Failed to remove");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin-dashboard/client-expenses" className="text-gray-600 hover:text-gray-800">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-700">Sub-category</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border p-2 rounded-md"
              placeholder="Sub-category name"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm font-medium text-gray-600 mb-2">Sub-categories</p>
          <div className="space-y-1">
            {subCategories.length === 0 ? (
              <p className="text-sm text-gray-500">No sub-categories yet</p>
            ) : (
              subCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-gray-50 group">
                  <span className="font-mono text-gray-500 text-sm">{c.id}</span>
                  <span className="text-gray-800 text-sm flex-1">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="text-red-600 hover:bg-red-50 p-1 rounded opacity-70 hover:opacity-100 disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
