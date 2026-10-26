"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Edit, Eye, ClipboardList, History, X } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
const IST = "Asia/Kolkata";

/* ── FollowUpModal ────────────────────────────────────── */
function FollowUpModal({ amc, onClose, onSaved }) {
  const nowIST   = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
  const minDT    = new Date(nowIST.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 16);
  const maxDT    = new Date(nowIST.getTime() - 60 * 1000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    serial_number: amc.serial_number || "",
    product_model: amc.model || "",
    contact: amc.contact || "",
    followed_at: maxDT,
    notes: "",
    next_followup_date: "",
    image: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData();
    fd.append("serial_number", form.serial_number);
    fd.append("product_model", form.product_model);
    fd.append("contact", form.contact);
    fd.append("followed_at", form.followed_at);
    fd.append("notes", form.notes);
    fd.append("next_followup_date", form.next_followup_date);
    if (form.image) fd.append("image", form.image);
    try {
      const res = await fetch("/api/machines-followup", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) { toast.success("Follow-up added!"); onSaved(); onClose(); }
      else toast.error(data.error || "Something went wrong");
    } catch { toast.error("Submission failed"); }
    finally { setSubmitting(false); }
  };

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-bold text-gray-800">Add Follow-up</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
            <input type="text" value={form.serial_number} disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Followed At (within last 24h) *</label>
            <input type="datetime-local" value={form.followed_at} min={minDT} max={maxDT} required onChange={set("followed_at")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={3} value={form.notes} onChange={set("notes")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date *</label>
            <input type="datetime-local" value={form.next_followup_date} required onChange={set("next_followup_date")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
            <input type="file" accept="image/*" onChange={(e) => setForm(p => ({ ...p, image: e.target.files[0] || null }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors">
              {submitting ? "Submitting..." : "Submit Follow-up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── HistoryModal ─────────────────────────────────────── */
function HistoryModal({ serialNumber, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/machines-followup?serial=${encodeURIComponent(serialNumber)}`);
        const data = await res.json();
        if (data.success) setRecords(data.history || []);
        else toast.error(data.error || "Failed to load history");
      } catch { toast.error("Failed to load history"); }
      finally { setLoading(false); }
    })();
  }, [serialNumber]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <History size={20} className="text-purple-600" /> Follow-up History
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">Serial: <span className="font-semibold text-gray-700">{serialNumber}</span></p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={22} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-gray-300 mt-1" />
                    {i < 3 && <div className="w-0.5 h-16 bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-4 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No history found.</p>
          ) : (
            <ol className="relative border-l-2 border-purple-200 ml-3">
              {records.map((rec, idx) => (
                <li key={rec.id} className="mb-6 ml-5">
                  <span className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${idx === 0 ? "bg-purple-600" : "bg-gray-400"}`}>
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </span>
                  <div className={`p-4 rounded-lg border ${idx === 0 ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="text-xs text-gray-500">#{rec.id} by <span className="font-semibold">{rec.added_by}</span></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2">
                      <div><span className="text-gray-500">Followed At:</span> <span className="font-medium">{dayjs(rec.followed_at).tz(IST).format("DD/MM/YYYY HH:mm")}</span></div>
                      <div><span className="text-gray-500">Next Follow-up:</span> <span className="font-medium">{rec.next_followup_date ? dayjs(rec.next_followup_date).tz(IST).format("DD/MM/YYYY HH:mm") : "—"}</span></div>
                      {rec.notes && <div className="sm:col-span-2"><span className="text-gray-500">Notes:</span> <span className="font-medium">{rec.notes}</span></div>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="p-4 border-t flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function UserAMCCMCPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [historySerial, setHistorySerial] = useState(null);

  const fetchRecords = useCallback(
    async (page, search = "") => {
      setLoading(true);
      try {
        const url = `/api/amc-cmc?page=${page}&limit=${pageSize}&search=${encodeURIComponent(
          search
        )}`;
        const res = await fetch(url);
        const data = await res.json();

        setRecords(data.amc_cmc || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setCurrentPage(data.currentPage || 1);
      } catch (error) {
        console.error("Error fetching records:", error);
        toast.error("Failed to fetch records");
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchRecords(currentPage, searchQuery);
  }, [currentPage, fetchRecords]);

  useEffect(() => {
    setCurrentPage(1);
    fetchRecords(1, searchQuery);
  }, [searchQuery, fetchRecords]);

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My AMC/CMC Requests</h1>
        <Link
          href="/user-dashboard/amc-cmc/add"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Add AMC/CMC Request
        </Link>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by serial number, company name, contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto shadow rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="p-3 text-left">Serial #</th>
              <th className="p-3 text-left">Model</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">AMC Period</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                  <td className="p-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                  </td>
                </tr>
              ))
            ) : records.length > 0 ? (
              records.map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-semibold">{record.serial_number}</td>
                  <td className="p-3">{record.model || "—"}</td>
                  <td className="p-3">{record.company_name}</td>
                  <td className="p-3">{record.contact || "—"}</td>
                  <td className="p-3 text-sm">
                    {new Date(record.amc_start_datetime).toLocaleDateString()} -{" "}
                    {new Date(record.amc_end_datetime).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                        record.status
                      )}`}
                    >
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    {new Date(record.created_time).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-center">
                      <Link
                        href={`/user-dashboard/amc-cmc/view/${record.id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="View"
                      >
                        <Eye size={18} />
                      </Link>
                      <button
                        onClick={() => setFollowUpTarget(record)}
                        className="text-green-600 hover:text-green-800"
                        title="Add Follow-up"
                      >
                        <ClipboardList size={18} />
                      </button>
                      <button
                        onClick={() => setHistorySerial(record.serial_number)}
                        className="text-purple-600 hover:text-purple-800"
                        title="View History"
                      >
                        <History size={18} />
                      </button>
                      {record.status === "pending" && (
                        <>
                          <Link
                            href={`/user-dashboard/amc-cmc/edit/${record.id}`}
                            className="text-yellow-600 hover:text-yellow-800"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </Link>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="p-6 text-center text-gray-500">
                  No AMC/CMC records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && records.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">
            Showing {Math.min((currentPage - 1) * pageSize + 1, total)} to{" "}
            {Math.min(currentPage * pageSize, total)} of {total} records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i;
              if (pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 border rounded ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Follow Up Modal ── */}
      {followUpTarget && (
        <FollowUpModal
          amc={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onSaved={() => {
            fetchRecords(currentPage, searchQuery);
            setFollowUpTarget(null);
          }}
        />
      )}

      {/* ── History Modal ── */}
      {historySerial && (
        <HistoryModal
          serialNumber={historySerial}
          onClose={() => setHistorySerial(null)}
        />
      )}
    </div>
  );
}
