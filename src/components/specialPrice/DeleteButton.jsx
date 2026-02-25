"use client";

import { useRouter } from "next/navigation";

export default function DeleteButton({ customerId, productId }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this special price?")) return;

    try {
      const res = await fetch(
        `/api/special-price?customer_id=${customerId}&product_id=${productId}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Delete failed");
        return;
      }

      alert("Deleted successfully");
      router.refresh();
    } catch (err) {
      alert("Something went wrong");
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
    >
      🗑
    </button>
  );
}
