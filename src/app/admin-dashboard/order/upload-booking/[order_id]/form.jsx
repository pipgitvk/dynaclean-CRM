"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadBookingForm({ order }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    booking_id: "",
    booking_date: "",
    booking_url: "",
    adminremark: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/orders/upload-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.order_id,
        quote: order.quote_number,
        ...formData,
      }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/admin-dashboard/order");
    } else {
      const { error } = await res.json();
      setError(error || "Failed to upload booking.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Upload Booking</h1>

      <table className="w-full mb-6 text-sm border">
        <tbody>
          {[
            ["Order ID", order.order_id],
            ["Client Name", order.client_name],
            ["Contact", order.contact],
            ["Email", order.email],
            ["Delivery Location", order.delivery_location],
            ["Client Delivery Date", order.client_delivery_date ? new Date(order.client_delivery_date).toLocaleDateString("en-IN") : "-"],
          ].map(([label, value]) => (
            <tr key={label} className="border">
              <td className="p-2 font-medium w-1/3 bg-gray-50">{label}</td>
              <td className="p-2">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="booking_id"
          value={formData.booking_id}
          onChange={handleChange}
          required
          placeholder="Booking ID"
          className="w-full border px-3 py-2 rounded-md"
        />

        <input
          type="date"
          name="booking_date"
          value={formData.booking_date}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded-md"
        />

        {/* Dispatch person is auto-set on dispatch complete; removed from form */}

        <input
          type="url"
          name="booking_url"
          value={formData.booking_url}
          onChange={handleChange}
          required
          placeholder="Booking URL"
          className="w-full border px-3 py-2 rounded-md"
        />

        <textarea
          name="adminremark"
          value={formData.adminremark}
          onChange={handleChange}
          placeholder="Admin Remark *"
          required
          className="w-full border px-3 py-2 rounded-md"
          rows={3}
        />

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md w-full"
        >
          {loading ? "Uploading..." : "Upload Booking"}
        </button>
      </form>
    </div>
  );
}
