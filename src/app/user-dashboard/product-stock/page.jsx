"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Eye, Search, Pencil } from "lucide-react";
import Link from "next/link";

function ProductAndSpareLists({ type }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const url = type === "product" ? "/api/products/list" : "/api/spare/list";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }, [type]);

  const view = useMemo(() => {
    const qt = q.trim().toLowerCase();
    if (!qt) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(qt),
      ),
    );
  }, [rows, q]);

  return (
    <div className="border rounded-lg">
      {/* SEARCH */}
      <div className="p-2 flex items-center gap-2 border-b bg-gray-50">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-full"
          />
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="overflow-auto hidden sm:block">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              {type === "product" ? (
                <>
                  <th className="p-2 text-left">Image</th>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Product No</th>
                  <th className="p-2 text-left">Min Qty</th>
                  <th className="p-2 text-left">Price</th>
                  <th className="p-2 text-left">Last Neg. Price</th>
                  <th className="p-2 text-left">Specification</th>
                </>
              ) : (
                <>
                  <th className="p-2 text-left">Image</th>
                  <th className="p-2 text-left">Spare No</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Min Qty</th>
                  <th className="p-2 text-left">Price</th>
                  <th className="p-2 text-left">Last Neg. Price</th>
                  <th className="p-2 text-left">Specification</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {view.map((r, idx) => {
              const key =
                (r.item_code || r.spare_number || r.item_name || "row") +
                "_" +
                idx;
              const imageUrl =
                type === "product" ? r.image_path || r.product_image : r.image;

              return (
                <tr key={key} className="border-t">
                  <>
                    <td className="p-2">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400">No image</span>
                      )}
                    </td>

                    {type === "product" ? (
                      <>
                        <td className="p-2">{r.item_code}</td>
                        <td className="p-2">{r.item_name}</td>
                        <td className="p-2">{r.product_number}</td>
                        <td className="p-2">{r.min_qty}</td>
                        <td className="p-2">{r.price_per_unit}</td>
                        <td className="p-2">{r.last_negotiation_price || 0}</td>
                        <td className="p-2">{r.specification}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-2">{r.spare_number}</td>
                        <td className="p-2">{r.item_name}</td>
                        <td className="p-2">{r.min_qty}</td>
                        <td className="p-2">{r.price}</td>
                        <td className="p-2">{r.last_negotiation_price || 0}</td>
                        <td className="p-2">{r.specification}</td>
                      </>
                    )}
                  </>
                </tr>
              );
            })}

            {view.length === 0 && (
              <tr>
                <td
                  className="p-2 text-gray-500"
                  colSpan={type === "product" ? 6 : 5}
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="sm:hidden p-2 space-y-3 overflow-auto">
        {view.length === 0 && (
          <div className="text-center text-gray-500 py-4">No data</div>
        )}

        {view.map((r, idx) => {
          const key =
            (r.item_code || r.spare_number || r.item_name) + "_" + idx;
          const imageUrl =
            type === "product" ? r.image_path || r.product_image : r.image;

          return (
            <div key={key} className="border rounded-lg p-3 shadow-sm bg-white">
              {/* TOP: IMAGE + NAME */}
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    className="w-14 h-14 object-cover rounded"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">
                    No Image
                  </div>
                )}

                <div className="text-sm font-semibold text-gray-800">
                  {r.item_name}
                </div>
              </div>

              {/* DETAILS */}
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                {type === "product" ? (
                  <>
                    <p>
                      <span className="font-semibold">Code:</span> {r.item_code}
                    </p>
                    <p>
                      <span className="font-semibold">Product No:</span>{" "}
                      {r.product_number}
                    </p>
                    <p>
                      <span className="font-semibold">Min Qty:</span>{" "}
                      {r.min_qty}
                    </p>
                    <p>
                      <span className="font-semibold">Price:</span>{" "}
                      {r.price_per_unit}
                    </p>
                    <p>
                      <span className="font-semibold">Last Neg. Price:</span>{" "}
                      {r.last_negotiation_price || 0}
                    </p>
                    <p>
                      <span className="font-semibold">Specification:</span>{" "}
                      {r.specification}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="font-semibold">Spare No:</span>{" "}
                      {r.spare_number}
                    </p>
                    <p>
                      <span className="font-semibold">Min Qty:</span>{" "}
                      {r.min_qty}
                    </p>
                    <p>
                      <span className="font-semibold">Price:</span> {r.price}
                    </p>
                    <p>
                      <span className="font-semibold">Last Neg. Price:</span>{" "}
                      {r.last_negotiation_price || 0}
                    </p>
                    <p>
                      <span className="font-semibold">Specification:</span>{" "}
                      {r.specification}
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductStockForm() {
  // Data states for inline sections
  const [availableStockData, setAvailableStockData] = useState([]);
  const [stockTransactionsData, setStockTransactionsData] = useState([]);
  const [stockSummaryData, setStockSummaryData] = useState([]);

  // Search and filter states
  const [availableSearch, setAvailableSearch] = useState("");
  const [transactionsSearch, setTransactionsSearch] = useState("");
  const [summarySearch, setSummarySearch] = useState("");
  const [transactionsStatusFilter, setTransactionsStatusFilter] =
    useState(null);
  const [summaryStatusFilter, setSummaryStatusFilter] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showExportOptions, setShowExportOptions] = useState({
    available: false,
    transactions: false,
    summary: false,
  });

  // Accordion state - only one section open at a time
  const [openSection, setOpenSection] = useState("list");
  const [editingLocation, setEditingLocation] = useState({
    key: null,
    value: "",
  });
  const [savingLocation, setSavingLocation] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Fetch all data on component mount
  useEffect(() => {
    //fetch userRole
    fetch("/api/me")
      .then((res) => res.json())
      .then((res) => setUserRole(res.userRole))
      .catch(() => setUserRole(""));

    // Fetch available stock
    fetch("/api/available-stock")
      .then((res) => res.json())
      .then((res) => setAvailableStockData(Array.isArray(res) ? res : []))
      .catch(() => setAvailableStockData([]));

    // Fetch stock transactions
    fetch("/api/product-stock-summary")
      .then((res) => res.json())
      .then(setStockTransactionsData)
      .catch(() => setStockTransactionsData([]));

    // Fetch stock summary
    fetch("/api/product-stock-status")
      .then((res) => res.json())
      .then(setStockSummaryData)
      .catch(() => setStockSummaryData([]));
  }, []);

  const handleSaveLocation = async (row) => {
    if (!editingLocation.key || savingLocation) return;
    try {
      setSavingLocation(true);
      const res = await fetch("/api/stock/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "product",
          code: row.product_code,
          location: editingLocation.value || "",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        console.error("Failed to update location", data.error || data.message);
        return;
      }
      setAvailableStockData((prev) =>
        Array.isArray(prev)
          ? prev.map((r) =>
              r.product_code === row.product_code
                ? { ...r, location: editingLocation.value || "" }
                : r,
            )
          : prev,
      );
      setEditingLocation({ key: null, value: "" });
    } catch (e) {
      console.error("Error updating location", e);
    } finally {
      setSavingLocation(false);
    }
  };

  function getFileType(url) {
    const ext = url.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "unknown";
  }

  // Filtered data for each section
  const filteredAvailableStock = useMemo(() => {
    const rows = Array.isArray(availableStockData)
      ? [...availableStockData]
      : [];
    return availableSearch
      ? rows.filter((item) =>
          Object.values(item).some((val) =>
            String(val ?? "")
              .toLowerCase()
              .includes(availableSearch.toLowerCase()),
          ),
        )
      : rows;
  }, [availableStockData, availableSearch]);

  const filteredTransactions = useMemo(() => {
    let filtered = stockTransactionsData;
    if (transactionsStatusFilter) {
      filtered = filtered.filter(
        (item) => item.stock_status?.toUpperCase() === transactionsStatusFilter,
      );
    }
    if (transactionsSearch) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(transactionsSearch.toLowerCase()),
        ),
      );
    }
    return filtered;
  }, [stockTransactionsData, transactionsSearch, transactionsStatusFilter]);

  const filteredSummary = useMemo(() => {
    let filtered = Array.isArray(stockSummaryData) ? stockSummaryData : [];
    if (summaryStatusFilter) {
      filtered = filtered.filter(
        (item) =>
          item.stock_status?.toLowerCase() ===
          summaryStatusFilter.toLowerCase(),
      );
    }
    if (summarySearch) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(summarySearch.toLowerCase()),
        ),
      );
    }
    return filtered;
  }, [stockSummaryData, summarySearch, summaryStatusFilter]);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
          Price List Stock Management
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {userRole === "ADMIN" && (
            <Link
              href="/user-dashboard/add-assets"
              className="text-sm px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700"
            >
              Add New Product
            </Link>
          )}
          {/* Section Toggle Buttons */}
          <button
            onClick={() => setOpenSection("list")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${
              openSection === "list"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            List
          </button>
          {[
            "ADMIN",
            "DIGITAL MARKETER",
            "WAREHOUSE INCHARGE",
            "ACCOUNTANT",
          ].includes(userRole) && (
            <>
              <button
                onClick={() => setOpenSection("available")}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${
                  openSection === "available"
                    ? "bg-teal-600 hover:bg-teal-700"
                    : "bg-teal-500 hover:bg-teal-600"
                }`}
              >
                Available Stock
              </button>
              <button
                onClick={() => setOpenSection("transactions")}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${
                  openSection === "transactions"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-gray-500 hover:bg-gray-600"
                }`}
              >
                Stock Transactions
              </button>
              <button
                onClick={() => setOpenSection("summary")}
                className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${
                  openSection === "summary"
                    ? "bg-pink-600 hover:bg-pink-700"
                    : "bg-gray-500 hover:bg-gray-600"
                }`}
              >
                Stock Summary
              </button>
            </>
          )}
        </div>
      </div>

      {/* List Section (Product) */}
      <div
        className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "list" ? "" : "hidden"}`}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setOpenSection("list")}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">
            List
          </h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">
            {openSection === "list" ? "−" : "+"}
          </span>
        </div>
        {openSection === "list" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <ProductAndSpareLists type="product" />
          </div>
        )}
      </div>
      {[
        "ADMIN",
        "DIGITAL MARKETER",
        "WAREHOUSE INCHARGE",
        "ACCOUNTANT",
      ].includes(userRole) && (
        <>
          {/* Available Stock Section */}
          <div
            className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "available" ? "" : "hidden"}`}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setOpenSection("available")}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                Available Stock
              </h3>
              <span className="text-xl sm:text-2xl font-bold text-gray-500">
                {openSection === "available" ? "−" : "+"}
              </span>
            </div>
            {openSection === "available" && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={availableSearch}
                      onChange={(e) => setAvailableSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full"
                    />
                  </div>
                </div>

                {/* Mobile View – Available Stock */}
                <div className="md:hidden space-y-3 mt-4">
                  {filteredAvailableStock.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center">
                      No stock data available
                    </p>
                  ) : (
                    filteredAvailableStock.map((row, idx) => (
                      <div
                        key={(row.product_code || "product") + "_" + idx}
                        className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                      >
                        {/* Top Row */}
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <p className="text-xs text-gray-500">
                              Product Code
                            </p>
                            <p className="text-sm font-semibold text-gray-800 break-words">
                              {row.product_code}
                            </p>
                          </div>

                          {/* Image */}
                          <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                            {row.product_image ? (
                              <img
                                src={
                                  row.product_image?.startsWith("http")
                                    ? row.product_image
                                    : row.product_image?.startsWith("/")
                                      ? row.product_image
                                      : `/${row.product_image}`
                                }
                                alt={row.item_name || "Product"}
                                className="w-16 h-16 object-cover rounded"
                              />
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                No image
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-gray-500">Item Name</p>
                            <p className="font-medium text-gray-800 break-words">
                              {row.item_name}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total Qty</p>
                            <p className="font-semibold text-gray-900">
                              {row.total}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Delhi</p>
                            <p className="font-medium">{row.delhi}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">South</p>
                            <p className="font-medium">{row.south}</p>
                          </div>
                        </div>

                        {/* Storage Location Editor */}
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">
                            Storage Location
                          </p>

                          {editingLocation.key === row.product_code ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingLocation.value}
                                onChange={(e) =>
                                  setEditingLocation((prev) => ({
                                    ...prev,
                                    value: e.target.value,
                                  }))
                                }
                                className="border rounded px-2 py-1 text-[11px] w-full"
                              />
                              <button
                                onClick={() => handleSaveLocation(row)}
                                disabled={savingLocation}
                                className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() =>
                                  setEditingLocation({ key: null, value: "" })
                                }
                                disabled={savingLocation}
                                className="px-2 py-1 text-[11px] bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {row.location || "--"}
                              </span>
                              <button
                                onClick={() =>
                                  setEditingLocation({
                                    key: row.product_code,
                                    value: row.location || "",
                                  })
                                }
                                className="text-gray-500 hover:text-blue-600"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Updated At */}
                        <div className="mt-1 text-[11px] text-gray-500">
                          Updated:{" "}
                          {row.updated_at
                            ? new Date(row.updated_at).toLocaleString()
                            : "--"}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/*Desktop Table */}
                <div className="hidden md:block overflow-x-auto mt-3">
                  <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                    <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                      <tr>
                        <th className="p-3 border-b font-semibold">
                          Product Code
                        </th>
                        <th className="p-3 border-b font-semibold">
                          Product Image
                        </th>
                        <th className="p-3 border-b font-semibold">
                          Item Name
                        </th>
                        <th className="p-3 border-b font-semibold">
                          Total Qty
                        </th>
                        <th className="p-3 border-b font-semibold">
                          Delhi Godown
                        </th>
                        <th className="p-3 border-b font-semibold">
                          South Godown
                        </th>
                        <th className="p-3 border-b font-semibold">
                          Storage Location
                        </th>
                        <th className="p-3 border-b font-semibold">
                          Updated At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAvailableStock.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="p-4 text-center text-gray-500"
                          >
                            No stock data available
                          </td>
                        </tr>
                      ) : (
                        filteredAvailableStock.map((row, idx) => (
                          <tr
                            key={`${row.product_code}_${idx}`}
                            className="border-t hover:bg-gray-50"
                          >
                            <td className="p-2 sm:p-3">{row.product_code}</td>
                            <td className="p-2 sm:p-3">
                              {row.product_image ? (
                                <Image
                                  src={
                                    row.product_image?.startsWith("http")
                                      ? row.product_image
                                      : row.product_image?.startsWith("/")
                                        ? row.product_image
                                        : `/${row.product_image}`
                                  }
                                  alt={row.item_name || "Product"}
                                  width={64}
                                  height={64}
                                  className="object-cover rounded w-12 h-12 sm:w-16 sm:h-16"
                                  unoptimized
                                />
                              ) : (
                                <span className="text-gray-400">No image</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3">{row.item_name}</td>
                            <td className="p-2 sm:p-3 font-semibold">
                              {row.total}
                            </td>
                            <td className="p-2 sm:p-3">{row.delhi}</td>
                            <td className="p-2 sm:p-3">{row.south}</td>
                            <td className="p-2 sm:p-3">
                              {editingLocation.key === row.product_code ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingLocation.value}
                                    onChange={(e) =>
                                      setEditingLocation((prev) => ({
                                        ...prev,
                                        value: e.target.value,
                                      }))
                                    }
                                    className="border rounded px-2 py-1 text-[11px] sm:text-xs w-full"
                                  />
                                  <button
                                    onClick={() => handleSaveLocation(row)}
                                    disabled={savingLocation}
                                    className="px-2 py-1 text-[11px] sm:text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() =>
                                      setEditingLocation({
                                        key: null,
                                        value: "",
                                      })
                                    }
                                    disabled={savingLocation}
                                    className="px-2 py-1 text-[11px] sm:text-xs bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{row.location || "--"}</span>
                                  <button
                                    onClick={() =>
                                      setEditingLocation({
                                        key: row.product_code,
                                        value: row.location || "",
                                      })
                                    }
                                    className="text-gray-500 hover:text-blue-600"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 whitespace-nowrap">
                              {row.updated_at
                                ? new Date(row.updated_at).toLocaleString()
                                : ""}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Stock Transactions Section */}
          <div
            className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "transactions" ? "" : "hidden"}`}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setOpenSection("transactions")}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                Stock Transactions
              </h3>
              <span className="text-xl sm:text-2xl font-bold text-gray-500">
                {openSection === "transactions" ? "−" : "+"}
              </span>
            </div>
            {openSection === "transactions" && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={transactionsSearch}
                      onChange={(e) => setTransactionsSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTransactionsStatusFilter("IN")}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded ${
                        transactionsStatusFilter === "IN"
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      }`}
                    >
                      IN
                    </button>
                    <button
                      onClick={() => setTransactionsStatusFilter("OUT")}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded ${
                        transactionsStatusFilter === "OUT"
                          ? "bg-red-600 text-white"
                          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      }`}
                    >
                      OUT
                    </button>
                    <button
                      onClick={() => setTransactionsStatusFilter(null)}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded ${
                        transactionsStatusFilter === null
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>

                {/* Mobile View – Stock Transactions */}
                <div className="md:hidden space-y-3 mt-4">
                  {filteredTransactions.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center">
                      No stock transactions available
                    </p>
                  ) : (
                    filteredTransactions.map((row, idx) => (
                      <div
                        key={row.product_code + "_" + idx}
                        className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                      >
                        {/* Basic Details */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-500">Model</p>
                            <p className="font-semibold text-gray-800">
                              {row.product_code}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Product UID No</p>
                            <p className="font-medium text-gray-800 break-words">
                              {row.product_number}
                            </p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-gray-500">Item Name</p>
                            <p className="font-medium text-gray-800 break-words">
                              {row.item_name}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Latest Qty</p>
                            <p className="font-semibold text-gray-900">
                              {row.quantity}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">From Company</p>
                            <p className="font-medium">
                              {row.from_company || "--"}
                            </p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-gray-500">Location</p>
                            <p className="font-medium break-words">
                              {row.location || "--"}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Godown</p>
                            <p className="font-medium">{row.godown || "--"}</p>
                          </div>

                          <div>
                            <p className="text-gray-500">Added By</p>
                            <p className="font-medium">
                              {row.added_by || "--"}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Sold To</p>
                            <p className="font-medium">
                              {row.to_company || "--"}
                            </p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-gray-500">Sold Address</p>
                            <p className="font-medium break-words">
                              {row.delivery_address || "--"}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-500">Net Amount</p>
                            <p className="font-medium">{row.net_amount}</p>
                          </div>

                          <div>
                            <p className="text-gray-500">Status</p>
                            <p
                              className={`font-semibold ${
                                row.stock_status === "IN"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {row.stock_status}
                            </p>
                          </div>
                        </div>

                        {/* Updated Time */}
                        <div className="mt-2 text-[11px] text-gray-500">
                          Updated:{" "}
                          {row.updated_at
                            ? new Date(row.updated_at).toLocaleString()
                            : "--"}
                        </div>

                        {/* File View */}
                        <div className="mt-1">
                          {row.supporting_file ? (
                            <button
                              onClick={() =>
                                setPreviewImage({
                                  url: row.supporting_file,
                                  type: getFileType(row.supporting_file),
                                })
                              }
                              className="text-gray-600 hover:text-blue-600 text-xs flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              View File
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">
                              No File
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/*Desktop Table */}
                <div className="hidden md:block overflow-x-auto mt-3">
                  <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                    <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                      <tr>
                        <th className="p-2 border-b">Model</th>
                        <th className="p-2 border-b">Product UID No</th>
                        <th className="p-2 border-b">Item Name</th>
                        <th className="p-2 border-b">Latest Qty</th>
                        <th className="p-2 border-b">From Company</th>
                        <th className="p-2 border-b">Location</th>
                        <th className="p-2 border-b">Godown</th>
                        <th className="p-2 border-b">Added By</th>
                        <th className="p-2 border-b">Sold To</th>
                        <th className="p-2 border-b">Sold Address</th>
                        <th className="p-2 border-b">Net Amount</th>
                        <th className="p-2 border-b">Status</th>
                        <th className="p-2 border-b">Updated At</th>
                        <th className="p-2 border-b">File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((row, idx) => (
                        <tr
                          key={row.product_code + "_" + idx}
                          className="border-t"
                        >
                          <td className="p-2 align-top">{row.product_code}</td>
                          <td className="p-2 align-top">
                            {row.product_number}
                          </td>
                          <td className="p-2 align-top">{row.item_name}</td>
                          <td className="p-2 align-top">{row.quantity}</td>
                          <td className="p-2 align-top">
                            {row.from_company || "--"}
                          </td>
                          <td className="p-2 align-top">{row.location}</td>
                          <td className="p-2 align-top">
                            {row.godown || "--"}
                          </td>
                          <td className="p-2 align-top">
                            {row.added_by || "--"}
                          </td>
                          <td className="p-2 align-top">
                            {row.to_company || "--"}
                          </td>
                          <td className="p-2 align-top">
                            {row.delivery_address || "--"}
                          </td>
                          <td className="p-2 align-top">{row.net_amount}</td>
                          <td className="p-2 align-top">
                            <span
                              className={`font-semibold ${
                                row.stock_status === "IN"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {row.stock_status}
                            </span>
                          </td>
                          <td className="p-2 align-top whitespace-nowrap">
                            {new Date(row.updated_at).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            {row.supporting_file ? (
                              <button
                                onClick={() =>
                                  setPreviewImage({
                                    url: row.supporting_file,
                                    type: getFileType(row.supporting_file),
                                  })
                                }
                                className="text-gray-600 hover:text-blue-700"
                              >
                                <Eye className="w-5 h-5 inline" />
                              </button>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Stock Summary Section */}
          <div
            className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "summary" ? "" : "hidden"}`}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setOpenSection("summary")}
            >
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                Stock Summary
              </h3>
              <span className="text-xl sm:text-2xl font-bold text-gray-500">
                {openSection === "summary" ? "−" : "+"}
              </span>
            </div>
            {openSection === "summary" && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={summarySearch}
                      onChange={(e) => setSummarySearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full"
                    />
                  </div>
                  <button
                    onClick={() => setSummaryStatusFilter("IN")}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${
                      summaryStatusFilter === "IN"
                        ? "bg-blue-700 text-white"
                        : "bg-gray-200 text-black"
                    }`}
                  >
                    IN
                  </button>
                  <button
                    onClick={() => setSummaryStatusFilter("OUT")}
                    className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${
                      summaryStatusFilter === "OUT"
                        ? "bg-blue-700 text-white"
                        : "bg-gray-200 text-black"
                    }`}
                  >
                    OUT
                  </button>
                  <button
                    onClick={() => setSummaryStatusFilter(null)}
                    className="px-3 py-1.5 rounded-md text-xs sm:text-sm bg-gray-100"
                  >
                    Reset
                  </button>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3 mt-3">
                  {filteredSummary.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center">
                      No stock summary available
                    </p>
                  ) : (
                    filteredSummary.map((row, idx) => {
                      const status = row.last_status || row.stock_status || "";

                      return (
                        <div
                          key={(row.spare_id || "spare") + "_" + idx}
                          className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                        >
                          {/* Spare Number & Name */}
                          <div className="flex flex-col gap-1">
                            <div>
                              <p className="text-[11px] text-gray-500">
                                Spare Number
                              </p>
                              <p className="text-sm font-semibold text-gray-800">
                                {row.spare_number}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-500">
                                Spare Name
                              </p>
                              <p className="text-sm font-medium text-gray-800 break-words">
                                {row.item_name}
                              </p>
                            </div>
                          </div>

                          {/* Qty Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div>
                              <p className="text-gray-500">Min Qty</p>
                              <p className="font-semibold text-gray-900">
                                {row.min_qty ?? "--"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Total Quantity</p>
                              <p className="font-semibold text-gray-900">
                                {row.total_quantity}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Delhi</p>
                              <p className="font-medium text-gray-800">
                                {row.Delhi ?? row.delhi}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">South</p>
                              <p className="font-medium text-gray-800">
                                {row.South ?? row.south}
                              </p>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="mt-2">
                            <p className="text-[11px] text-gray-500">
                              Last Status
                            </p>
                            <span
                              className={`font-semibold text-sm ${
                                status === "IN"
                                  ? "text-green-600"
                                  : status === "OUT"
                                    ? "text-red-600"
                                    : "text-gray-700"
                              }`}
                            >
                              {status || "--"}
                            </span>
                          </div>

                          {/* Updated At */}
                          <div className="mt-1 text-[11px] text-gray-500">
                            Updated:{" "}
                            {row.updated_at
                              ? new Date(row.updated_at).toLocaleString()
                              : "--"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto mt-3">
                  <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                    <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                      <tr>
                        <th className="p-2 border-b">Product Code</th>
                        <th className="p-2 border-b">Product Number</th>
                        <th className="p-2 border-b">Item Name</th>
                        <th className="p-2 border-b">Total Quantity</th>
                        <th className="p-2 border-b">Min Qty</th>
                        <th className="p-2 border-b">From Company</th>
                        <th className="p-2 border-b">Location</th>
                        <th className="p-2 border-b">Added By</th>
                        <th className="p-2 border-b">Net Amount</th>
                        <th className="p-2 border-b">Stock Status</th>
                        <th className="p-2 border-b">Updated At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSummary.map((row, idx) => (
                        <tr
                          key={row.product_code + "_" + idx}
                          className="border-t"
                        >
                          <td className="p-2">{row.product_code}</td>
                          <td className="p-2">{row.product_number}</td>
                          <td className="p-2">{row.item_name}</td>
                          <td className="p-2">{row.total_quantity}</td>
                          <td className="p-2">{row.min_qty}</td>
                          <td className="p-2">{row.from_company}</td>
                          <td className="p-2">{row.location}</td>
                          <td className="p-2">{row.added_by}</td>
                          <td className="p-2">{row.net_amount}</td>
                          <td className="p-2">{row.stock_status}</td>
                          <td className="p-2 whitespace-nowrap">
                            {new Date(row.updated_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {/* Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white p-4 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">Preview</h4>
              <button onClick={() => setPreviewImage(null)}>✕</button>
            </div>
            {previewImage.type === "image" ? (
              <img
                src={previewImage.url}
                alt="Preview"
                className="max-h-[70vh] object-contain mx-auto"
              />
            ) : previewImage.type === "pdf" ? (
              <iframe
                src={previewImage.url}
                title="PDF Preview"
                className="w-full h-[70vh]"
              />
            ) : (
              <p className="text-red-500 text-center mt-4">
                Cannot preview this file type.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
