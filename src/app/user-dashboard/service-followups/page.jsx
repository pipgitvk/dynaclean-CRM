"use client";
import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Search, Plus, X, Eye, ClipboardList, History } from "lucide-react";
import toast from "react-hot-toast";

dayjs.extend(utc);
dayjs.extend(timezone);
const IST = "Asia/Kolkata";

/* ── helpers ─────────────────────────────────────────── */
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

/* ── FollowUpModal ────────────────────────────────────── */
function FollowUpModal({ fu, onClose, onSaved }) {
  const nowIST   = getISTNow();
  const minDT    = toLocalDT(new Date(nowIST.getTime() - 24 * 3600 * 1000));
  const maxDT    = toLocalDT(new Date(nowIST.getTime() - 60 * 1000));

  const [serialSearch, setSerialSearch]       = useState(fu.serial_number || "");
  const [suggestions, setSuggestions]         = useState([]);
  const [showSugg, setShowSugg]               = useState(false);
  const [form, setForm]                       = useState({
    serial_number:     fu.serial_number  || "",
    product_model:     fu.product_model  || "",
    contact:           fu.contact        || "",
    followed_at:       maxDT,
    notes:             "",
    next_followup_date:"",
    image:             null,
  });
  const [submitting, setSubmitting] = useState(false);

  /* serial autocomplete */
  useEffect(() => {
    if (serialSearch.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    const t = setTimeout(async () => {
      const res  = await fetch("/api/machines-followup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: serialSearch }) });
      const data = await res.json();
      if (data.success) { setSuggestions(data.products || []); setShowSugg(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [serialSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData();
    fd.append("serial_number",      form.serial_number);
    fd.append("product_model",      form.product_model);
    fd.append("contact",            form.contact);
    fd.append("followed_at",        form.followed_at);
    fd.append("notes",              form.notes);
    fd.append("next_followup_date", form.next_followup_date);
    if (form.image) fd.append("image", form.image);
    try {
      const res  = await fetch("/api/machines-followup", { method: "POST", body: fd });
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
          {/* serial number - non-editable in follow-up modal since it's already set */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
            <input type="text" value={form.serial_number} readOnly disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Model</label>
            <input type="text" value={form.product_model} readOnly disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input type="text" value={form.contact} readOnly disabled placeholder="Email or phone"
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
function HistoryModal({ serialNumber, onClose, onPreviewImage }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/machines-followup?serial=${encodeURIComponent(serialNumber)}`);
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
              {[1,2,3].map(i => (
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
                      {rec.contact     && <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{rec.contact}</span></div>}
                      {rec.product_model && <div><span className="text-gray-500">Model:</span> <span className="font-medium">{rec.product_model}</span></div>}
                      {rec.notes       && <div className="sm:col-span-2"><span className="text-gray-500">Notes:</span> <span className="font-medium">{rec.notes}</span></div>}
                      {rec.image       && (
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

/* ── Main Page ────────────────────────────────────────── */
export default function ServiceFollowupsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [followups, setFollowups]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [pageSize]                    = useState(50);

  const [addModalOpen, setAddModalOpen]   = useState(false);  // top "Add Follow-up"
  const [followUpTarget, setFollowUpTarget] = useState(null); // per-row Follow Up
  const [historySerial, setHistorySerial]   = useState(null); // per-row History
  const [previewImage, setPreviewImage]     = useState(null); // image preview

  const fetchFollowups = useCallback(async (page, search = "") => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/machines-followup?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&latest_only=1`);
      const data = await res.json();
      if (data.success) {
        setFollowups(data.followups || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
      } else toast.error(data.error || "Failed to fetch");
    } catch { toast.error("Failed to fetch follow-ups"); }
    finally { setLoading(false); }
  }, [pageSize]);

  useEffect(() => { fetchFollowups(currentPage, searchQuery); }, [currentPage, fetchFollowups]);
  useEffect(() => {
    const t = setTimeout(() => { setCurrentPage(1); fetchFollowups(1, searchQuery); }, 500);
    return () => clearTimeout(t);
  }, [searchQuery, fetchFollowups]);

  /* ── blank form helpers (for top-level Add modal) ── */
  const nowIST     = getISTNow();
  const [addMin]   = useState(toLocalDT(new Date(nowIST.getTime() - 24 * 3600 * 1000)));
  const [addMax]   = useState(toLocalDT(new Date(nowIST.getTime() - 60 * 1000)));
  const [addForm, setAddForm] = useState({
    serial_number: "", product_model: "", contact: "",
    followed_at: toLocalDT(new Date(nowIST.getTime() - 60 * 1000)),
    notes: "", next_followup_date: "", image: null,
  });
  const [addSerialSearch, setAddSerialSearch]   = useState("");
  const [addSuggestions, setAddSuggestions]     = useState([]);
  const [addShowSugg, setAddShowSugg]           = useState(false);
  const [addSubmitting, setAddSubmitting]       = useState(false);

  useEffect(() => {
    if (addSerialSearch.length < 2) { setAddSuggestions([]); setAddShowSugg(false); return; }
    const t = setTimeout(async () => {
      const res  = await fetch("/api/machines-followup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search: addSerialSearch }) });
      const data = await res.json();
      if (data.success) { setAddSuggestions(data.products || []); setAddShowSugg(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [addSerialSearch]);

  const handleAddSubmit = async (e) => {
    e.preventDefault(); setAddSubmitting(true);
    const fd = new FormData();
    fd.append("serial_number", addForm.serial_number);
    fd.append("product_model", addForm.product_model);
    fd.append("contact",       addForm.contact);
    fd.append("followed_at",   addForm.followed_at);
    fd.append("notes",         addForm.notes);
    fd.append("next_followup_date", addForm.next_followup_date);
    if (addForm.image) fd.append("image", addForm.image);
    try {
      const res  = await fetch("/api/machines-followup", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) { toast.success("Follow-up added!"); setAddModalOpen(false); fetchFollowups(currentPage, searchQuery); }
      else toast.error(data.error || "Something went wrong");
    } catch { toast.error("Submission failed"); }
    finally { setAddSubmitting(false); }
  };

  const SkeletonRow = () => (
    <tr className="odd:bg-white even:bg-gray-50 animate-pulse">
      {Array(9).fill(0).map((_, i) => (
        <td key={i} className="p-3 border-b border-gray-200"><div className="h-4 bg-gray-300 rounded w-24"></div></td>
      ))}
    </tr>
  );

  return (
    <div className="w-full max-w-full p-6 overflow-hidden">
      {/* page header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Service Follow-ups</h2>
        <button onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
          <Plus size={18} /> Add Follow-up
        </button>
      </div>

      {/* search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by serial, model, contact, notes…"
          className="w-full pl-10 pr-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* table */}
      <div className="hidden md:block w-full overflow-x-auto rounded border shadow bg-white">
        <table className="w-full text-sm text-left border-collapse table-auto">
          <thead className="bg-gray-800 text-white sticky top-0 z-10">
            <tr>
              {["ID","Serial Number","Product Model","Contact","Followed At","Next Follow-up","Added By","Image","Action"].map(h => (
                <th key={h} className="p-3 border-b border-gray-700 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : followups.length > 0
                ? followups.map((fu, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors">
                      <td className="p-3 border-b border-gray-200 font-medium">{fu.id}</td>
                      <td className="p-3 border-b border-gray-200">{fu.serial_number}</td>
                      <td className="p-3 border-b border-gray-200">{fu.product_model || "—"}</td>
                      <td className="p-3 border-b border-gray-200">{fu.contact || "—"}</td>
                      <td className="p-3 border-b border-gray-200 whitespace-nowrap">{dayjs(fu.followed_at).tz(IST).format("DD/MM/YYYY HH:mm")}</td>
                      <td className="p-3 border-b border-gray-200 whitespace-nowrap">{fu.next_followup_date ? dayjs(fu.next_followup_date).tz(IST).format("DD/MM/YYYY HH:mm") : "—"}</td>
                      <td className="p-3 border-b border-gray-200">{fu.added_by}</td>
                      <td className="p-3 border-b border-gray-200">
                        {fu.image
                          ? <button onClick={() => setPreviewImage(fu.image)} className="flex items-center gap-1 text-blue-600 hover:text-blue-800"><Eye size={15} /> View</button>
                          : "—"}
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => setFollowUpTarget(fu)}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                            <ClipboardList size={13} /> Follow Up
                          </button>
                          <button onClick={() => setHistorySerial(fu.serial_number)}
                            className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs whitespace-nowrap">
                            <History size={13} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : (
                  <tr><td colSpan={9} className="text-center p-6 text-gray-400">No follow-ups found</td></tr>
                )
            }
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">Prev</button>
          <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">Next</button>
        </div>
      )}

      {/* ── Top-level Add Follow-up Modal ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Add Service Follow-up</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1 rounded-full hover:bg-gray-200"><X size={22} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                <input type="text" value={addSerialSearch} required
                  onChange={(e) => { setAddSerialSearch(e.target.value); setAddForm(p => ({ ...p, serial_number: e.target.value })); }}
                  placeholder="Search serial number..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {addShowSugg && addSuggestions.length > 0 && (
                  <div className="absolute z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {addSuggestions.map((p, i) => (
                      <div key={i} className="p-2 hover:bg-gray-100 cursor-pointer" onClick={() => {
                        setAddSerialSearch(p.serial_number);
                        setAddForm(prev => ({ ...prev, serial_number: p.serial_number, product_model: p.model, contact: p.contact || p.email || "" }));
                        setAddShowSugg(false);
                      }}>
                        <div className="font-medium">{p.serial_number}</div>
                        <div className="text-sm text-gray-500">{p.model} — {p.product_name}</div>
                        {(p.contact || p.email) && <div className="text-xs text-gray-400">{p.contact || p.email}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {[["Product Model","product_model","text"],["Contact","contact","text"]].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={addForm[key]} readOnly disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Followed At (within last 24h) *</label>
                <input type="datetime-local" value={addForm.followed_at} min={addMin} max={addMax} required
                  onChange={(e) => setAddForm(p => ({ ...p, followed_at: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3} value={addForm.notes} onChange={(e) => setAddForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date *</label>
                <input type="datetime-local" value={addForm.next_followup_date} required
                  onChange={(e) => setAddForm(p => ({ ...p, next_followup_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
                <input type="file" accept="image/*" onChange={(e) => setAddForm(p => ({ ...p, image: e.target.files[0] || null }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={addSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors">
                  {addSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Per-row Follow Up Modal ── */}
      {followUpTarget && (
        <FollowUpModal
          fu={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onSaved={() => fetchFollowups(currentPage, searchQuery)}
        />
      )}

      {/* ── History Modal ── */}
      {historySerial && (
        <HistoryModal
          serialNumber={historySerial}
          onClose={() => setHistorySerial(null)}
          onPreviewImage={(img) => setPreviewImage(img)}
        />
      )}

      {/* ── Image Preview ── */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative">
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300"><X size={24} /></button>
            <img src={previewImage} alt="preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
