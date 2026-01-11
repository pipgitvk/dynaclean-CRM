"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function SpareDirectInForm() {
    const [search, setSearch] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [spare, setSpare] = useState(null);
    const [gstIncluded, setGstIncluded] = useState(true);
    const [createdBy, setCreatedBy] = useState("");
    const [formData, setFormData] = useState({
        quantity: "",
        price_per_unit: "",
        amount_per_unit: "",
        net_amount: "",
        tax_amount: "",
        tax: "",
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
        // Warehouse In fields
        received_date: new Date().toISOString().split("T")[0],
        received_quantity: "",
        warehouse_name: "",
        location: "",
        remarks: "",
    });
    const [files, setFiles] = useState({
        quotation_upload: null,
        payment_proof_upload: null,
        invoice_upload: null,
        spare_image: null,
        eway_bill: null,
        received_image: null,
        supporting_doc: null,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        try {
            const u = typeof window !== "undefined" ? localStorage.getItem("username") : "";
            if (u) setCreatedBy(u);
        } catch { }
    }, []);

    // Spare search
    useEffect(() => {
        if (search.length >= 2) {
            fetch(`/api/spare/search?q=${encodeURIComponent(search)}`)
                .then((res) => res.json())
                .then(setSuggestions)
                .catch(() => setSuggestions([]));
        } else {
            setSuggestions([]);
        }
    }, [search]);

    const handleSelect = (selectedSpare) => {
        setSpare(selectedSpare);
        setSearch(selectedSpare.item_name);
        setSuggestions([]);
        setFormData((f) => ({
            ...f,
            price_per_unit: selectedSpare.price || "",
            tax: selectedSpare.tax || "",
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newData = { ...formData, [name]: value };

        // Auto-sync received_quantity with quantity
        if (name === "quantity") {
            newData.received_quantity = value;
        }

        // Calculate amounts if quantity or price changes
        if (name === "quantity" || name === "price_per_unit" || name === "tax") {
            const quantity = name === "quantity" ? Number(value) : Number(newData.quantity);
            const unitPrice = name === "price_per_unit" ? Number(value) : Number(newData.price_per_unit);
            const taxRate = name === "tax" ? Number(value) : Number(newData.tax);

            const baseAmount = quantity * unitPrice;
            newData.amount_per_unit = unitPrice.toFixed(2);

            const taxAmount = (baseAmount * taxRate) / 100;
            newData.tax_amount = taxAmount.toFixed(2);

            newData.net_amount = gstIncluded
                ? (baseAmount + taxAmount).toFixed(2)
                : baseAmount.toFixed(2);
        }

        setFormData(newData);
    };

    const toggleGST = () => {
        setGstIncluded((prev) => {
            const updated = !prev;
            const quantity = Number(formData.quantity);
            const unitPrice = Number(formData.price_per_unit);
            const taxRate = Number(formData.tax);
            const baseAmount = quantity * unitPrice;
            const taxAmount = (baseAmount * taxRate) / 100;

            setFormData((f) => ({
                ...f,
                net_amount: updated ? (baseAmount + taxAmount).toFixed(2) : baseAmount.toFixed(2),
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

        if (!spare) {
            toast.error("Please select a spare");
            return;
        }

        if (!files.spare_image) {
            toast.error("Spare image is mandatory");
            return;
        }

        if (!files.received_image) {
            toast.error("Received image is mandatory");
            return;
        }

        const submitData = new FormData();

        // Spare details
        submitData.append("spare_id", spare.id);
        submitData.append("spare_name", spare.item_name);
        submitData.append("specification", spare.specification || "");

        // Form data
        Object.keys(formData).forEach((key) => {
            if (formData[key] !== undefined && formData[key] !== null) {
                submitData.append(key, formData[key]);
            }
        });

        submitData.append("gst_toggle", gstIncluded ? "Add" : "Remove");

        if (createdBy) submitData.append("created_by", createdBy);

        // Files
        Object.keys(files).forEach((key) => {
            if (files[key]) {
                submitData.append(key, files[key]);
            }
        });

        setIsSubmitting(true);

        try {
            const res = await fetch("/api/spare/direct-in", {
                method: "POST",
                body: submitData,
            });

            if (res.ok) {
                toast.success("Direct spare stock entry created successfully!");
                // Reset form
                setSpare(null);
                setSearch("");
                setFormData({
                    quantity: "",
                    price_per_unit: "",
                    amount_per_unit: "",
                    net_amount: "",
                    tax_amount: "",
                    tax: "",
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
                    received_date: new Date().toISOString().split("T")[0],
                    received_quantity: "",
                    warehouse_name: "",
                    location: "",
                    remarks: "",
                });
                setFiles({
                    quotation_upload: null,
                    payment_proof_upload: null,
                    invoice_upload: null,
                    spare_image: null,
                    eway_bill: null,
                    received_image: null,
                    supporting_doc: null,
                });
                document.querySelectorAll('input[type="file"]').forEach((i) => (i.value = ""));
            } else {
                const error = await res.json().catch(() => ({ error: "Failed to create direct entry" }));
                toast.error(error.error || "Failed to create direct entry");
            }
        } catch (error) {
            console.error("Error:", error);
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
            <h3 className="text-lg font-semibold mb-4">Spare Direct In - Purchase & Receive Stock</h3>
            <p className="text-sm text-gray-600 mb-4">
                This form combines purchase request and warehouse receipt into a single entry for direct spare stock intake.
            </p>

            {/* Spare Search */}
            <div>
                <label className="block mb-1 font-medium">Spare Name *</label>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full border rounded p-2"
                    placeholder="Type spare name..."
                />
                {suggestions.length > 0 && (
                    <ul className="border rounded mt-1 bg-white shadow max-h-40 overflow-auto">
                        {suggestions.map((sug) => (
                            <li
                                key={sug.id}
                                onClick={() => handleSelect(sug)}
                                className="p-2 cursor-pointer hover:bg-gray-100"
                            >
                                <p><span className="font-bold">Name:</span> {sug.item_name}</p>
                                <p className="text-sm text-gray-600">{sug.specification}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {spare && (
                <>
                    {/* 1. Item */}
                    <h4 className="text-md font-semibold mt-4 mb-2">1. Item Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Spare Name</label>
                            <input value={spare.item_name} disabled className="w-full border p-2 rounded bg-gray-100" />
                        </div>
                        <div>
                            <label className="block mb-1">Specification</label>
                            <input value={spare.specification || "N/A"} disabled className="w-full border p-2 rounded bg-gray-100" />
                        </div>
                    </div>

                    {/* 2. Pricing */}
                    <h4 className="text-md font-semibold mt-6 mb-2">2. Pricing</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Tax (%)</label>
                            <input
                                type="number"
                                name="tax"
                                value={formData.tax}
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
                            <label className="block mb-1">Purchase Price *</label>
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
                            <input type="number" name="amount_per_unit" value={formData.amount_per_unit} readOnly className="w-full border p-2 rounded bg-gray-100" />
                        </div>
                        <div>
                            <label className="flex items-center justify-between mb-1">
                                <span>Net Amount</span>
                                <button type="button" onClick={toggleGST} className="text-blue-600 underline text-sm">
                                    {gstIncluded ? "Remove Tax" : "Add Tax"}
                                </button>
                            </label>
                            <input type="number" value={formData.net_amount} readOnly className="w-full border p-2 rounded bg-gray-100" />
                        </div>
                        <div>
                            <label className="block mb-1">Tax Amount</label>
                            <input type="number" value={formData.tax_amount} readOnly className="w-full border p-2 rounded bg-gray-100" />
                        </div>
                        <div>
                            <label className="block mb-1">Transportation Charges</label>
                            <input type="number" name="transportation_charges" value={formData.transportation_charges} onChange={handleChange} className="w-full border p-2 rounded" step="0.01" placeholder="0.00" />
                        </div>
                    </div>

                    {/* 3. Attachments */}
                    <h4 className="text-md font-semibold mt-6 mb-2">3. Attachments</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Quotation Upload</label>
                            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => handleFileChange(e, "quotation_upload")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block mb-1">Payment Proof Upload</label>
                            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => handleFileChange(e, "payment_proof_upload")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block mb-1">Invoice Upload</label>
                            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => handleFileChange(e, "invoice_upload")} className="w-full border p-2 rounded" />
                        </div>
                        <div>
                            <label className="block mb-1">Spare Image *</label>
                            <input type="file" accept=".pdf,image/*" onChange={(e) => handleFileChange(e, "spare_image")} className="w-full border p-2 rounded" required />
                        </div>
                        <div>
                            <label className="block mb-1">E-Way Bill</label>
                            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => handleFileChange(e, "eway_bill")} className="w-full border p-2 rounded" />
                        </div>
                    </div>

                    {/* 4. Company & Delivery */}
                    <h4 className="text-md font-semibold mt-6 mb-2">4. Company & Delivery</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">From Company *</label>
                            <input type="text" name="from_company" value={formData.from_company} onChange={handleChange} className="w-full border p-2 rounded" required />
                        </div>
                        <div>
                            <label className="block mb-1">From Address *</label>
                            <textarea name="from_address" value={formData.from_address} onChange={handleChange} className="w-full border p-2 rounded" rows="2" required />
                        </div>
                        <div>
                            <label className="block mb-1">Contact *</label>
                            <input type="text" name="contact" value={formData.contact} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Contact person/number" required />
                        </div>
                        <div className="col-span-2">
                            <label className="block mb-1">Delivery Location *</label>
                            <textarea name="delivery_location" value={formData.delivery_location} onChange={handleChange} className="w-full border p-2 rounded" rows="2" required />
                        </div>
                    </div>

                    {/* 5. Transport */}
                    <h4 className="text-md font-semibold mt-6 mb-2">5. Transport</h4>
                    <div>
                        <label className="block mb-1">Mode of Transport *</label>
                        <select name="mode_of_transport" value={formData.mode_of_transport} onChange={handleChange} className="w-full border p-2 rounded" required>
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
                                <input type="text" name="self_name" value={formData.self_name} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                        </div>
                    )}

                    {formData.mode_of_transport === "Courier" && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block mb-1">Tracking ID *</label>
                                <input type="text" name="courier_tracking_id" value={formData.courier_tracking_id} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                            <div>
                                <label className="block mb-1">Courier Company *</label>
                                <input type="text" name="courier_company" value={formData.courier_company} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                        </div>
                    )}

                    {formData.mode_of_transport === "Porter" && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block mb-1">Tracking ID *</label>
                                <input type="text" name="porter_tracking_id" value={formData.porter_tracking_id} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                            <div>
                                <label className="block mb-1">Porter Contact</label>
                                <input type="text" name="porter_contact" value={formData.porter_contact} onChange={handleChange} className="w-full border p-2 rounded" placeholder="Porter contact person/number" />
                            </div>
                        </div>
                    )}

                    {formData.mode_of_transport === "Truck" && (
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div>
                                <label className="block mb-1">Truck Number *</label>
                                <input type="text" name="truck_number" value={formData.truck_number} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                            <div>
                                <label className="block mb-1">Driver Name *</label>
                                <input type="text" name="driver_name" value={formData.driver_name} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                            <div>
                                <label className="block mb-1">Driver Number *</label>
                                <input type="tel" name="driver_number" value={formData.driver_number} onChange={handleChange} className="w-full border p-2 rounded" required />
                            </div>
                        </div>
                    )}

                    {/* 6. Warehouse Receipt */}
                    <h4 className="text-md font-semibold mt-6 mb-2">6. Warehouse Receipt</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1 font-medium">Received By</label>
                            <input value={createdBy} disabled className="w-full border p-2 rounded bg-gray-100" />
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
                            <label className="block mb-1 font-medium">Received Quantity *</label>
                            <input
                                type="number"
                                name="received_quantity"
                                value={formData.received_quantity}
                                onChange={handleChange}
                                className="w-full border p-2 rounded"
                                min="1"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">Auto-synced with order quantity</p>
                        </div>
                        <div>
                            <label className="block mb-1 font-medium">Warehouse/Godown *</label>
                            <select name="warehouse_name" value={formData.warehouse_name} onChange={handleChange} className="w-full border p-2 rounded" required>
                                <option value="">Select Warehouse</option>
                                <option value="Delhi - Mundka">Delhi - Mundka</option>
                                <option value="Tamil_Nadu - Coimbatore">Tamil_Nadu - Coimbatore</option>
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
                        <div>
                            <label className="block mb-1 font-medium">Received Image *</label>
                            <input type="file" accept=".pdf,image/*" onChange={(e) => handleFileChange(e, "received_image")} className="w-full border p-2 rounded" required />
                            <p className="text-xs text-gray-500 mt-1">Photo proof of received stock</p>
                        </div>
                        <div>
                            <label className="block mb-1 font-medium">Supporting Document</label>
                            <input type="file" accept=".pdf,image/*" onChange={(e) => handleFileChange(e, "supporting_doc")} className="w-full border p-2 rounded" />
                            <p className="text-xs text-gray-500 mt-1">Optional: Invoice, delivery note, etc.</p>
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block mb-1 font-medium">Remarks/Notes</label>
                        <textarea
                            name="remarks"
                            value={formData.remarks}
                            onChange={handleChange}
                            className="w-full border p-2 rounded"
                            rows="3"
                            placeholder="Any additional notes about the spare stock..."
                        />
                    </div>

                    <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> This direct entry will create both a spare purchase request and immediately mark it as received in the warehouse.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Submitting..." : "Submit Direct Entry"}
                    </button>
                </>
            )}
        </form>
    );
}
