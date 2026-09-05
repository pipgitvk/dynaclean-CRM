"use client";
import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Search, Plus, X, Eye, ClipboardList, History } from "lucide-react";
import toast from "react-hot-toast";
import {
  FollowUpModal,
  HistoryModal,
  ImagePreviewModal,
  getISTNow,
  toLocalDT,
  IST,
} from "@/components/service/MachineFollowupModals";

dayjs.extend(utc);
dayjs.extend(timezone);

export default function ServiceFollowupsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(50);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [historySerial, setHistorySerial] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchFollowups = useCallback(
    async (page, search = "") => {
      setLoading(true);
      try {
        const url = `/api/machines-followup?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&latest_only=1`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          setFollowups(data.followups || []);
          setTotalPages(data.totalPages || 1);
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
    },
    [pageSize]
  );

  useEffect(() => {
    fetchFollowups(currentPage, searchQuery);
  }, [currentPage, fetchFollowups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchFollowups(1, searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchFollowups]);

  const nowIST = getISTNow();
  const [addMin] = useState(toLocalDT(new Date(nowIST.getTime() - 24 * 3600 * 1000)));
  const [addMax] = useState(toLocalDT(new Date(nowIST.getTime() - 60 * 1000)));
  const [addForm, setAddForm] = useState({
    serial_number: "",
    product_model: "",
    contact: "",
    followed_at: toLocalDT(new Date(nowIST.getTime() - 60 * 1000)),
    notes: "",
    next_followup_date: "",
    image: null,
  });
  const [addSerialSearch, setAddSerialSearch] = useState("");
  const [addSuggestions, setAddSuggestions] = useState([]);
  const [addShowSugg, setAddShowSugg] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    if (addSerialSearch.length < 2) {
      setAddSuggestions([]);
      setAddShowSugg(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/machines-followup", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search: addSerialSearch }),
        });
        const data = await res.json();
        if (data.success) {
          setAddSuggestions(data.products || []);
          setAddShowSugg(true);
        }
      } catch (error) {
        console.error("Error searching serials:", error);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [addSerialSearch]);

  const handleOpenAddModal = () => {
    setAddForm({
      serial_number: "",
      product_model: "",
      contact: "",
      followed_at: addMax,
      notes: "",
      next_followup_date: "",
      image: null,
    });
    setAddSerialSearch("");
    setAddModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddSubmitting(true);
    const fd = new FormData();
    fd.append("serial_number", addForm.serial_number);
    fd.append("product_model", addForm.product_model);
    fd.append("contact", addForm.contact);
    fd.append("followed_at", addForm.followed_at);
    fd.append("notes", addForm.notes);
    fd.append("next_followup_date", addForm.next_followup_date);
    if (addForm.image) fd.append("image", addForm.image);

    try {
      const res = await fetch("/api/machines-followup", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        toast.success("Follow-up added successfully!");
        setAddModalOpen(false);
        fetchFollowups(currentPage, searchQuery);
      } else {
        toast.error(data.error || "Something went wrong");
      }
    } catch (error) {
      console.error("Error submitting followup:", error);
      toast.error("Submission failed");
    } finally {
      setAddSubmitting(false);
    }
  };

  const SkeletonRow = () => (
    <tr className="odd:bg-white even:bg-gray-50 animate-pulse">
      {Array(9)
        .fill(0)
        .map((_, i) => (
          <td key={i} className="p-3 border-b border-gray-200">
            <div className="h-4 bg-gray-300 rounded w-24"></div>
          </td>
        ))}
    </tr>
  );

  return (
    <div className="w-full max-w-full p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Machine Follow-ups</h2>
        <button
          onClick={handleOpenAddModal}
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
                  {["ID", "Serial Number", "Product Model", "Contact", "Followed At", "Next Follow-up", "Added By", "Image", "Action"].map(
                    (h) => (
                      <th key={h} className="p-3 border-b border-gray-700 whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
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
                      <td className="p-3 border-b border-gray-200">{fu.product_model || "—"}</td>
                      <td className="p-3 border-b border-gray-200">{fu.contact || "—"}</td>
                      <td className="p-3 border-b border-gray-200 whitespace-nowrap">
                        {dayjs(fu.followed_at).tz(IST).format("DD/MM/YYYY HH:mm")}
                      </td>
                      <td className="p-3 border-b border-gray-200 whitespace-nowrap">
                        {fu.next_followup_date ? dayjs(fu.next_followup_date).tz(IST).format("DD/MM/YYYY HH:mm") : "—"}
                      </td>
                      <td className="p-3 border-b border-gray-200">{fu.added_by}</td>
                      <td className="p-3 border-b border-gray-200">
                        {fu.image ? (
                          <button
                            onClick={() => setPreviewImage(fu.image)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Eye size={15} /> View
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => setFollowUpTarget(fu)}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap"
                          >
                            <ClipboardList size={13} /> Follow Up
                          </button>
                          <button
                            onClick={() => setHistorySerial(fu.serial_number)}
                            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap"
                          >
                            <History size={13} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center p-4 text-gray-500">
                      No follow-ups found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100"
          >
            Next
          </button>
        </div>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Add Machine Follow-up</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200">
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                <input
                  type="text"
                  value={addSerialSearch}
                  required
                  onChange={(e) => {
                    setAddSerialSearch(e.target.value);
                    setAddForm((p) => ({ ...p, serial_number: e.target.value }));
                  }}
                  placeholder="Search serial number..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {addShowSugg && addSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {addSuggestions.map((p, i) => (
                      <div
                        key={i}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setAddSerialSearch(p.serial_number);
                          setAddForm((prev) => ({
                            ...prev,
                            serial_number: p.serial_number,
                            product_model: p.model,
                            contact: p.contact || p.email || "",
                          }));
                          setAddShowSugg(false);
                        }}
                      >
                        <div className="font-medium">{p.serial_number}</div>
                        <div className="text-sm text-gray-600">
                          {p.model} - {p.product_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {[["Product Model", "product_model"], ["Contact", "contact"]].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    value={addForm[key]}
                    readOnly
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Followed At (within last 24h) *</label>
                <input
                  type="datetime-local"
                  value={addForm.followed_at}
                  min={addMin}
                  max={addMax}
                  required
                  onChange={(e) => setAddForm((p) => ({ ...p, followed_at: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={addForm.notes}
                  onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date *</label>
                <input
                  type="datetime-local"
                  value={addForm.next_followup_date}
                  required
                  onChange={(e) => setAddForm((p) => ({ ...p, next_followup_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAddForm((p) => ({ ...p, image: e.target.files[0] || null }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  {addSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {followUpTarget && (
        <FollowUpModal
          fu={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onSaved={() => fetchFollowups(currentPage, searchQuery)}
        />
      )}

      {historySerial && (
        <HistoryModal
          serialNumber={historySerial}
          onClose={() => setHistorySerial(null)}
          onPreviewImage={(img) => setPreviewImage(img)}
        />
      )}

      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
