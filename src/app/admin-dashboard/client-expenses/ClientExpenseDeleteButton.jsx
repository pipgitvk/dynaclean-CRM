"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";

export default function ClientExpenseDeleteButton({ id, backHref }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this client expense? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/client-expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Client expense deleted successfully!");
      router.push(backHref || "/admin-dashboard/client-expenses");
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-center"
    >
      <Trash2 size={16} />
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}
