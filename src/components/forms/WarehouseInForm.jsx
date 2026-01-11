"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function WarehouseInForm() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [formData, setFormData] = useState({
    received_date: new Date().toISOString().split("T")[0],
    received_quantity: "",
    warehouse_name: "",
    location: "",
    remarks: "",
  });
  const [files, setFiles] = useState({
    received_image: null,
    supporting_doc: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);


  // Fetch current user
  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setReceivedBy(data.username))
      .catch(() => setReceivedBy(""));
  }, []);

  // Fetch pending requests
  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      const res = await fetch("/api/warehouse-in");
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (error) {
      console.error("Error loading requests:", error);
    }
  };

  const handleRequestSelect = (requestId) => {
    const request = pendingRequests.find((r) => r.id === parseInt(requestId));
    setSelectedRequest(request);
    setShowForm(true);

    if (request) {
      setFormData((prev) => ({
        ...prev,
        received_quantity: request.quantity,
      }));
    }
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File must be less than 5MB");
        return;
      }
      setFiles((prev) => ({ ...prev, [fieldName]: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!selectedRequest) {
      toast.error("Please select a request");
      return;
    }

    if (!files.received_image) {
      toast.error("Received image is mandatory");
      return;
    }

    const submitData = new FormData();
    submitData.append("request_id", selectedRequest.id);
    submitData.append("received_date", formData.received_date);
    submitData.append("received_quantity", formData.received_quantity);
    submitData.append("warehouse_name", formData.warehouse_name);
    submitData.append("location", formData.location);
    submitData.append("remarks", formData.remarks);
    submitData.append("received_image", files.received_image);
    if (files.supporting_doc) {
      submitData.append("supporting_doc", files.supporting_doc);
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/warehouse-in", {
        method: "POST",
        body: submitData,
      });

      if (res.ok) {
        toast.success("Stock received successfully!");
        // Reset form
        setSelectedRequest(null);
        setFormData({
          received_date: new Date().toISOString().split("T")[0],
          received_quantity: "",
          warehouse_name: "",
          location: "",
          remarks: "",
        });
        setFiles({
          received_image: null,
          supporting_doc: null,
        });
        // Reset file inputs
        document
          .querySelectorAll('input[type="file"]')
          .forEach((input) => (input.value = ""));
        // Reload pending requests
        loadPendingRequests();
      } else if (res.status === 409) {
        const error = await res
          .json()
          .catch(() => ({ error: "Already processed" }));
        toast.error(error.error || "This request has already been processed.");
      } else {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to process request" }));
        toast.error(error.error || "Failed to process request");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
      setShowForm(false);
    }
  };

  return (

    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6"
    >
      <h3 className="text-lg font-semibold mb-4">
        Warehouse In - Receive Stock
      </h3>

      {/* Select Pending Request */}
      {!showForm && (
        <div>
          <label className="block mb-1 font-medium">
            Select Pending Request *
          </label>

          {/* ---------- MOBILE CARDS (sm and below) ---------- */}
          <div className="block sm:hidden space-y-4">
            {pendingRequests.length === 0 && (
              <p className="text-sm text-gray-500">No pending requests available</p>
            )}

            {pendingRequests.map((req) => (
              <div
                key={req.id}
                onClick={() => handleRequestSelect(req.id)}
                className="bg-white border rounded-xl shadow-md p-4 flex items-center space-x-4 cursor-pointer transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {/* Image */}
                <div className="flex-shrink-0">
                  <img
                    src={req.product_image}
                    alt={req.product_name}
                    className="w-20 h-20 object-cover rounded-lg border"
                  />
                </div>

                {/* Text Content */}
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-base">
                    Req #{req.id}
                  </p>

                  <p className="text-sm text-gray-700 font-medium">
                    {req.product_name}
                  </p>

                  <p className="text-sm text-gray-600">
                    Qty: <span className="font-medium">{req.quantity}</span>
                  </p>

                  <p className="text-xs text-gray-500">
                    From: {req.from_company || "N/A"}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>


          {/* Desktop View → Table */}
          <div className="hidden md:block mt-2 border rounded-lg overflow-hidden">
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">
                No pending requests available
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-left text-xs">
                  <tr>
                    <th className="p-2 border-b">Request ID</th>
                    <th className="p-2 border-b">Product Image</th>
                    <th className="p-2 border-b">Product Name</th>
                    <th className="p-2 border-b">Quantity</th>
                    <th className="p-2 border-b">From Company</th>
                    <th className="p-2 border-b">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => {
                    const isSelected = selectedRequest?.id === req.id;

                    return (
                      <tr
                        key={req.id}
                        className={`cursor-pointer border-b ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                          }`}
                        onClick={() => handleRequestSelect(req.id)}
                      >
                        <td className="p-2 font-semibold">Req #{req.id}</td>
                        <td className="p-2">
                          {req.product_image ? (
                            <img
                              src={req.product_image}
                              alt={req.product_name}
                              className="w-16 h-16 object-contain"
                            />
                          ) : (
                            "No Image"
                          )}
                        </td>
                        <td className="p-2">{req.product_name}</td>
                        <td className="p-2">{req.quantity} units</td>
                        <td className="p-2">{req.from_company || "N/A"}</td>
                        <td className="p-2 whitespace-nowrap">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <button
          type="button"
          onClick={() => {
            setSelectedRequest(null);
            setShowForm(false);
          }}
          className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Back to Pending Requests
        </button>
      )}


      {selectedRequest && showForm && (
        <>
          {/* Product Details (Read-only) */}
          <div className="bg-gray-50 p-4 rounded border">
            <h4 className="font-semibold mb-2">Request Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Code
                </label>
                <input
                  value={selectedRequest.product_code}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Name
                </label>
                <input
                  value={selectedRequest.product_name}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Requested Quantity
                </label>
                <input
                  value={selectedRequest.quantity}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  From Company
                </label>
                <input
                  value={selectedRequest.from_company || "N/A"}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Contact
                </label>
                <input
                  value={selectedRequest.contact || "N/A"}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Mode of Transport
                </label>
                <input
                  value={selectedRequest.mode_of_transport || "N/A"}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              {selectedRequest.mode_of_transport === "Porter" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Porter Contact
                  </label>
                  <input
                    value={selectedRequest.porter_contact || "N/A"}
                    disabled
                    className="w-full border p-2 rounded bg-white"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Created By
                </label>
                <input
                  value={selectedRequest.created_by}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Request Date
                </label>
                <input
                  value={new Date(
                    selectedRequest.created_at
                  ).toLocaleDateString()}
                  disabled
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
            </div>
          </div>

          {/* Warehouse Receipt Details */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block mb-1 font-medium">Received By</label>
              <input
                value={receivedBy}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Received Date *</label>
              <input
                type="date"
                name="received_date"
                value={formData.received_date}
                onChange={handleChange}
                max={new Date().toISOString().split("T")[0]}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Received Quantity *
              </label>
              <input
                type="number"
                name="received_quantity"
                value={formData.received_quantity}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                min="1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Requested: {selectedRequest.quantity} units
              </p>
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Warehouse/Godown *
              </label>
              <select
                name="warehouse_name"
                value={formData.warehouse_name}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Select Warehouse</option>
                <option value="Delhi - Mundka">Delhi - Mundka</option>
                <option value="Tamil_Nadu - Coimbatore">
                  Tamil_Nadu - Coimbatore
                </option>
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium">Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                placeholder="e.g., Gate 1 / Dock A"
                required
              />
            </div>
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block mb-1 font-medium">Received Image *</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileChange(e, "received_image")}
                className="w-full border p-2 rounded"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Photo proof of received stock
              </p>
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Supporting Document
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileChange(e, "supporting_doc")}
                className="w-full border p-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: Invoice, delivery note, etc.
              </p>
            </div>
          </div>

          {/* Remarks */}
          <div className="mt-4">
            <label className="block mb-1 font-medium">Remarks/Notes</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              rows="3"
              placeholder="Any additional notes about the received stock..."
            />
          </div>

          <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> After submitting, this request will be
              marked as "Fulfilled" and stock quantities will be updated in the
              system.
            </p>
          </div>

          <button
            type="submit"
            className="mt-6 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Confirm Receipt & Update Stock"}
          </button>
        </>
      )}
    </form>
  );
}
