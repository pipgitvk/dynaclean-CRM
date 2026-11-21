"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Toaster } from "react-hot-toast";
import SpareOnSiteInstallModal from "@/components/warranty/SpareOnSiteInstallModal";

const INSTALLED_BY_LABELS = {
  videocall: "On videocall",
  self_customer: "On self customer",
  on_site: "On site",
};

const TABLE_HEADERS = [
  "Product / Model",
  "Serial",
  "State",
  "Order",
  "Company",
  "Registration",
  "Installed by",
  "Site",
  "Invoice",
  "Actions",
];

function SkeletonRow() {
  return (
    <tr className="animate-pulse odd:bg-white even:bg-gray-50">
      {TABLE_HEADERS.map((h) => (
        <td key={h} className="border-b border-gray-200 p-3">
          <div className="h-4 w-3/4 rounded bg-gray-300" />
        </td>
      ))}
    </tr>
  );
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return String(value);
  }
}

function warrantyCell(row) {
  if (Number(row.warranty_registered) === 1) {
    return (
      <span className="font-semibold text-green-600">Registered</span>
    );
  }
  return <span className="font-semibold text-red-600">Not registered</span>;
}

function canOnSiteInstall(row) {
  return (
    String(row.installed_by || "").trim() === "on_site" &&
    Number(row.warranty_registered) === 1 &&
    !row.install_request_id
  );
}

function installedByCell(row) {
  const raw = String(row.installed_by || "").trim();
  if (!raw) return <span className="text-gray-400">—</span>;
  return (
    <span className="text-gray-900">
      {INSTALLED_BY_LABELS[raw] || raw.replace(/_/g, " ")}
    </span>
  );
}

