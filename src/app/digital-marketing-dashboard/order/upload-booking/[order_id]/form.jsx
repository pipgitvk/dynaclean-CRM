"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadBookingForm({ order }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    booking_id: "",
    booking_date: "",
    expected_delivery_date: "",
    booking_url: "",
    adminremark: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        booking_id: formData.booking_id,
        booking_date: formData.booking_date,
        booking_url: formData.booking_url,
        adminremark: formData.adminremark,
        expected_delivery_date: formData.expected_delivery_date,
      }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/user-dashboard/order");
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

        <div>
          <label
            htmlFor="booking_date"
            className="block text-sm font-medium text-gray-700"
          >
            Booking Date
          </label>
          <input
            type="date"
            id="booking_date"
            name="booking_date"
            value={formData.booking_date}
            onChange={handleChange}
            required
            className="mt-1 w-full border px-3 py-2 rounded-md"
          />
        </div>

        <div>
          <label
            htmlFor="expected_delivery_date"
            className="block text-sm font-medium text-gray-700"
          >
            Expected Delivery Date
          </label>
          <input
            type="date"
            id="expected_delivery_date"
            name="expected_delivery_date"
            value={formData.expected_delivery_date}
            onChange={handleChange}
            required
            className="mt-1 w-full border px-3 py-2 rounded-md"
          />
        </div>

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
          className={`bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md w-full ${loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
        >
          {loading ? "Uploading..." : "Upload Booking"}
        </button>
      </form>
    </div>
  );
}
