"use client";
import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { Search, Plus, X, Calendar, Image as ImageIcon, Eye } from "lucide-react";
import toast from "react-hot-toast";

export default function ServiceFollowupsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    serial_number: "",
    product_model: "",
    notes: "",
    next_followup_date: "",
    image: null,
    followed_at: "",
    contact: ""
  });
  const [serialSearch, setSerialSearch] = useState("");
  const [serialSuggestions, setSerialSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchFollowups = useCallback(async (page, search = "") => {
    setLoading(true);
    try {
      const url = `/api/machines-followup?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setFollowups(data.followups || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setCurrentPage(data.currentPage || 1);
      } else {
        toast.error(data.error || "Failed to fetch followups");
      }
    } catch (error) {
      console.error("Error fetching followups:", error);
      toast.error("Failed to fetch followups");
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchFollowups(currentPage, searchQuery);
  }, [currentPage, fetchFollowups, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchFollowups(1, searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchFollowups]);

  useEffect(() => {
    const searchSerials = async () => {
      if (serialSearch.length < 2) {
        setSerialSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await fetch("/api/machines-followup", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search: serialSearch })
        });
        const data = await res.json();
        if (data.success) {
          setSerialSuggestions(data.products || []);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Error searching serials:", error);
      }
    };
    const timer = setTimeout(searchSerials, 300);
    return () => clearTimeout(timer);
  }, [serialSearch]);

  const handleSelectProduct = (product) => {
    setFormData(prev => ({
      ...prev,
      serial_number: product.serial_number,
      product_model: product.model
    }));
    setSerialSearch(product.serial_number);
    setShowSuggestions(false);
  };

  const [minFollowedAt, setMinFollowedAt] = useState("");
  const [maxFollowedAt, setMaxFollowedAt] = useState("");
  
  const formatLocalDateTime = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleOpenModal = () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute earlier to avoid issues
    setMinFollowedAt(formatLocalDateTime(oneDayAgo));
    setMaxFollowedAt(formatLocalDateTime(maxTime));
    setFormData({
      serial_number: "",
      product_model: "",
      notes: "",
      next_followup_date: "",
      image: null,
      followed_at: formatLocalDateTime(maxTime),
      contact: ""
    });
    setSerialSearch("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("serial_number", formData.serial_number);
      formDataToSend.append("product_model", formData.product_model);
      formDataToSend.append("notes", formData.notes);
      formDataToSend.append("next_followup_date", formData.next_followup_date);
      formDataToSend.append("followed_at", formData.followed_at);
      formDataToSend.append("contact", formData.contact);
      if (formData.image) {
        formDataToSend.append("image", formData.image);
      }

      const res = await fetch("/api/machines-followup", {
        method: "POST",
        body: formDataToSend
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up added successfully!");
        setIsModalOpen(false);
        fetchFollowups(currentPage, searchQuery);
      } else {
        toast.error(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error("Error submitting followup:", error);
      toast.error("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const SkeletonRow = () => (
    <tr className="odd:bg-white even:bg-gray-50 animate-pulse">
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-20"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-32"></div></td>
      <td className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-24"></div></td>
    </tr>
  );

  return (
    <div className="w-full max-w-full p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Service Follow-ups</h2>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Add Follow-up
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by serial number, model, added by, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col w-full">
        <div className="hidden md:block flex-grow overflow-hidden w-full">
          <div className="h-full w-full overflow-x-auto overflow-y-auto rounded border shadow bg-white">
            <table className="w-full text-sm text-left border-collapse table-auto">
              <thead className="bg-gray-800 text-white sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="p-3 border-b border-gray-700">ID</th>
                  <th className="p-3 border-b border-gray-700">Serial Number</th>
                  <th className="p-3 border-b border-gray-700">Product Model</th>
                  <th className="p-3 border-b border-gray-700">Contact</th>
                  <th className="p-3 border-b border-gray-700">Followed At</th>
                  <th className="p-3 border-b border-gray-700">Next Follow-up</th>
                  <th className="p-3 border-b border-gray-700">Added By</th>
                  <th className="p-3 border-b border-gray-700">Image</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, idx) => <SkeletonRow key={idx} />)
                ) : followups.length > 0 ? (
                  followups.map((fu, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td className="p-3 border-b border-gray-200 font-medium">{fu.id}</td>
                      <td className="p-3 border-b border-gray-200">{fu.serial_number}</td>
                      <td className="p-3 border-b border-gray-200">{fu.product_model || "-"}</td>
                      <td className="p-3 border-b border-gray-200">{fu.contact || "-"}</td>
                      <td className="p-3 border-b border-gray-200">
                        {dayjs(fu.followed_at).format("DD/MM/YYYY HH:mm")}
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        {fu.next_followup_date ? dayjs(fu.next_followup_date).format("DD/MM/YYYY HH:mm") : "-"}
                      </td>
                      <td className="p-3 border-b border-gray-200">{fu.added_by}</td>
                      <td className="p-3 border-b border-gray-200">
                        {fu.image ? (
                          <button
                            onClick={() => setPreviewImage(fu.image)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Eye size={16} />
                            View
                          </button>
                        ) : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center p-4 text-gray-500">
                      No follow-ups found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Follow-up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Add Service Follow-up</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                <input
                  type="text"
                  value={serialSearch}
                  onChange={(e) => setSerialSearch(e.target.value)}
                  placeholder="Search serial number..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {showSuggestions && serialSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {serialSuggestions.map((product, idx) => (
                      <div
                        key={idx}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div className="font-medium">{product.serial_number}</div>
                        <div className="text-sm text-gray-600">{product.model} - {product.product_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Model</label>
                <input
                  type="text"
                  value={formData.product_model}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_model: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                  placeholder="Enter email or phone number"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Followed At (within last 24h) *
                </label>
                <input
                  type="datetime-local"
                  value={formData.followed_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, followed_at: e.target.value }))}
                  min={minFollowedAt}
                  max={maxFollowedAt}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date *</label>
                <input
                  type="datetime-local"
                  value={formData.next_followup_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, next_followup_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.files[0] }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {formData.image && (
                    <span className="text-sm text-gray-600">{formData.image.name}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img
              src={previewImage}
              alt="Follow-up image"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
