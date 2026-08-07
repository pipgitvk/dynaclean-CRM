"use client";
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast, Toaster } from "react-hot-toast";

// ─── Modal Wrapper ────────────────────────────────────────────────────────────
function ModalWrapper({ title, onClose, children }) {
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Install Modal ────────────────────────────────────────────────────────────
function InstallModal({ serialNumber, onClose, onSuccess }) {
  const [form, setForm] = useState({
    serial_number: serialNumber,
    service_type: "INSTALLATION",
    installation_address: "",
    site_person: "",
    site_email: "",
    site_contact: "",
    status: "PENDING",
    username: "",
  });
  const [repList, setRepList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reps")
      .then((r) => r.json())
      .then((d) => setRepList(d.users || []))
      .catch(() => setRepList([]));
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Installation request submitted successfully!");
        onSuccess();
      } else {
        toast.error(data.message || "Failed to submit request");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper title="Add New Installation Request" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="serial_number" value={form.serial_number} />
        <div>
          <label className="block font-semibold text-sm mb-1">Service Type</label>
          <select name="service_type" value={form.service_type} onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2" disabled>
            <option value="INSTALLATION">INSTALLATION</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold text-sm mb-1">Installation Address</label>
          <input type="text" name="installation_address" value={form.installation_address}
            onChange={handleChange} placeholder="Enter complete address" required
            className="w-full border border-gray-300 rounded px-3 py-2" />
        </div>
        <div>
          <label className="block font-semibold text-sm mb-1">Site Person Name</label>
          <input type="text" name="site_person" value={form.site_person}
            onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2" />
        </div>
        <div>
          <label className="block font-semibold text-sm mb-1">Site Person Email</label>
          <input type="email" name="site_email" value={form.site_email}
            onChange={handleChange} required className="w-full border border-gray-300 rounded px-3 py-2" />
        </div>
        <div>
          <label className="block font-semibold text-sm mb-1">Site Person Contact</label>
          <input type="tel" name="site_contact" value={form.site_contact}
            onChange={handleChange} required pattern="[0-9+ -]{7,15}"
            title="Please enter a valid contact number"
            className="w-full border border-gray-300 rounded px-3 py-2" />
        </div>
        <div>
          <label className="block font-semibold text-sm mb-1">Assign to User</label>
          <select name="username" value={form.username} onChange={handleChange} required
            className="w-full border border-gray-300 rounded px-3 py-2">
            <option value="">-- Select User --</option>
            {repList.map((rep) => (
              <option key={rep.username} value={rep.username}>{rep.username}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded">
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </ModalWrapper>
  );
}

// ─── Complaint Modal ──────────────────────────────────────────────────────────
function ComplaintModal({ serialNumber, onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm({
    defaultValues: {
      serial_number: serialNumber,
      service_type: "COMPLAINT",
      complaint_date: new Date().toISOString().split("T")[0],
      complaint_summary: "",
      status: "PENDING",
      assigned_to: "NOT ASSIGNED",
      attachments: null,
    },
  });
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValue("serial_number", serialNumber);
    fetch("/api/complaints")
      .then((r) => r.json())
      .then((d) => setUsers(d))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, [serialNumber, setValue]);

  const onSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData();
    for (const key in data) {
      if (key === "attachments" && data[key]?.length > 0) {
        for (let i = 0; i < data[key].length; i++) formData.append("attachments", data[key][i]);
      } else {
        formData.append(key, data[key]);
      }
    }
    try {
      const res = await fetch("/api/complaints", { method: "POST", body: formData });
      if (res.ok) {
        toast.success("Complaint added successfully!");
        reset();
        onSuccess();
      } else {
        const err = await res.json();
        toast.error(`Error: ${err.error || "Failed to add complaint."}`);
        setIsSubmitting(false);
      }
    } catch {
      toast.error("An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <ModalWrapper title="ADD NEW COMPLAINT" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register("serial_number")} />
        <input type="hidden" {...register("status")} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
          <select {...register("service_type")} className="w-full border border-gray-300 rounded px-3 py-2">
            <option value="COMPLAINT">COMPLAINT</option>
            <option value="PREVENTIVE MAINTENANCE">PREVENTIVE MAINTENANCE</option>
            <option value="TRAINING">TRAINING</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Complaint Date</label>
          <input type="date" {...register("complaint_date", { required: "Complaint Date is required" })}
            className="w-full border border-gray-300 rounded px-3 py-2" />
          {errors.complaint_date && <p className="text-sm text-red-600 mt-1">{errors.complaint_date.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Complaint Summary</label>
          <textarea rows={4} {...register("complaint_summary", { required: "Complaint summary is required" })}
            className="w-full border border-gray-300 rounded px-3 py-2 resize-y" />
          {errors.complaint_summary && <p className="text-sm text-red-600 mt-1">{errors.complaint_summary.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign to User</label>
          <select {...register("assigned_to")} className="w-full border border-gray-300 rounded px-3 py-2" disabled={loadingUsers}>
            {loadingUsers ? <option>Loading users...</option> : (
              <>
                <option value="NOT ASSIGNED">NOT ASSIGNED</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attach images (Optional)</label>
          <input type="file" {...register("attachments")} multiple
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded disabled:opacity-50">
          {isSubmitting ? "Submitting..." : "Submit Complaint"}
        </button>
      </form>
    </ModalWrapper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WarrantyPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(50);
  const [modelFilter, setModelFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [modal, setModal] = useState(null); // { type: "install"|"complaint", serial: string }

  const fetchProducts = useCallback(
    async (page, search = "") => {
      setLoading(true);
      try {
        const url = `/api/warranty/all?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&model=${encodeURIComponent(modelFilter)}&state=${encodeURIComponent(stateFilter)}`;
        const res = await fetch(url);
        const data = await res.json();
        setProducts(data.products || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setCurrentPage(data.currentPage || 1);
      } catch (error) {
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, modelFilter, stateFilter]
  );

  useEffect(() => {
    fetchProducts(currentPage, searchQuery);
  }, [currentPage, fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchProducts(1, searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, modelFilter, stateFilter, fetchProducts]);

  function closeModal() { setModal(null); }
  function handleModalSuccess() {
    setModal(null);
    fetchProducts(currentPage, searchQuery);
  }

  const SkeletonRow = () => (
    <tr className="odd:bg-white even:bg-gray-50 animate-pulse">
      {Array.from({ length: 12 }).map((_, i) => (
        <td key={i} className="p-3 border-b border-gray-200">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        </td>
      ))}
    </tr>
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const getWarrantyStatus = (installDate, warrantyMonths) => {
    if (!installDate || !warrantyMonths) return { status: "—", color: "text-gray-400" };
    try {
      const install = new Date(installDate);
      const expiry = new Date(install);
      expiry.setMonth(expiry.getMonth() + parseInt(warrantyMonths));
      return new Date() <= expiry
        ? { status: "In Warranty", color: "text-green-600 font-semibold" }
        : { status: "Out of Warranty", color: "text-red-600 font-semibold" };
    } catch {
      return { status: "—", color: "text-gray-400" };
    }
  };

  const TABLE_HEADERS = [
    "Product / Model", "Spec", "Serial", "Warranty", "State", "AMC",
    "Company", "Installation", "Site", "Invoice", "Reports", "Actions",
  ];

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) startPage = Math.max(1, endPage - maxVisiblePages + 1);
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button key={i} onClick={() => handlePageChange(i)}
          className={`px-3 py-1 mx-1 rounded ${currentPage === i ? "bg-blue-600 text-white font-semibold" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>
          {i}
        </button>
      );
    }
    return (
      <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
        <div className="text-sm text-gray-600">
          Showing {products.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, total)} of {total} records
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">First</button>
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">Prev</button>
          {pages}
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">Next</button>
          <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">Last</button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full p-6 overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />

      {modal?.type === "install" && (
        <InstallModal serialNumber={modal.serial} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}
      {modal?.type === "complaint" && (
        <ComplaintModal serialNumber={modal.serial} onClose={closeModal} onSuccess={handleModalSuccess} />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Warranty Records</h2>
        <div className="text-sm text-gray-600">Total: {total} products</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" placeholder="Search by product, serial, customer, invoice, installation address..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="text" placeholder="Filter by model" value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full md:w-1/4 px-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="text" placeholder="Filter by state" value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-full md:w-1/4 px-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex flex-col w-full">
        {/* Mobile card layout */}
        <div className="md:hidden space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="border rounded-lg bg-white p-3 shadow-sm animate-pulse h-24" />
            ))
          ) : products.length > 0 ? (
            products.map((r, i) => (
              <div key={i} className="border rounded-lg bg-white p-3 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold text-sm">{r.product_name}</div>
                    <div className="text-[11px] text-gray-600">{r.model} · {r.serial_number}</div>
                  </div>
                  <div className={`text-[11px] text-right ${getWarrantyStatus(r.installation_date, r.warranty_period).color}`}>
                    {getWarrantyStatus(r.installation_date, r.warranty_period).status}
                  </div>
                </div>
                <div className="pt-2 flex flex-wrap gap-1">
                  {!r.installed_address && (
                    <button onClick={() => setModal({ type: "install", serial: r.serial_number })}
                      className="bg-green-500 hover:bg-green-600 text-white text-[11px] py-1 px-2 rounded-md">
                      Install
                    </button>
                  )}
                  <button onClick={() => setModal({ type: "complaint", serial: r.serial_number })}
                    className="bg-red-500 hover:bg-red-600 text-white text-[11px] py-1 px-2 rounded-md">
                    Complaint
                  </button>
                  <a href={`/admin-dashboard/warranty/service-records/${r.serial_number}`}
                    className="text-center bg-blue-500 hover:bg-blue-600 text-white text-[11px] py-1 px-2 rounded-md">
                    History
                  </a>
                  <a href={`/admin-dashboard/warranty/edit/${r.serial_number}`}
                    className="text-center bg-yellow-500 hover:bg-yellow-600 text-white text-[11px] py-1 px-2 rounded-md">
                    Edit
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-4 text-gray-500 border rounded bg-white">No matching records found.</div>
          )}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block flex-grow overflow-hidden w-full">
          <div className="h-full w-full overflow-x-auto overflow-y-auto rounded border shadow bg-white">
            <table className="w-full text-sm text-left border-collapse table-auto">
              <thead className="bg-gray-800 text-white sticky top-0 z-10 shadow-md">
                <tr>
                  {TABLE_HEADERS.map((header) => (
                    <th key={header}
                      className={`p-3 border-b border-gray-700 text-nowrap ${header === "Spec" ? "min-w-[200px] resize-x overflow-hidden" : ""}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: pageSize }).map((_, idx) => <SkeletonRow key={idx} />)
                ) : products.length > 0 ? (
                  products.map((r, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors duration-150 ease-in-out">
                      <td className="p-3 border-b border-gray-200">
                        <div className="font-semibold">{r.product_name}</div>
                        {r.model && <div className="text-xs text-gray-600">Model: {r.model}</div>}
                      </td>
                      <td className="p-3 border-b border-gray-200 relative group max-w-[200px]">
                        <div className="line-clamp-2 text-xs whitespace-pre-wrap group-hover:line-clamp-none group-hover:absolute group-hover:bg-white group-hover:border group-hover:border-gray-300 group-hover:shadow-lg group-hover:z-20 group-hover:p-3 group-hover:rounded group-hover:max-w-md group-hover:left-0 group-hover:top-0">
                          {r.specification}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200">{r.serial_number}</td>
                      <td className={`p-3 border-b border-gray-200 ${getWarrantyStatus(r.installation_date, r.warranty_period).color}`}>
                        {getWarrantyStatus(r.installation_date, r.warranty_period).status}
                      </td>
                      <td className="p-3 border-b border-gray-200">{r.state || "—"}</td>
                      <td className="p-3 border-b border-gray-200 text-center">
                        {r.has_amc
                          ? <div className="flex justify-center"><CheckCircle size={20} className="text-green-600" title="AMC/CMC Active" /></div>
                          : <div className="flex justify-center"><AlertTriangle size={20} className="text-yellow-500" title="No AMC/CMC" /></div>}
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        <div className="space-y-1 text-xs">
                          <div><span className="font-semibold">Name:</span> {r.customer_name}</div>
                          <div><span className="font-semibold">Email:</span> {r.email}</div>
                          <div><span className="font-semibold">Person:</span> {r.contact_person}</div>
                          <div><span className="font-semibold">Contact:</span> {r.contact}</div>
                          {r.customer_address && <div><span className="font-semibold">Address:</span> {r.customer_address}</div>}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 hidden md:table-cell">
                        <div className="space-y-1 text-xs">
                          {r.installed_address ? (
                            <>
                              <div><span className="font-semibold">Address:</span> {r.installed_address}</div>
                              {r.installation_date && <div><span className="font-semibold">Date:</span> {r.installation_date}</div>}
                              {r.lat && <div><span className="font-semibold">Lat:</span> {r.lat}</div>}
                              {r.longt && <div><span className="font-semibold">Long:</span> {r.longt}</div>}
                            </>
                          ) : <div className="text-gray-400">Not installed</div>}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 hidden md:table-cell">
                        <div className="space-y-1 text-xs">
                          {r.site_person && <div><span className="font-semibold">Person:</span> {r.site_person}</div>}
                          {r.site_contact && <div><span className="font-semibold">Contact:</span> {r.site_contact}</div>}
                          {r.site_email && <div><span className="font-semibold">Email:</span> {r.site_email}</div>}
                          {!r.site_person && !r.site_contact && !r.site_email && <div className="text-gray-400">---</div>}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 hidden md:table-cell">
                        <div className="space-y-1 text-xs">
                          <div><span className="font-semibold">#:</span> {r.invoice_number}</div>
                          <div><span className="font-semibold">Date:</span> {r.invoice_date}</div>
                          {r.invoice_file && (
                            <a href={`/uploads/${r.invoice_file}`} target="_blank"
                              className="text-blue-600 hover:text-blue-800 underline transition-colors duration-150">
                              View File
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 space-y-1">
                        {r.report_file ? (
                          r.report_file.split(",").map((f, idx) => (
                            <div key={idx}>
                              <a href={`/uploads/${f}`} target="_blank"
                                className="text-blue-600 hover:text-blue-800 underline transition-colors duration-150">
                                Report {idx + 1}
                              </a>
                            </div>
                          ))
                        ) : <div className="text-gray-400">---</div>}
                      </td>
                      <td className="p-3 border-b border-gray-200 space-y-1">
                        {!r.installed_address && (
                          <button onClick={() => setModal({ type: "install", serial: r.serial_number })}
                            className="block w-full text-center bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-md mb-1">
                            Install
                          </button>
                        )}
                        <button onClick={() => setModal({ type: "complaint", serial: r.serial_number })}
                          className="block w-full text-center bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-md mb-1">
                          Complaint
                        </button>
                        <a href={`/admin-dashboard/warranty/service-records/${r.serial_number}`}
                          className="block text-center bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded-md mb-1">
                          History
                        </a>
                        <a href={`/admin-dashboard/warranty/edit/${r.serial_number}`}
                          className="block text-center bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1 px-2 rounded-md">
                          Edit
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="text-center p-4 text-gray-500">No matching records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && products.length > 0 && renderPagination()}
      </div>
    </div>
  );
}