export default function RegisteredSparesClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("all");
  const [serialFilter, setSerialFilter] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [installSpare, setInstallSpare] = useState(null);
  const pageSize = 50;

  const loadOnce = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/warranty/registered-spares?all=1", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchError(data.error || `Load failed (${res.status})`);
        setAllRows([]);
        return;
      }
      setAllRows(data.items || []);
    } catch (error) {
      console.error("Registered spares load:", error);
      setFetchError("Could not load registered_spares. Try refreshing.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOnce();
  }, [loadOnce]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, modelFilter, stateFilter, registrationFilter, serialFilter]);

  const serialStats = useMemo(() => {
    let missingSerial = 0;
    for (const r of allRows) {
      if (!String(r.serial_number || "").trim()) missingSerial += 1;
    }
    return { total: allRows.length, missingSerial };
  }, [allRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const modelQ = modelFilter.trim().toLowerCase();
    const stateQ = stateFilter.trim().toLowerCase();

    return allRows.filter((row) => {
      if (registrationFilter === "registered" && Number(row.warranty_registered) !== 1) {
        return false;
      }
      if (registrationFilter === "unregistered" && Number(row.warranty_registered) === 1) {
        return false;
      }
      const serial = String(row.serial_number || "").trim();
      if (serialFilter === "with" && !serial) return false;
      if (serialFilter === "without" && serial) return false;

      const code = String(row.spare_item_code || row.model || "").toLowerCase();
      if (modelQ && !code.includes(modelQ)) return false;

      const st = String(row.state || "").toLowerCase();
      if (stateQ && !st.includes(stateQ)) return false;

      if (!q) return true;
      const hay = [
        row.product_name,
        row.spare_item_name,
        row.model,
        row.spare_item_code,
        row.serial_number,
        row.customer_name,
        row.order_id,
        row.quote_number,
        row.invoice_number,
        row.contact,
        row.email,
        row.customer_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    allRows,
    searchQuery,
    modelFilter,
    stateFilter,
    registrationFilter,
    serialFilter,
  ]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          type="button"
          onClick={() => handlePageChange(i)}
          className={`mx-1 rounded px-3 py-1 ${
            currentPage === i
              ? "bg-blue-600 font-semibold text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {i}
        </button>,
      );
    }
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          Showing {total > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, total)} of {total} records
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300 disabled:opacity-50"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300 disabled:opacity-50"
          >
            Prev
          </button>
          {pages}
          <button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300 disabled:opacity-50"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300 disabled:opacity-50"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full overflow-hidden p-6">
      <Toaster position="top-center" />
      {installSpare ? (
        <SpareOnSiteInstallModal
          spare={installSpare}
          onClose={() => setInstallSpare(null)}
          onSuccess={loadOnce}
        />
      ) : null}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Registered Spares</h2>
        <div className="text-right text-sm text-gray-600">
          <div>Total: {serialStats.total} spares</div>
          <div
            className={
              serialStats.missingSerial > 0
                ? "font-semibold text-red-600"
                : "text-green-600"
            }
          >
            Without serial: {serialStats.missingSerial}
          </div>
        </div>
      </div>

      {fetchError ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {fetchError}{" "}
          <button
            type="button"
            onClick={loadOnce}
            className="font-semibold underline"
          >
            Retry
          </button>
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search by product, serial, customer, invoice, installation address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded border px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-1/3"
        />
        <input
          type="text"
          placeholder="Filter by model"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full rounded border px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-1/4"
        />
        <input
          type="text"
          placeholder="Filter by state"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-full rounded border px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-1/4"
        />
        <select
          value={registrationFilter}
          onChange={(e) => setRegistrationFilter(e.target.value)}
          className="w-full rounded border px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-auto"
        >
          <option value="all">All</option>
          <option value="registered">Warranty registered</option>
          <option value="unregistered">Not registered yet</option>
        </select>
        <select
          value={serialFilter}
          onChange={(e) => setSerialFilter(e.target.value)}
          className="w-full rounded border px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-auto"
        >
          <option value="">All serials</option>
          <option value="with">With serial number</option>
          <option value="without">Without serial number</option>
        </select>
      </div>

      <div className="hidden w-full flex-grow overflow-hidden md:block">
        <div className="h-full w-full overflow-x-auto overflow-y-auto rounded border bg-white shadow">
          <table className="w-full table-auto border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-800 text-white shadow-md">
              <tr>
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    className="text-nowrap border-b border-gray-700 p-3"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: pageSize }).map((_, idx) => (
                    <SkeletonRow key={idx} />
                  ))
                : pageRows.length > 0
                  ? pageRows.map((r) => (
                      <tr
                        key={r.rowKey || r.id}
                        className="transition-colors duration-150 odd:bg-white even:bg-gray-50 hover:bg-gray-100"
                      >
                        <td className="border-b border-gray-200 p-3">
                          <div className="font-semibold">
                            {r.product_name || r.spare_item_name || "—"}
                          </div>
                          {(r.model || r.spare_item_code) && (
                            <div className="text-xs text-gray-600">
                              Model: {r.spare_item_code || r.model}
                            </div>
                          )}
                        </td>
                        <td className="border-b border-gray-200 p-3">
                          {String(r.serial_number || "").trim() || (
                            <span className="flex items-center gap-1 text-amber-700">
                              <AlertTriangle size={14} />
                              Missing
                            </span>
                          )}
                        </td>
                        <td className="border-b border-gray-200 p-3">
                          {r.state || "—"}
                        </td>
                        <td className="border-b border-gray-200 p-3 text-xs">
                          {r.order_id ? (
                            <Link
                              href={`/admin-dashboard/order/${r.order_id}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {r.order_id}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="border-b border-gray-200 p-3">
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="font-semibold">Name:</span>{" "}
                              {r.customer_name || "—"}
                            </div>
                            {r.email ? (
                              <div>
                                <span className="font-semibold">Email:</span>{" "}
                                {r.email}
                              </div>
                            ) : null}
                            {r.contact_person ? (
                              <div>
                                <span className="font-semibold">Person:</span>{" "}
                                {r.contact_person}
                              </div>
                            ) : null}
                            {r.contact ? (
                              <div>
                                <span className="font-semibold">Contact:</span>{" "}
                                {r.contact}
                              </div>
                            ) : null}
                            {r.customer_address ? (
                              <div>
                                <span className="font-semibold">Address:</span>{" "}
                                {r.customer_address}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-gray-200 p-3">
                          {warrantyCell(r)}
                        </td>
                        <td className="border-b border-gray-200 p-3 text-xs whitespace-nowrap">
                          {installedByCell(r)}
                        </td>
                        <td className="border-b border-gray-200 p-3">
                          <div className="space-y-1 text-xs">
                            {r.contact_person ? (
                              <div>
                                <span className="font-semibold">Person:</span>{" "}
                                {r.contact_person}
                              </div>
                            ) : null}
                            {r.contact ? (
                              <div>
                                <span className="font-semibold">Contact:</span>{" "}
                                {r.contact}
                              </div>
                            ) : null}
                            {r.email ? (
                              <div>
                                <span className="font-semibold">Email:</span>{" "}
                                {r.email}
                              </div>
                            ) : null}
                            {!r.contact_person && !r.contact && !r.email ? (
                              <div className="text-gray-400">—</div>
                            ) : null}
                          </div>
                        </td>
                        <td className="border-b border-gray-200 p-3">
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="font-semibold">#:</span>{" "}
                              {r.invoice_number || "—"}
                            </div>
                            {r.invoice_date ? (
                              <div>
                                <span className="font-semibold">Date:</span>{" "}
                                {formatDate(r.invoice_date)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="space-y-1 border-b border-gray-200 p-3">
                          {canOnSiteInstall(r) ? (
                            <button
                              type="button"
                              onClick={() => setInstallSpare(r)}
                              className="mb-1 block w-full rounded-md bg-green-500 px-2 py-1 text-center text-xs text-white hover:bg-green-600"
                            >
                              Install
                            </button>
                          ) : null}
                          {r.install_request_id ? (
                            <Link
                              href="/admin-dashboard/view_service_reports/spare-records"
                              className="mb-1 block w-full rounded-md bg-slate-600 px-2 py-1 text-center text-xs text-white hover:bg-slate-700"
                            >
                              Spare Records
                            </Link>
                          ) : null}
                          {Number(r.warranty_registered) !== 1 && r.order_id ? (
                            <Link
                              href={`/admin-dashboard/warranty?order_id=${encodeURIComponent(r.order_id)}&mode=order`}
                              className="mb-1 block w-full rounded-md bg-green-500 px-2 py-1 text-center text-xs text-white hover:bg-green-600"
                            >
                              Register
                            </Link>
                          ) : null}
                          {String(r.serial_number || "").trim() ? (
                            <Link
                              href={`/admin-dashboard/warranty/service-records/${encodeURIComponent(r.serial_number)}`}
                              className="block w-full rounded-md bg-blue-500 px-2 py-1 text-center text-xs text-white hover:bg-blue-600"
                            >
                              History
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td
                        colSpan={TABLE_HEADERS.length}
                        className="p-4 text-center text-gray-500"
                      >
                        No matching records found.
                      </td>
                    </tr>
                  )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 space-y-3 md:hidden">
        {loading ? (
          <MotionPulseRows />
        ) : pageRows.length === 0 ? (
          <div className="rounded border bg-white p-4 text-center text-gray-500">
            No matching records found.
          </div>
        ) : (
          pageRows.map((r) => (
            <motion-card key={r.rowKey || r.id} row={r} />
          ))
        )}
      </div>

      {!loading && total > 0 && renderPagination()}
    </div>
  );
}

function MotionPulseRows() {
  return Array.from({ length: 3 }).map((_, idx) => (
    <div
      key={idx}
      className="h-24 animate-pulse rounded-lg border bg-white p-3 shadow-sm"
    />
  ));
}

function MotionCard({ row: r }) {
  return (
    <div className="space-y-2 rounded-lg border bg-white p-3 text-xs shadow-sm">
      <div className="text-sm font-semibold">
        {r.product_name || r.spare_item_name}
      </div>
      <div>
        <span className="font-semibold">Serial:</span>{" "}
        {r.serial_number || "Missing"}
      </div>
      <div>{warrantyCell(r)}</div>
      <div>
        <span className="font-semibold">Installed by:</span>{" "}
        {r.installed_by
          ? INSTALLED_BY_LABELS[r.installed_by] || r.installed_by
          : "—"}
      </div>
      {r.order_id ? (
        <Link
          href={`/admin-dashboard/warranty?order_id=${encodeURIComponent(r.order_id)}&mode=order`}
          className="inline-block rounded bg-green-600 px-3 py-1 text-white"
        >
          Register
        </Link>
      ) : null}
    </div>
  );
}