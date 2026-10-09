"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, UploadCloud, CheckCircle } from "lucide-react";

export function ViewReturnBookingMenuItem({ order }) {
  const [open, setOpen] = useState(false);
  const hasReturnBooking = Number(order.return_booking_done) === 1;
  if (!hasReturnBooking) return null;

  const fmtDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return isNaN(date.getTime()) ? String(d) : date.toLocaleDateString("en-IN");
  };

  const url = (order.return_booking_url || "").toString().trim();

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-gray-700 text-sm"
      >
        <FileCheck size={16} />
        <span>View Return Booking</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-6 text-center">Return Booking</h1>

              <table className="w-full text-sm border">
                <tbody>
                  {[
                    ["Order ID", order.order_id],
                    ["Return Booking ID", order.return_booking_ref],
                    ["Return Booking Date", fmtDate(order.return_booking_date)],
                    ["Expected Pickup Date", fmtDate(order.expected_pickup_date)],
                    ["Booked By", order.return_booking_by],
                    ["Remarks", order.return_booking_remarks],
                  ].map(([label, value]) => (
                    <tr key={label} className="border">
                      <td className="p-2 font-medium w-1/3 bg-gray-50">{label}</td>
                      <td className="p-2 whitespace-pre-wrap">{value || "-"}</td>
                    </tr>
                  ))}
                  <tr className="border">
                    <td className="p-2 font-medium w-1/3 bg-gray-50">Booking URL</td>
                    <td className="p-2">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline break-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ReturnBookingMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    return_booking_id: "",
    return_booking_date: "",
    expected_pickup_date: "",
    return_booking_url: "",
    return_booking_remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasReturnBooking = Number(order.return_booking_done) === 1;
  if (hasReturnBooking) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/return-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          return_booking_id: formData.return_booking_id,
          return_booking_date: formData.return_booking_date,
          expected_pickup_date: formData.expected_pickup_date,
          return_booking_url: formData.return_booking_url,
          return_booking_remarks: formData.return_booking_remarks,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccess("✅ Return booking created successfully!");
        setTimeout(() => {
          setOpen(false);
          setSuccess("");
          setFormData({
            return_booking_id: "",
            return_booking_date: "",
            expected_pickup_date: "",
            return_booking_url: "",
            return_booking_remarks: "",
          });
          router.refresh();
        }, 1500);
      } else {
        setError(json.error || "Failed to create return booking.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-blue-700 text-sm"
      >
        <UploadCloud size={16} />
        <span>Return Booking</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-6 text-center">Return Booking</h1>

              <table className="w-full mb-6 text-sm border">
                <tbody>
                  {[
                    ["Order ID", order.order_id],
                    ["Client Name", order.client_name],
                    ["Contact", order.contact],
                    ["Email", order.email],
                    ["Delivery Location", order.delivery_location],
                    [
                      "Client Delivery Date",
                      order.client_delivery_date
                        ? new Date(order.client_delivery_date).toLocaleDateString("en-IN")
                        : "-",
                    ],
                  ].map(([label, value]) => (
                    <tr key={label} className="border">
                      <td className="p-2 font-medium w-1/3 bg-gray-50">{label}</td>
                      <td className="p-2">{value || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  name="return_booking_id"
                  value={formData.return_booking_id}
                  onChange={handleChange}
                  required
                  placeholder="Return Booking ID"
                  className="w-full border px-3 py-2 rounded-md"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Return Booking Date
                  </label>
                  <input
                    type="date"
                    name="return_booking_date"
                    value={formData.return_booking_date}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full border px-3 py-2 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Expected Pickup Date
                  </label>
                  <input
                    type="date"
                    name="expected_pickup_date"
                    value={formData.expected_pickup_date}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full border px-3 py-2 rounded-md"
                  />
                </div>

                <input
                  type="text"
                  name="return_booking_url"
                  value={formData.return_booking_url}
                  onChange={handleChange}
                  placeholder="Booking URL (optional)"
                  className="w-full border px-3 py-2 rounded-md"
                />

                <textarea
                  name="return_booking_remarks"
                  value={formData.return_booking_remarks}
                  onChange={handleChange}
                  placeholder="Remark *"
                  required
                  className="w-full border px-3 py-2 rounded-md"
                  rows={3}
                />

                {error && <p className="text-red-600 font-bold">{error}</p>}
                {success && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md font-bold">
                    {success}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md ${
                      submitting ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {submitting ? "Uploading..." : "Upload Booking"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function WarehouseInMenuItem({ order }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const today = new Date().toLocaleDateString("en-CA");

  const isDone = Number(order.warehouse_in_done) === 1;

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!image) {
      setError("Image upload karna mandatory hai.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("order_id", order.order_id);
      fd.append("warehouse_in_date", today);
      fd.append("image", image);

      const res = await fetch("/api/orders/warehouse-in", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save");

      setSuccess("✅ Warehouse-In done! Stock updated.");
      setTimeout(() => {
        setOpen(false);
        setSuccess("");
        setImage(null);
        setImagePreview(null);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-IN");
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 text-sm ${
          isDone ? "text-blue-700" : "text-green-700"
        }`}
      >
        {isDone ? <FileCheck size={16} /> : <CheckCircle size={16} />}
        <span>{isDone ? "View Warehouse-In" : "Warehouse-In"}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold text-center text-gray-800">
                {isDone ? "View Warehouse-In" : "Warehouse-In"}
              </h2>

              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div>
                  <span className="font-medium text-gray-600">Order ID:</span>{" "}
                  <span className="text-gray-800 ml-1">{order.order_id}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Client:</span>{" "}
                  <span className="text-gray-800 ml-1">{order.client_name}</span>
                </div>
              </div>

              {isDone ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="font-medium text-gray-800">
                        {fmtDate(order.warehouse_in_date)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Done By</p>
                      <p className="font-medium text-gray-800">
                        {order.warehouse_in_by || "-"}
                      </p>
                    </div>
                  </div>

                  {order.warehouse_in_image ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Proof Image</p>
                      <a
                        href={order.warehouse_in_image}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block rounded-lg overflow-hidden border border-gray-200"
                      >
                        <img
                          src={order.warehouse_in_image}
                          alt="Warehouse-In proof"
                          className="w-full h-52 object-cover"
                        />
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No image uploaded</p>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={today}
                      readOnly
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Image Upload <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    {image && (
                      <p className="text-xs text-green-700 mt-1">✓ {image.name}</p>
                    )}
                  </div>

                  {imagePreview && (
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-44 object-cover"
                      />
                    </div>
                  )}

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 font-medium">
                      {success}
                    </p>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setImage(null);
                        setImagePreview(null);
                        setError("");
                      }}
                      className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !image}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      {submitting ? "Saving..." : "Submit"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
