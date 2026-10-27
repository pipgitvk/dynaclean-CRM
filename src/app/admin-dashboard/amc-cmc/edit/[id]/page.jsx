"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

export default function EditAMCCMCPage() {
  const params = useParams();
  const router = useRouter();
  const [serialNumber, setSerialNumber] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serialSuggestions, setSerialSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    serial_number: "",
    model: "",
    company_name: "",
    contact: "",
    email: "",
    company_address: "",
    site_address: "",
    site_contact: "",
    site_email: "",
    amc_start_datetime: "",
    amc_end_datetime: "",
    quotation_ref: "",
    terms_and_conditions: "",
  });

  const [files, setFiles] = useState({
    image_at_the_time_of_amc: null,
    invoice: null,
    payment_proof: null,
  });

  // Fetch serial number suggestions
  const fetchSerialSuggestions = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 1) {
      setSerialSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `/api/warranty/serial-numbers?search=${encodeURIComponent(searchTerm)}`
      );
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      setSerialSuggestions(data.data || []);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSerialSuggestions([]);
    }
  }, []);

  const handleSerialChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, serial_number: value }));
    fetchSerialSuggestions(value);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (suggestion) => {
    setFormData((prev) => ({
      ...prev,
      serial_number: suggestion.serial_number,
      model: suggestion.model || prev.model,
      company_name: suggestion.customer_name || prev.company_name,
      contact: suggestion.contact || prev.contact,
      email: suggestion.email || prev.email,
      company_address: suggestion.customer_address || prev.company_address,
    }));
    setShowSuggestions(false);
    setSerialSuggestions([]);
  };

  useEffect(() => {
    if (params?.id) {
      setSerialNumber(params.id);
    }
  }, [params]);

  useEffect(() => {
    if (!serialNumber) return;

    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/amc-cmc/${serialNumber}`);
        if (!res.ok) throw new Error("Failed to fetch record");

        const data = await res.json();
        setFormData({
          serial_number: data.serial_number || "",
          model: data.model || "",
          company_name: data.company_name || "",
          contact: data.contact || "",
          email: data.email || "",
          company_address: data.company_address || "",
          site_address: data.site_address || "",
          site_contact: data.site_contact || "",
          site_email: data.site_email || "",
          amc_start_datetime: data.amc_start_datetime?.replace(" ", "T").slice(0, 16) || "",
          amc_end_datetime: data.amc_end_datetime?.replace(" ", "T").slice(0, 16) || "",
          quotation_ref: data.quotation_ref || "",
          terms_and_conditions: data.terms_and_conditions || "",
        });
      } catch (error) {
        toast.error("Failed to load record");
        router.push("/admin-dashboard/amc-cmc");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [serialNumber, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    if (fileList && fileList[0]) {
      setFiles((prev) => ({ ...prev, [name]: fileList[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();

      Object.keys(formData).forEach((key) => {
        if (formData[key]) {
          formDataToSend.append(key, formData[key]);
        }
      });

      Object.keys(files).forEach((key) => {
        if (files[key]) {
          formDataToSend.append(key, files[key]);
        }
      });

      const res = await fetch(`/api/amc-cmc/${serialNumber}`, {
        method: "PUT",
        body: formDataToSend,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update record");
      }

      toast.success("Record updated successfully");
      router.push(`/admin-dashboard/amc-cmc/view/${serialNumber}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/admin-dashboard/amc-cmc"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft size={18} />
        Back to AMC/CMC
      </Link>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold mb-6">Edit AMC/CMC Record</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Product Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-1">Serial Number *</label>
                <input
                  type="text"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleSerialChange}
                  onFocus={() => showSuggestions && serialSuggestions.length > 0 && setShowSuggestions(true)}
                  required
                  autoComplete="off"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Start typing to search..."
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && serialSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {serialSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-gray-900">{suggestion.serial_number}</div>
                        <div className="text-sm text-gray-600">
                          {suggestion.product_name && <div>Product: {suggestion.product_name}</div>}
                          {suggestion.model && <div>Model: {suggestion.model}</div>}
                          {suggestion.customer_name && <div>Company: {suggestion.customer_name}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Image at time of AMC</label>
                <input
                  type="file"
                  name="image_at_the_time_of_amc"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                {files.image_at_the_time_of_amc && (
                  <p className="text-sm text-green-600 mt-1">New file selected: {files.image_at_the_time_of_amc.name}</p>
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  disabled
                  required
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact</label>
                <input
                  type="tel"
                  name="contact"
                  value={formData.contact}
                  onChange={handleInputChange}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Company Address</label>
                <textarea
                  name="company_address"
                  value={formData.company_address}
                  onChange={handleInputChange}
                  disabled
                  rows="2"
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-600 focus:outline-none"
                ></textarea>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Site Address</label>
                <textarea
                  name="site_address"
                  value={formData.site_address}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Site Contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Site Contact</label>
                <input
                  type="tel"
                  name="site_contact"
                  value={formData.site_contact}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Site Email</label>
                <input
                  type="email"
                  name="site_email"
                  value={formData.site_email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">AMC Period</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">AMC Start Date *</label>
                <input
                  type="datetime-local"
                  name="amc_start_datetime"
                  value={formData.amc_start_datetime}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AMC End Date *</label>
                <input
                  type="datetime-local"
                  name="amc_end_datetime"
                  value={formData.amc_end_datetime}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b">Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quotation Reference</label>
                <input
                  type="text"
                  name="quotation_ref"
                  value={formData.quotation_ref}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Invoice (PDF/Image)</label>
                <input
                  type="file"
                  name="invoice"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Proof (PDF/Image)</label>
                <input
                  type="file"
                  name="payment_proof"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Terms and Conditions</label>
                <textarea
                  name="terms_and_conditions"
                  value={formData.terms_and_conditions}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>
          </section>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg"
            >
              {submitting ? "Updating..." : "Update Record"}
            </button>
            <Link
              href="/admin-dashboard/amc-cmc"
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
