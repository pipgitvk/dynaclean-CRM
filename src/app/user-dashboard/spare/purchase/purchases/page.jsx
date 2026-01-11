"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, Download, Eye, Plus } from "lucide-react";
import { toast } from "react-hot-toast";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function SpareEditTransportModal({ open, onClose, record, onSaved }) {
  const [mode, setMode] = useState(record?.mode_of_transport || "");
  const [form, setForm] = useState({
    self_name: record?.self_name || "",
    courier_tracking_id: record?.courier_tracking_id || "",
    courier_company: record?.courier_company || "",
    porter_tracking_id: record?.porter_tracking_id || "",
    porter_contact: record?.porter_contact || "",
    truck_number: record?.truck_number || "",
    driver_name: record?.driver_name || "",
    driver_number: record?.driver_number || "",
  });
  useEffect(() => {
    setMode(record?.mode_of_transport || "");
    setForm({
      self_name: record?.self_name || "",
      courier_tracking_id: record?.courier_tracking_id || "",
      courier_company: record?.courier_company || "",
      porter_tracking_id: record?.porter_tracking_id || "",
      porter_contact: record?.porter_contact || "",
      truck_number: record?.truck_number || "",
      driver_name: record?.driver_name || "",
      driver_number: record?.driver_number || "",
    });
  }, [record]);
  const [files, setFiles] = useState({ quotation_upload: null, payment_proof_upload: null, invoice_upload: null, eway_bill: null });
  function onFileChange(e, key) { setFiles((f) => ({ ...f, [key]: e.target.files?.[0] || null })); }
  if (!open) return null;
  const disabled = record?.status !== 'requested';
  async function save() {
    try {
      const fd = new FormData();
      fd.append('id', String(record.id));
      fd.append('mode_of_transport', mode);
      if (mode === 'Self') fd.append('self_name', form.self_name);
      if (mode === 'Courier') { fd.append('courier_tracking_id', form.courier_tracking_id); fd.append('courier_company', form.courier_company); }
      if (mode === 'Porter') { fd.append('porter_tracking_id', form.porter_tracking_id); fd.append('porter_contact', form.porter_contact); }
      if (mode === 'Truck') { fd.append('truck_number', form.truck_number); fd.append('driver_name', form.driver_name); fd.append('driver_number', form.driver_number); }
      if (files.quotation_upload) fd.append('quotation_upload', files.quotation_upload);
      if (files.payment_proof_upload) fd.append('payment_proof_upload', files.payment_proof_upload);
      if (files.invoice_upload) fd.append('invoice_upload', files.invoice_upload);
      if (files.eway_bill) fd.append('eway_bill', files.eway_bill);
      const res = await fetch('/api/spare/stock-request', { method: 'PATCH', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed');
      }
      onSaved?.();
      onClose();
      toast.success('Transport updated');
    } catch (e) {
      toast.error(e.message || 'Update failed');
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Edit Transport (Req #{record?.id})</h3>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        {disabled && <p className="text-sm text-red-600 mb-2">Can only edit while status is "requested".</p>}
        <div className="space-y-3">
          <div>
            <label className="block mb-1">Mode of Transport</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full border p-2 rounded" disabled={disabled}>
              <option value="">Select Mode</option>
              <option value="Self">Self</option>
              <option value="Courier">Courier</option>
              <option value="Porter">Porter</option>
              <option value="Truck">Truck</option>
            </select>
          </div>
          {mode === 'Self' && (
            <div>
              <label className="block mb-1">Self Name</label>
              <input className="w-full border p-2 rounded" value={form.self_name} onChange={(e) => setForm({ ...form, self_name: e.target.value })} disabled={disabled} />
            </div>
          )}
          {mode === 'Courier' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1">Tracking ID</label>
                <input className="w-full border p-2 rounded" value={form.courier_tracking_id} onChange={(e) => setForm({ ...form, courier_tracking_id: e.target.value })} disabled={disabled} />
              </div>
              <div>
                <label className="block mb-1">Courier Company</label>
                <input className="w-full border p-2 rounded" value={form.courier_company} onChange={(e) => setForm({ ...form, courier_company: e.target.value })} disabled={disabled} />
              </div>
            </div>
          )}
          {mode === 'Porter' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1">Porter Tracking ID</label>
                <input className="w-full border p-2 rounded" value={form.porter_tracking_id} onChange={(e) => setForm({ ...form, porter_tracking_id: e.target.value })} disabled={disabled} />
              </div>
              <div>
                <label className="block mb-1">Porter Contact</label>
                <input className="w-full border p-2 rounded" value={form.porter_contact} onChange={(e) => setForm({ ...form, porter_contact: e.target.value })} disabled={disabled} />
              </div>
            </div>
          )}
          {mode === 'Truck' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block mb-1">Truck Number</label>
                <input className="w-full border p-2 rounded" value={form.truck_number} onChange={(e) => setForm({ ...form, truck_number: e.target.value })} disabled={disabled} />
              </div>
              <div>
                <label className="block mb-1">Driver Name</label>
                <input className="w-full border p-2 rounded" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} disabled={disabled} />
              </div>
              <div>
                <label className="block mb-1">Driver Number</label>
                <input className="w-full border p-2 rounded" value={form.driver_number} onChange={(e) => setForm({ ...form, driver_number: e.target.value })} disabled={disabled} />
              </div>
            </div>
          )}
          <div className="pt-2 border-t mt-2">
            <h4 className="font-medium mb-2">Files (re-upload to replace)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm">Quotation Upload</label>
                {record?.quotation_upload && (
                  <div className="text-xs text-gray-600 mb-1">
                    Current: <a href={record.quotation_upload} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>
                  </div>
                )}
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => onFileChange(e, 'quotation_upload')} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block mb-1 text-sm">Payment Proof Upload</label>
                {record?.payment_proof_upload && (
                  <div className="text-xs text-gray-600 mb-1">
                    Current: <a href={record.payment_proof_upload} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>
                  </div>
                )}
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => onFileChange(e, 'payment_proof_upload')} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block mb-1 text-sm">Invoice Upload</label>
                {record?.invoice_upload && (
                  <div className="text-xs text-gray-600 mb-1">
                    Current: <a href={record.invoice_upload} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>
                  </div>
                )}
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => onFileChange(e, 'invoice_upload')} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block mb-1 text-sm">E-Way Bill</label>
                {record?.eway_bill && (
                  <div className="text-xs text-gray-600 mb-1">
                    Current: <a href={record.eway_bill} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>
                  </div>
                )}
                <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => onFileChange(e, 'eway_bill')} className="w-full border p-2 rounded" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border">Cancel</button>
          <button onClick={save} disabled={disabled || !mode} className="px-3 py-1.5 rounded bg-green-600 text-white disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function SparePurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/spare/stock-request");
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
      }
    } catch (error) {
      console.error("Error loading purchases:", error);
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    let filtered = purchases;
    if (statusFilter !== "all") filtered = filtered.filter((p) => p.status === statusFilter);
    if (search) {
      filtered = filtered.filter((p) =>
        Object.values(p).some((val) => String(val ?? "").toLowerCase().includes(search.toLowerCase()))
      );
    }
    return filtered;
  }, [purchases, search, statusFilter]);

  const getStatusBadge = (status) => {
    const styles = { requested: "bg-yellow-100 text-yellow-800", in_warehouse: "bg-blue-100 text-blue-800", fulfilled: "bg-green-100 text-green-800" };
    const labels = { requested: "Pending", in_warehouse: "In Warehouse", fulfilled: "Fulfilled" };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>{labels[status] || status}</span>;
  };

  async function exportToXLS() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Spare Purchases");
    worksheet.columns = [
      { header: "Request ID", key: "id", width: 12 },
      { header: "Spare ID", key: "spare_id", width: 10 },
      { header: "Spare Name", key: "spare_name", width: 25 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Price/Unit", key: "price_per_unit", width: 12 },
      { header: "Net Amount", key: "net_amount", width: 12 },
      { header: "From Company", key: "from_company", width: 20 },
      { header: "Mode of Transport", key: "mode_of_transport", width: 15 },
      { header: "Status", key: "status_label", width: 12 },
      { header: "Created By", key: "created_by", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
    ];
    filteredPurchases.forEach((row) => worksheet.addRow({ ...row, status_label: row.status_label || row.status, created_at: new Date(row.created_at).toLocaleString() }));
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "spare_purchases.xlsx"; a.click();
    window.URL.revokeObjectURL(url);
  }

  function exportToPDF() {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["ID", "Spare", "Qty", "Amount", "From Company", "Transport", "Status", "Created"]],
      body: filteredPurchases.map((row) => [row.id, row.spare_name, row.quantity, row.net_amount, row.from_company, row.mode_of_transport, row.status_label || row.status, new Date(row.created_at).toLocaleDateString()]),
      styles: { fontSize: 8 },
    });
    doc.save("spare_purchases.pdf");
  }

  function getFileType(url) {
    if (!url) return null;
    const ext = url.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "unknown";
  }

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">All Spare Purchase Requests</h1>
        <p className="text-gray-600 mt-1">View and manage spare stock purchase requests</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-6">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-64" />
            </div>
            <div className="flex gap-2">
              {[
                ["all", "All", "bg-blue-600"],
                ["requested", "Pending", "bg-yellow-600"],
                ["in_warehouse", "In Warehouse", "bg-blue-600"],
                ["fulfilled", "Fulfilled", "bg-green-600"],
              ].map(([key, label, activeBg]) => (
                <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-1.5 text-sm rounded ${statusFilter === key ? `${activeBg} text-white` : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>{label}</button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setShowExportOptions((p) => !p)} className="bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 flex items-center gap-1 text-sm">
                <Download className="w-4 h-4" /> Export
              </button>
              {showExportOptions && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md z-10">
                  <button onClick={() => { exportToPDF(); setShowExportOptions(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Export as PDF</button>
                  <button onClick={() => { exportToXLS(); setShowExportOptions(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Export as XLS</button>
                </div>
              )}
            </div>
          </div>
          <div className="text-sm text-gray-600">Showing {filteredPurchases.length} of {purchases.length} requests</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{search || statusFilter !== "all" ? "No purchases found matching your filters" : "No purchase requests yet"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3 border-b font-semibold">ID</th>
                  <th className="p-3 border-b font-semibold">Spare ID</th>
                  <th className="p-3 border-b font-semibold">Spare Name</th>
                  <th className="p-3 border-b font-semibold">Qty</th>
                  <th className="p-3 border-b font-semibold">Price/Unit</th>
                  <th className="p-3 border-b font-semibold">Net Amount</th>
                  <th className="p-3 border-b font-semibold">From Company</th>
                  <th className="p-3 border-b font-semibold">Transport</th>
                  <th className="p-3 border-b font-semibold">Status</th>
                  <th className="p-3 border-b font-semibold">Created By</th>
                  <th className="p-3 border-b font-semibold">Created At</th>
                  <th className="p-3 border-b font-semibold">Image</th>
                  <th className="p-3 border-b font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">#{purchase.id}</td>
                    <td className="p-3 font-medium">{purchase.spare_id}</td>
                    <td className="p-3">{purchase.spare_name}</td>
                    <td className="p-3">{purchase.quantity}</td>
                    <td className="p-3">₹{Number(purchase.price_per_unit || 0).toFixed(2)}</td>
                    <td className="p-3 font-semibold">₹{Number(purchase.net_amount || 0).toFixed(2)}</td>
                    <td className="p-3">{purchase.from_company || "—"}</td>
                    <td className="p-3">{purchase.mode_of_transport || "—"}</td>
                    <td className="p-3">{getStatusBadge(purchase.status)}</td>
                    <td className="p-3">{purchase.created_by}</td>
                    <td className="p-3">{new Date(purchase.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-center">
                      {purchase.spare_image ? (
                        <button onClick={() => setPreviewImage({ url: purchase.spare_image, type: getFileType(purchase.spare_image) })} className="text-gray-600 hover:text-blue-700">
                          <Eye className="w-5 h-5 inline" />
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button onClick={() => setDetailPurchase(purchase)} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Eye className="w-4 h-4" /> View
                      </button>
                    </td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => { setEditRecord(purchase); setEditOpen(true); }}
                        disabled={purchase.status !== 'requested'}
                        className={`${purchase.status !== 'requested' ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 hover:underline'} text-sm`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Transport Modal */}
      <SpareEditTransportModal open={editOpen} onClose={() => setEditOpen(false)} record={editRecord} onSaved={loadPurchases} />

      {detailPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60" onClick={() => setDetailPurchase(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Request #{detailPurchase.id} Details</h3>
              <button className="text-gray-500" onClick={() => setDetailPurchase(null)}>✕</button>
            </div>
            <div className="p-4">
              {(() => {
                const stages = ["requested", "in_warehouse", "fulfilled"]; const idx = Math.max(0, stages.indexOf(detailPurchase.status)); const percent = ((idx + 1) / stages.length) * 100; return (
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1"><span>Requested</span><span>In Warehouse</span><span>Fulfilled</span></div>
                    <div className="w-full h-2 rounded bg-gray-200"><div className={`h-2 rounded ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-blue-500' : 'bg-green-600'}`} style={{ width: percent + '%' }} /></div>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["Spare ID", detailPurchase.spare_id],
                ["Spare Name", detailPurchase.spare_name],
                ["Quantity", detailPurchase.quantity],
                ["Price/Unit", `₹${Number(detailPurchase.price_per_unit || 0).toFixed(2)}`],
                ["Amount/Unit", detailPurchase.amount_per_unit],
                ["Net Amount", `₹${Number(detailPurchase.net_amount || 0).toFixed(2)}`],
                ["Tax Rate", detailPurchase.tax],
                ["GST Toggle", detailPurchase.gst_toggle],
                ["Tax Amount", detailPurchase.tax_amount],
                ["From Company", detailPurchase.from_company],
                ["From Address", detailPurchase.from_address],
                ["Contact", detailPurchase.contact],
                ["Delivery Location", detailPurchase.delivery_location],
                ["Transport", detailPurchase.mode_of_transport],
                ["Self Name", detailPurchase.self_name],
                ["Courier Tracking ID", detailPurchase.courier_tracking_id],
                ["Courier Company", detailPurchase.courier_company],
                ["Porter Tracking ID", detailPurchase.porter_tracking_id],
                ["Porter Contact", detailPurchase.porter_contact],
                ["Truck Number", detailPurchase.truck_number],
                ["Driver Name", detailPurchase.driver_name],
                ["Driver Number", detailPurchase.driver_number],
                ["Warehouse Name", detailPurchase.warehouse_name],
                ["Received Quantity", detailPurchase.received_quantity],
                ["Received Date", detailPurchase.received_date ? new Date(detailPurchase.received_date).toLocaleString() : ''],
                ["Status", detailPurchase.status],
                ["Created By", detailPurchase.created_by],
                ["Created At", new Date(detailPurchase.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="border rounded p-3">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-sm">{value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Files */}
            <div className="p-4">
              <h4 className="font-semibold mb-2">Files</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  ["Quotation", detailPurchase.quotation_upload],
                  ["Payment Proof", detailPurchase.payment_proof_upload],
                  ["Invoice", detailPurchase.invoice_upload],
                  ["Spare Image", detailPurchase.spare_image],
                  ["E-Way Bill", detailPurchase.eway_bill],
                  ["Received Image", detailPurchase.received_image],
                  ["Supporting Doc", detailPurchase.supporting_doc],
                ]
                  .filter(([, url]) => !!url)
                  .map(([label, url]) => (
                    <div key={label} className="border rounded p-3">
                      <div className="text-xs text-gray-500 mb-2">{label}</div>
                      {(() => {
                        const ext = String(url).split('.').pop().toLowerCase();
                        const isImg = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                        const isPdf = ext === 'pdf';
                        if (isImg) return <img src={url} alt={label} className="w-full h-40 object-cover rounded" />;
                        if (isPdf) return <iframe src={url} title={label} className="w-full h-40" />;
                        return (
                          <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">
                            {url}
                          </a>
                        );
                      })()}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60" onClick={() => setPreviewImage(null)}>
          <div className="bg-white p-4 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2"><h4 className="font-semibold">Preview</h4><button onClick={() => setPreviewImage(null)}>✕</button></div>
            {(() => { const type = getFileType(previewImage.url); return type === "image" ? <img src={previewImage.url} alt="Preview" className="max-h-[70vh] object-contain mx-auto" /> : type === "pdf" ? <iframe src={previewImage.url} title="PDF Preview" className="w-full h-[70vh]" /> : <p className="text-red-500 text-center mt-4">Cannot preview this file type.</p>; })()}
          </div>
        </div>
      )}
    </div>
  );
}
