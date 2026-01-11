"use client";
import { useState, useEffect, useCallback } from "react";

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

  const fetchProducts = useCallback(
    async (page, search = "") => {
      setLoading(true);
      try {
        const url = `/api/warranty/all?page=${page}&limit=${pageSize}&search=${encodeURIComponent(
          search
        )}&model=${encodeURIComponent(modelFilter)}&state=${encodeURIComponent(stateFilter)}`;
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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset to page 1 on new search or filter
      fetchProducts(1, searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, modelFilter, stateFilter, fetchProducts]);

  // Skeleton component for a single table row
  const SkeletonRow = () => (
    <tr className="odd:bg-white even:bg-gray-50 animate-pulse">
      <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-2/3"></div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-full"></div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </td>
      {/* <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
      </td> */}
      <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-1/4"></div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-1/3"></div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="space-y-1">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-4 bg-gray-300 rounded w-2/3"></div>
        </div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="space-y-1">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        </div>
      </td>
      {/* <td className="p-3 border-b border-gray-200">
        <div className="space-y-1">
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/3"></div>
        </div>
      </td> */}
      <td className="p-3 border-b border-gray-200">
        <div className="space-y-1">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        </div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="space-y-1">
          <div className="h-4 bg-gray-300 rounded w-full"></div>
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        </div>
      </td>
      <td className="p-3 border-b border-gray-200">
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </td>
      <td className="p-3 border-b border-gray-200 space-y-1">
        <div className="h-4 bg-gray-300 rounded w-full"></div>
        <div className="h-4 bg-gray-300 rounded w-full"></div>
        <div className="h-4 bg-gray-300 rounded w-full"></div>
        <div className="h-4 bg-gray-300 rounded w-full"></div>
      </td>
    </tr>
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Helper: Calculate warranty status
  const getWarrantyStatus = (installDate, warrantyMonths) => {
    if (!installDate || !warrantyMonths) return { status: "—", color: "text-gray-400" };

    try {
      const install = new Date(installDate);
      const expiry = new Date(install);
      expiry.setMonth(expiry.getMonth() + parseInt(warrantyMonths));

      const now = new Date();
      if (now <= expiry) {
        return { status: "In Warranty", color: "text-green-600 font-semibold" };
      } else {
        return { status: "Out of Warranty", color: "text-red-600 font-semibold" };
      }
    } catch {
      return { status: "—", color: "text-gray-400" };
    }
  };

  const TABLE_HEADERS = [
    "Product / Model",
    "Spec",
    "Serial",
    "Warranty",
    "State",
    "Company",
    "Installation",
    "Site",
    "Invoice",
    "Reports",
    "Actions",
  ];

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 mx-1 rounded ${currentPage === i
              ? "bg-blue-600 text-white font-semibold"
              : "bg-gray-200 hover:bg-gray-300 text-gray-700"
            }`}
        >
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
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {pages}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">Warranty Records</h2>
        <div className="text-sm text-gray-600">
          Total: {total} products
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by product, serial, customer, invoice, installation address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by model"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full md:w-1/4 px-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Filter by state"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="w-full md:w-1/4 px-4 py-2 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col w-full">
        {/* Mobile card layout */}
        <div className="md:hidden space-y-3">
          {loading ? (
            Array.from({ length: Math.min(pageSize, 5) }).map((_, idx) => (
              <div
                key={idx}
                className="border rounded-lg bg-white p-3 shadow-sm animate-pulse h-24"
              />
            ))
          ) : products.length > 0 ? (
            products.map((r, i) => (
              <div
                key={i}
                className="border rounded-lg bg-white p-3 shadow-sm space-y-2 text-xs"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-semibold text-sm">{r.product_name}</div>
                    <div className="text-[11px] text-gray-600">
                      {r.model}  b7 {r.serial_number}
                    </div>
                  </div>
                  <div
                    className={`text-[11px] text-right ${getWarrantyStatus(
                      r.installation_date,
                      r.warranty_period
                    ).color}`}
                  >
                    {getWarrantyStatus(r.installation_date, r.warranty_period).status}
                  </div>
                </div>

                {r.specification && (
                  <div className="text-[11px] text-gray-700">
                    <span className="font-semibold">Spec:</span>{" "}
                    {r.specification}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-1">
                  <div>
                    <div className="font-semibold text-[11px] text-gray-700">Company</div>
                    <div>Name: {r.customer_name}</div>
                    <div>Email: {r.email}</div>
                    <div>Person: {r.contact_person}</div>
                    <div>Contact: {r.contact}</div>
                    {r.customer_address && <div>Addr: {r.customer_address}</div>}
                    <div>State: {r.state || " b7"}</div>
                  </div>

                  <div>
                    <div className="font-semibold text-[11px] text-gray-700">Installation</div>
                    {r.installed_address ? (
                      <>
                        <div>Addr: {r.installed_address}</div>
                        {r.installation_date && <div>Date: {r.installation_date}</div>}
                        {r.lat && <div>Lat: {r.lat}</div>}
                        {r.longt && <div>Long: {r.longt}</div>}
                      </>
                    ) : (
                      <div className="text-gray-400">Not installed</div>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-[11px] text-gray-700">Site</div>
                    {r.site_person && <div>Person: {r.site_person}</div>}
                    {r.site_contact && <div>Contact: {r.site_contact}</div>}
                    {r.site_email && <div>Email: {r.site_email}</div>}
                    {!r.site_person && !r.site_contact && !r.site_email && (
                      <div className="text-gray-400">---</div>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-[11px] text-gray-700">Invoice</div>
                    <div>No: {r.invoice_number}</div>
                    <div>Date: {r.invoice_date}</div>
                    {r.invoice_file && (
                      <a
                        href={`/uploads/${r.invoice_file}`}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        View Invoice
                      </a>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-[11px] text-gray-700">Reports</div>
                    {r.report_file ? (
                      r.report_file.split(",").map((f, idx) => (
                        <div key={idx}>
                          <a
                            href={`/uploads/${f}`}
                            target="_blank"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Report {idx + 1}
                          </a>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">---</div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-1">
                  {!r.installed_address && (
                    <a
                      href={`/user-dashboard/warranty/installation/${r.serial_number}`}
                      className="text-center bg-green-500 hover:bg-green-600 text-white text-[11px] py-1 px-2 rounded-md"
                    >
                      Install
                    </a>
                  )}
                  <a
                    href={`/user-dashboard/warranty/complaint/${r.serial_number}`}
                    className="text-center bg-red-500 hover:bg-red-600 text-white text-[11px] py-1 px-2 rounded-md"
                  >
                    Complaint
                  </a>
                  <a
                    href={`/user-dashboard/warranty/service-records/${r.serial_number}`}
                    className="text-center bg-blue-500 hover:bg-blue-600 text-white text-[11px] py-1 px-2 rounded-md"
                  >
                    History
                  </a>
                  <a
                    href={`/user-dashboard/warranty/edit/${r.serial_number}`}
                    className="text-center bg-yellow-500 hover:bg-yellow-600 text-white text-[11px] py-1 px-2 rounded-md"
                  >
                    Edit
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-4 text-gray-500 border rounded bg-white">
              No matching records found.
            </div>
          )}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block flex-grow overflow-hidden w-full">
          <div className="h-full w-full overflow-x-auto overflow-y-auto rounded border shadow bg-white">
            <table className="w-full text-sm text-left border-collapse table-auto">
              <thead className="bg-gray-800 text-white sticky top-0 z-10 shadow-md">
                <tr>
                  {TABLE_HEADERS.map((header) => (
                    <th
                      key={header}
                      className={`p-3 border-b border-gray-700 text-nowrap ${
                        header === "Spec"
                          ? "min-w-[200px] resize-x overflow-hidden"
                          : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Render skeleton rows while loading
                  Array.from({ length: pageSize }).map((_, idx) => (
                    <SkeletonRow key={idx} />
                  ))
                ) : products.length > 0 ? (
                  // Render the actual data when not loading and data exists
                  products.map((r, i) => (
                    <tr
                      key={i}
                      className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition-colors duration-150 ease-in-out"
                    >
                      <td className="p-3 border-b border-gray-200">
                        <div className="font-semibold">{r.product_name}</div>
                        {r.model && (
                          <div className="text-xs text-gray-600">Model: {r.model}</div>
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-200 relative group max-w-[200px]">
                        <div className="line-clamp-2 text-xs whitespace-pre-wrap group-hover:line-clamp-none group-hover:absolute group-hover:bg-white group-hover:border group-hover:border-gray-300 group-hover:shadow-lg group-hover:z-20 group-hover:p-3 group-hover:rounded group-hover:max-w-md group-hover:left-0 group-hover:top-0">
                          {r.specification}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        {r.serial_number}
                      </td>
                      <td className={`p-3 border-b border-gray-200 ${getWarrantyStatus(r.installation_date, r.warranty_period).color}`}>
                          {getWarrantyStatus(r.installation_date, r.warranty_period).status}
                        </td>
                      {/* <td className="p-3 border-b border-gray-200">
                        {r.quantity}
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        {r.warranty_period}
                      </td> */}
                      <td className="p-3 border-b border-gray-200">
                        {r.state || "—"}
                      </td>
                      <td className="p-3 border-b border-gray-200">
                        <div className="space-y-1 text-xs">
                          <div>
                            <span className="font-semibold">Name:</span>{" "}
                            {r.customer_name}
                          </div>
                          <div>
                            <span className="font-semibold">Email:</span> {r.email}
                          </div>
                          <div>
                            <span className="font-semibold">Person:</span>{" "}
                            {r.contact_person}
                          </div>
                          <div>
                            <span className="font-semibold">Contact:</span>{" "}
                            {r.contact}
                          </div>
                          {r.customer_address && (
                            <div>
                              <span className="font-semibold">Address:</span>{" "}
                              {r.customer_address}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 hidden md:table-cell">
                        <div className="space-y-1 text-xs">
                          {r.installed_address ? (
                            <>
                              <div>
                                <span className="font-semibold">Address:</span>{" "}
                                {r.installed_address}
                              </div>
                              {r.installation_date && (
                                <div>
                                  <span className="font-semibold">Date:</span>{" "}
                                  {r.installation_date}
                                </div>
                              )}
                              {r.lat && (
                                <div>
                                  <span className="font-semibold">Lat:</span> {r.lat}
                                </div>
                              )}
                              {r.longt && (
                                <div>
                                  <span className="font-semibold">Long:</span> {r.longt}
                                </div>
                              )}
                              {!r.lat && !r.longt && (
                                <div className="text-gray-400">---</div>
                              )}
                            </>
                          ) : (
                            <div className="text-gray-400">Not installed</div>
                          )}
                        </div>
                      </td>
                      {/* <td className="p-3 border-b border-gray-200">
                        <div className="space-y-1 text-xs">
                          
                        </div>
                      </td> */}
                      <td className="p-3 border-b border-gray-200 hidden md:table-cell">
                        <div className="space-y-1 text-xs">
                          {r.site_person && (
                            <div>
                              <span className="font-semibold">Person:</span>{" "}
                              {r.site_person}
                            </div>
                          )}
                          {r.site_contact && (
                            <div>
                              <span className="font-semibold">Contact:</span>{" "}
                              {r.site_contact}
                            </div>
                          )}
                          {r.site_email && (
                            <div>
                              <span className="font-semibold">Email:</span>{" "}
                              {r.site_email}
                            </div>
                          )}
                          {!r.site_person && !r.site_contact && !r.site_email && (
                            <div className="text-gray-400">---</div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 hidden md:table-cell">
                        <div className="space-y-1 text-xs">
                          <div>
                            <span className="font-semibold">#:</span>{" "}
                            {r.invoice_number}
                          </div>
                          <div>
                            <span className="font-semibold">Date:</span>{" "}
                            {r.invoice_date}
                          </div>
                          {r.invoice_file && (
                            <div>
                              <a
                                href={`/uploads/${r.invoice_file}`}
                                target="_blank"
                                className="text-blue-600 hover:text-blue-800 underline transition-colors duration-150"
                              >
                                View File
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-b border-gray-200 space-y-1">
                        {r.report_file ? (
                          r.report_file.split(",").map((f, idx) => (
                            <div key={idx}>
                              <a
                                href={`/uploads/${f}`}
                                target="_blank"
                                className="text-blue-600 hover:text-blue-800 underline transition-colors duration-150"
                              >
                                Report {idx + 1}
                              </a>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400">---</div>
                        )}
                      </td>
                      <td className="p-3 border-b border-gray-200 space-y-1">
                        {!r.installed_address && (
                          <a
                            href={`/user-dashboard/warranty/installation/${r.serial_number}`}
                            className="block text-center bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-md transition-colors duration-150 mb-1"
                          >
                            Install
                          </a>
                        )}
                        <a
                          href={`/user-dashboard/warranty/complaint/${r.serial_number}`}
                          className="block text-center bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-md transition-colors duration-150 mb-1"
                        >
                          Complaint
                        </a>
                        <a
                          href={`/user-dashboard/warranty/service-records/${r.serial_number}`}
                          className="block text-center bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded-md transition-colors duration-150 mb-1"
                        >
                          History
                        </a>
                        <a
                          href={`/user-dashboard/warranty/edit/${r.serial_number}`}
                          className="block text-center bg-yellow-500 hover:bg-yellow-600 text-white text-xs py-1 px-2 rounded-md transition-colors duration-150"
                        >
                          Edit
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  // Render a "no records found" message if not loading and no products
                  <tr>
                    <td colSpan={13} className="text-center p-4 text-gray-500">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && products.length > 0 && renderPagination()}
      </div>
    </div>
  );
}
