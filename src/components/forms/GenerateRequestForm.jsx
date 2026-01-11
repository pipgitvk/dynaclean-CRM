"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function GenerateRequestForm() {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [product, setProduct] = useState(null);
  const [gstIncluded, setGstIncluded] = useState(true);
  const [createdBy, setCreatedBy] = useState("");
  const [formData, setFormData] = useState({
    quantity: "",
    price_per_unit: "",
    amount_per_unit: "",
    net_amount: "",
    tax_amount: "",
    gst_rate: "",
    from_company: "",
    from_address: "",
    delivery_location: "",
    contact: "",
    transportation_charges: "",
    mode_of_transport: "",
    self_name: "",
    courier_tracking_id: "",
    courier_company: "",
    porter_tracking_id: "",
    porter_contact: "",
    truck_number: "",
    driver_name: "",
    driver_number: "",
  });
  const [files, setFiles] = useState({
    quotation_upload: null,
    payment_proof_upload: null,
    invoice_upload: null,
    product_image: null,
    eway_bill: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve current username
  useEffect(() => {
    try {
      const u =
        typeof window !== "undefined" ? localStorage.getItem("username") : "";
      if (u) setCreatedBy(u);
    } catch {}
    // Best-effort fallback
    if (!createdBy) {
      fetch("/api/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.username) setCreatedBy(data.username);
        })
        .catch(() => {});
    }
  }, []);

  // Product search
  useEffect(() => {
    if (search.length >= 2) {
      fetch(`/api/products/search?q=${search}`)
        .then((res) => res.json())
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    } else {
      setSuggestions([]);
    }
  }, [search]);

  const handleSelect = async (selectedProduct) => {
    setProduct(selectedProduct);
    setSearch(selectedProduct.item_code);
    setSuggestions([]);
    setFormData((f) => ({
      ...f,
      price_per_unit: selectedProduct.price_per_unit,
      gst_rate: selectedProduct.gst_rate,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };

    // Calculate amounts if quantity or price changes
    if (
      name === "quantity" ||
      name === "price_per_unit" ||
      name === "gst_rate"
    ) {
      const quantity =
        name === "quantity" ? Number(value) : Number(newData.quantity);
      const unitPrice =
        name === "price_per_unit"
          ? Number(value)
          : Number(newData.price_per_unit);
      const gstRate =
        name === "gst_rate" ? Number(value) : Number(newData.gst_rate);

      const baseAmount = quantity * unitPrice;
      newData.amount_per_unit = unitPrice.toFixed(2);

      const gstAmount = (baseAmount * gstRate) / 100;
      newData.tax_amount = gstAmount.toFixed(2);

      newData.net_amount = gstIncluded
        ? (baseAmount + gstAmount).toFixed(2)
        : baseAmount.toFixed(2);
    }

    setFormData(newData);
  };

  const toggleGST = () => {
    setGstIncluded((prev) => {
      const updated = !prev;
      const quantity = Number(formData.quantity);
      const unitPrice = Number(formData.price_per_unit);
      const gstRate = Number(formData.gst_rate);
      const baseAmount = quantity * unitPrice;
      const gstAmount = (baseAmount * gstRate) / 100;

      setFormData((f) => ({
        ...f,
        net_amount: updated
          ? (baseAmount + gstAmount).toFixed(2)
          : baseAmount.toFixed(2),
      }));

      return updated;
    });
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

    if (!product) {
      toast.error("Please select a product");
      return;
    }

    if (!files.product_image) {
      toast.error("Product image is mandatory");
      return;
    }

    const submitData = new FormData();

    // Product details
    submitData.append("product_code", product.item_code);
    submitData.append("product_name", product.item_name);
    submitData.append("specification", product.specification || "");
    submitData.append("hsn", product.hsn_sac || "");
    submitData.append("unit", product.unit || "");

    // Form data
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== undefined && formData[key] !== null) {
        submitData.append(key, formData[key]);
      }
    });

    submitData.append("gst_toggle", gstIncluded ? "Add" : "Remove");

    // Attach created_by (frontend hint; backend also derives from token)
    if (createdBy) submitData.append("created_by", createdBy);

    // Files
    Object.keys(files).forEach((key) => {
      if (files[key]) {
        submitData.append(key, files[key]);
      }
    });

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/stock-request", {
        method: "POST",
        body: submitData,
      });

      if (res.ok) {
        toast.success("Stock request created successfully!");
        // Reset form
        setProduct(null);
        setSearch("");
        setFormData({
          quantity: "",
          price_per_unit: "",
          amount_per_unit: "",
          net_amount: "",
          tax_amount: "",
          gst_rate: "",
          from_company: "",
          from_address: "",
          delivery_location: "",
          contact: "",
          transportation_charges: "",
          mode_of_transport: "",
          self_name: "",
          courier_tracking_id: "",
          courier_company: "",
          porter_tracking_id: "",
          porter_contact: "",
          truck_number: "",
          driver_name: "",
          driver_number: "",
        });
        setFiles({
          quotation_upload: null,
          payment_proof_upload: null,
          invoice_upload: null,
          product_image: null,
          eway_bill: null,
        });
        // Reset file inputs
        document
          .querySelectorAll('input[type="file"]')
          .forEach((input) => (input.value = ""));
      } else if (res.status === 409) {
        const error = await res
          .json()
          .catch(() => ({ error: "Duplicate stock request" }));
        toast.error(
          error.error ||
            "A duplicate stock request exists for the same product and details."
        );
      } else {
        const error = await res
          .json()
          .catch(() => ({ error: "Failed to create request" }));
        toast.error(error.error || "Failed to create request");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6"
    >
      <h3 className="text-lg font-semibold mb-4">Generate Stock Request</h3>

      {/* Product Search */}
      <div>
        <label className="block mb-1 font-medium">Product Code *</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded p-2"
          placeholder="Type product code..."
        />
        {suggestions.length > 0 && (
          <ul className="border rounded mt-1 bg-white shadow max-h-40 overflow-auto">
            {suggestions.map((sug) => (
              <li
                key={sug.item_code}
                onClick={() => handleSelect(sug)}
                className="p-2 cursor-pointer hover:bg-gray-100"
              >
                <p>
                  <span className="font-bold">Code:</span> {sug.item_code}
                </p>
                <p>
                  <span className="font-bold">Name:</span> {sug.item_name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {product && (
        <>
          {/* 1. Item */}
          <h4 className="text-md font-semibold mt-4 mb-2">1. Item</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Product Name</label>
              <input
                value={product.item_name}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">Specification</label>
              <input
                value={product.specification || "N/A"}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">HSN/SAC</label>
              <input
                value={product.hsn_sac || "N/A"}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">Unit</label>
              <input
                value={product.unit || "N/A"}
                disabled
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
          </div>

          {/* 2. Pricing */}
          <h4 className="text-md font-semibold mt-6 mb-2">2. Pricing</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">GST Rate (%)</label>
              <input
                type="number"
                name="gst_rate"
                value={formData.gst_rate}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                step="0.01"
              />
            </div>
            <div>
              <label className="block mb-1">Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Purchase Price*</label>
              <input
                type="number"
                name="price_per_unit"
                value={formData.price_per_unit}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Amount per Unit</label>
              <input
                type="number"
                name="amount_per_unit"
                value={formData.amount_per_unit}
                readOnly
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="flex items-center justify-between mb-1">
                <span>Net Amount</span>
                <button
                  type="button"
                  onClick={toggleGST}
                  className="text-blue-600 underline text-sm"
                >
                  {gstIncluded ? "Remove GST" : "Add GST"}
                </button>
              </label>
              <input
                type="number"
                value={formData.net_amount}
                readOnly
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">Tax Amount</label>
              <input
                type="number"
                value={formData.tax_amount}
                readOnly
                className="w-full border p-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1">Transportation Charges</label>
              <input
                type="number"
                name="transportation_charges"
                value={formData.transportation_charges}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* 3. Attachments */}
          <h4 className="text-md font-semibold mt-6 mb-2">3. Attachments</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Quotation Upload</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => handleFileChange(e, "quotation_upload")}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Payment Proof Upload</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => handleFileChange(e, "payment_proof_upload")}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Invoice Upload</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => handleFileChange(e, "invoice_upload")}
                className="w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Product Image *</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleFileChange(e, "product_image")}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1">E-Way Bill</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => handleFileChange(e, "eway_bill")}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>

          {/* 4. Company & Delivery */}
          <h4 className="text-md font-semibold mt-6 mb-2">
            4. Company & Delivery
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">From Company *</label>
              <input
                type="text"
                name="from_company"
                value={formData.from_company}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block mb-1">From Address *</label>
              <textarea
                name="from_address"
                value={formData.from_address}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                rows="2"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Contact *</label>
              <input
                type="text"
                name="contact"
                value={formData.contact}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                placeholder="Contact person/number"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block mb-1">Delivery Location *</label>
              <textarea
                name="delivery_location"
                value={formData.delivery_location}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                rows="2"
                required
              />
            </div>
          </div>

          {/* 5. Transport */}
          <h4 className="text-md font-semibold mt-6 mb-2">5. Transport</h4>
          <div>
            <label className="block mb-1">Mode of Transport *</label>
            <select
              name="mode_of_transport"
              value={formData.mode_of_transport}
              onChange={handleChange}
              className="w-full border p-2 rounded"
              required
            >
              <option value="">Select Mode</option>
              <option value="Self">Self</option>
              <option value="Courier">Courier</option>
              <option value="Porter">Porter</option>
              <option value="Truck">Truck</option>
            </select>
          </div>

          {/* Conditional Transport Fields */}
          {formData.mode_of_transport === "Self" && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block mb-1">Name *</label>
                <input
                  type="text"
                  name="self_name"
                  value={formData.self_name}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
            </div>
          )}

          {formData.mode_of_transport === "Courier" && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block mb-1">Tracking ID *</label>
                <input
                  type="text"
                  name="courier_tracking_id"
                  value={formData.courier_tracking_id}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Courier Company *</label>
                <input
                  type="text"
                  name="courier_company"
                  value={formData.courier_company}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
            </div>
          )}

          {formData.mode_of_transport === "Porter" && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block mb-1">Tracking ID *</label>
                <input
                  type="text"
                  name="porter_tracking_id"
                  value={formData.porter_tracking_id}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Porter Contact</label>
                <input
                  type="text"
                  name="porter_contact"
                  value={formData.porter_contact}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  placeholder="Porter contact person/number"
                />
              </div>
            </div>
          )}

          {formData.mode_of_transport === "Truck" && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block mb-1">Truck Number *</label>
                <input
                  type="text"
                  name="truck_number"
                  value={formData.truck_number}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Driver Name *</label>
                <input
                  type="text"
                  name="driver_name"
                  value={formData.driver_name}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">Driver Number *</label>
                <input
                  type="tel"
                  name="driver_number"
                  value={formData.driver_number}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="mt-6 bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </>
      )}
    </form>
  );
}
