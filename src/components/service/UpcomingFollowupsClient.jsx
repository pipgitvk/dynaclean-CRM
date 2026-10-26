"use client";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { CalendarDays, Phone, PackageSearch, ClipboardList, History, Eye, X, Plus } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

dayjs.extend(utc);
dayjs.extend(timezone);
const IST = "Asia/Kolkata";

function getISTNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
}
function toLocalDT(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: IST }));
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  return `${Y}-${M}-${D}T${h}:00`;
}

function FollowUpModal({ fu, onClose, onSaved }) {
  const nowIST = getISTNow();
  const minDT = toLocalDT(new Date(nowIST.getTime() - 24 * 3600 * 1000));
  const maxDT = toLocalDT(new Date(nowIST.getTime() - 60 * 1000));

  const [serialSearch, setSerialSearch] = useState(fu.serial_number || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [form, setForm] = useState({
    serial_number: fu.serial_number || "",
    product_model: fu.product_model || "",
    contact: fu.contact || "",
    followed_at: maxDT,
    notes: "",
    next_followup_date: "",
    image: null,
  });
  const [submitting, setSubmitting] = useState(false);

  /* serial autocomplete */
  const handleSerialSearch = async (value) => {
    setSerialSearch(value);
    setForm(p => ({ ...p, serial_number: value }));
    if (value.length < 2) {
      setSuggestions([]);
      setShowSugg(false);
      return;
    }
    try {
      const res = await fetch("/api/machines-followup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: value }) });
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.products || []);
        setShowSugg(true);
      }
    } catch {
      toast.error("Failed to search serial numbers");
    }
  };

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
      if (data.success) {
        toast.success("Follow-up added!");
        onSaved();
        onClose();
      } else toast.error(data.error || "Something went wrong");
    } catch {
      toast.error("Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-xl font-bold text-gray-800">Service Follow-up</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={22} /></button>
        </div>
        {/* info strip */}
        <div className="px-6 py-4 bg-gray-50 border-b grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[["Serial Number", fu.serial_number], ["Product Model", fu.product_model || "—"], ["Contact", fu.contact || "—"]].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="mt-1 text-sm font-bold text-gray-800">{val}</p>
            </div>
          ))}
        </div>
        {/* form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* serial autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
            <input type="text" value={serialSearch} required
              onChange={(e) => handleSerialSearch(e.target.value)}
              placeholder="Search serial number..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {showSugg && suggestions.length > 0 && (
              <div className="absolute z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((p, i) => (
                  <div key={i} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                    setSerialSearch(p.serial_number);
                    setForm(prev => ({ ...prev, serial_number: p.serial_number, product_model: p.model }));
                    setShowSugg(false);
                  }}>
                    <div className="font-medium">{p.serial_number}</div>
                    <div className="text-sm text-gray-500">{p.model} — {p.product_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Model</label>
            <input type="text" value={form.product_model} onChange={(e) => setForm(p => ({ ...p, product_model: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input type="text" value={form.contact} onChange={(e) => setForm(p => ({ ...p, contact: e.target.value }))} placeholder="Email or phone"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Followed At (within last 24h) *</label>
            <input type="datetime-local" value={form.followed_at} min={minDT} max={maxDT} required onChange={(e) => setForm(p => ({ ...p, followed_at: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date *</label>
            <input type="datetime-local" value={form.next_followup_date} required onChange={(e) => setForm(p => ({ ...p, next_followup_date: e.target.value }))}
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

function HistoryModal({ serialNumber, onClose, onPreviewImage }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/machines-followup?serial=${encodeURIComponent(serialNumber)}`);
        const data = await res.json();
        if (data.success) setRecords(data.history || []);
        else toast.error(data.error || "Failed to load history");
      } catch {
        toast.error("Failed to load history");
      } finally {
        setLoading(false);
      }
    })();
  }, [serialNumber]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <History size={20} className="text-purple-600" /> Follow-up History
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">Serial: <span className="font-semibold text-gray-700">{serialNumber}</span></p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><X size={22} /></button>
        </div>

        {/* timeline body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-gray-300 mt-1" />
                    {i < 3 && <div className="w-0.5 h-16 bg-gray-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-4 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
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
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <span className="text-xs font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">Latest</span>}
                        <span className="text-xs text-gray-400">#{rec.id}</span>
                      </div>
                      <span className="text-xs text-gray-500">Added by <span className="font-semibold text-gray-700">{rec.added_by}</span></span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div><span className="text-gray-500">Followed At:</span> <span className="font-medium">{dayjs(rec.followed_at).tz(IST).format("DD/MM/YYYY HH:mm")}</span></div>
                      <div><span className="text-gray-500">Next Follow-up:</span> <span className="font-medium">{rec.next_followup_date ? dayjs(rec.next_followup_date).tz(IST).format("DD/MM/YYYY HH:mm") : "—"}</span></div>
                      {rec.contact && <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{rec.contact}</span></div>}
                      {rec.product_model && <div><span className="text-gray-500">Model:</span> <span className="font-medium">{rec.product_model}</span></div>}
                      {rec.notes && <div className="sm:col-span-2"><span className="text-gray-500">Notes:</span> <span className="font-medium">{rec.notes}</span></div>}
                      {rec.image && (
                        <div className="sm:col-span-2">
                          <span className="text-gray-500">Image:</span>{" "}
                          <button onClick={() => { onClose(); onPreviewImage(rec.image); }}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm">
                            <Eye size={14} /> View Image
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">Recorded: {dayjs(rec.created_at).tz(IST).format("DD/MM/YYYY HH:mm")}</div>
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

function getCardColor(nextFollowupDate) {
  const hours = (new Date(nextFollowupDate).getTime() - Date.now()) / 3600000;
  if (hours <= 24) return { bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-500", text: "text-orange-700", label: "Due Soon" };
  if (hours <= 72) return { bg: "bg-yellow-50", border: "border-yellow-300", badge: "bg-yellow-500", text: "text-yellow-700", label: "Upcoming" };
  return { bg: "bg-green-50", border: "border-green-300", badge: "bg-green-500", text: "text-green-700", label: "Scheduled" };
}

export default function UpcomingFollowupsClient({ initialRows, username, userRole }) {
  const [rows, setRows] = useState(initialRows);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [historySerial, setHistorySerial] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const refreshData = async () => {
    // Re-fetch data by reloading (simple approach)
    window.location.reload();
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 flex items-center gap-2">
            <ClipboardList className="text-indigo-500" size={26} />
            Upcoming Follow-ups ({rows.length})
          </h2>
          <Link href="/user-dashboard/service-followups">
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-800 text-white rounded-md transition text-sm">
              View All
            </button>
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-gray-400 text-sm py-3">No upcoming follow-ups scheduled.</p>
        ) : (
          <div className="w-full overflow-x-auto pb-3 hide-scrollbar">
            <div className="flex flex-row gap-4 flex-nowrap min-w-max">
              {rows.map((fu) => {
                const color = getCardColor(fu.next_followup_date);
                return (
                  <div key={fu.id}
                    className={`w-[280px] flex-shrink-0 rounded-2xl border-2 p-4 shadow-sm hover:shadow-md transition duration-300 ${color.bg} ${color.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${color.badge}`}>{color.label}</span>
                      <span className="text-xs text-gray-400 font-medium">#{fu.id}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <PackageSearch size={15} className={color.text} />
                      <span className="text-sm font-bold text-gray-800 truncate">{fu.serial_number}</span>
                    </div>
                    {fu.product_model && <p className="text-xs text-gray-500 mb-2 ml-5 truncate">{fu.product_model}</p>}
                    {fu.contact && (
                      <div className="flex items-center gap-2 mb-2">
                        <Phone size={13} className="text-gray-400" />
                        <span className="text-xs text-gray-600 truncate">{fu.contact}</span>
                      </div>
                    )}
                    {fu.notes && <p className="text-xs text-gray-500 mb-2 line-clamp-2 italic">"{fu.notes}"</p>}
                    <div className="space-y-1 text-xs text-gray-500 mb-3">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays size={12} />
                        <span>Last: {dayjs(fu.followed_at).tz(IST).format("DD MMM YYYY, hh:mm A")}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 font-semibold ${color.text}`}>
                        <CalendarDays size={12} />
                        <span>Next: {dayjs(fu.next_followup_date).tz(IST).format("DD MMM YYYY, hh:mm A")}</span>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <button onClick={() => setFollowUpTarget(fu)}
                        className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                        <Plus size={13} /> Follow Up
                      </button>
                      <button onClick={() => setHistorySerial(fu.serial_number)}
                        className="flex-1 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                        <History size={13} /> History
                      </button>
                      {fu.image && (
                        <button onClick={() => setPreviewImage(fu.image)}
                          className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                          <Eye size={13} /> View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {followUpTarget && (
        <FollowUpModal
          fu={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onSaved={refreshData}
        />
      )}

      {historySerial && (
        <HistoryModal
          serialNumber={historySerial}
          onClose={() => setHistorySerial(null)}
          onPreviewImage={(img) => setPreviewImage(img)}
        />
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative">
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300"><X size={24} /></button>
            <img src={previewImage} alt="preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}