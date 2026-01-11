// src/app/components/assets/AssetsTable.jsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import ViewModal from "./modals/ViewModal";
import EditModal from "./modals/EditModal";
import AssignModal from "./modals/AssignModal";
import ReceiptModal from "./modals/ReceiptModal";
import SubmitReportModal from "./SubmitReportModal";

export default function AssetsTable() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "asset_id", direction: "asc" });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const fetchAssets = async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const response = await fetch(`/api/assets${qs}`);
      if (!response.ok) {
        throw new Error("Failed to fetch assets");
      }
      const data = await response.json();
      setAssets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openModal = (asset, type) => {
    setSelectedAsset(asset);
    setModalType(type);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedAsset(null);
    setModalType("");
    fetchAssets(); // Refresh data after closing a modal
  };

  const renderModalContent = () => {
    if (!selectedAsset) return null;
    switch (modalType) {
      case "view":
        return <ViewModal asset={selectedAsset} />;
      case "edit":
        return <EditModal asset={selectedAsset} onClose={closeModal} />;
      case "assign":
        return <AssignModal asset={selectedAsset} onClose={closeModal} />;
      case "receipt":
        return <ReceiptModal asset={selectedAsset} onClose={closeModal} />;
      case "submit":
        return <SubmitReportModal asset={selectedAsset} onClose={closeModal} />;
      default:
        return null;
    }
  };

  if (loading)
    return <div className="text-center py-10">Loading assets...</div>;
  if (error)
    return <div className="text-center py-10 text-red-500">Error: {error}</div>;

  // Sort assets client-side (stable clone)
  const filteredAssets = assets.filter((a) => {
    if (categoryFilter && (a.asset_category || a.type || '') !== categoryFilter) return false;
    if (nameFilter && !(a.asset_name || '').toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    const k = sortConfig.key;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    let av = a[k];
    let bv = b[k];
    // Fallbacks for derived columns
    if (k === 'Assigned_to') { av = a.Assigned_to || ''; bv = b.Assigned_to || ''; }
    if (k === 'Assigned_Date') { av = a.Assigned_Date ? new Date(a.Assigned_Date).getTime() : 0; bv = b.Assigned_Date ? new Date(b.Assigned_Date).getTime() : 0; }
    if (k === 'purchase_date') { av = a.purchase_date ? new Date(a.purchase_date).getTime() : 0; bv = b.purchase_date ? new Date(b.purchase_date).getTime() : 0; }
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir;
    }
    return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
  });

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">All</option>
              <option value="assigned">Currently Assigned</option>
              <option value="available">Available</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-700">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">All</option>
              {[...new Set(assets.map(a => a.asset_category || a.type).filter(Boolean))]
                .sort()
                .map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
            </select>
          </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-700">Name:</label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search name"
            className="border rounded px-2 py-1"
          />
        </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden max-h-[80vh] overflow-y-auto">
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full leading-normal" style={{ minWidth: '1200px' }}>
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
                <th className="py-3 px-6 text-left cursor-pointer w-24" onClick={() => handleSort('asset_id')}>Asset ID {sortConfig.key==='asset_id' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-28" onClick={() => handleSort('asset_category')}>Category {sortConfig.key==='asset_category' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-40" onClick={() => handleSort('asset_name')}>Asset Name {sortConfig.key==='asset_name' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-48" onClick={() => handleSort('serial_number')}>Serial Number {sortConfig.key==='serial_number' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('brand_name')}>Brand {sortConfig.key==='brand_name' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('purchase_price')}>Purchase Price {sortConfig.key==='purchase_price' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('purchase_date')}>Purchase Date {sortConfig.key==='purchase_date' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('Assigned_to')}>Assigned To {sortConfig.key==='Assigned_to' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('Assigned_Date')}>Assigned Date {sortConfig.key==='Assigned_Date' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left w-28">Receipt</th>
                <th className="py-3 px-6 text-center w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {sortedAssets.map((asset) => (
                <tr
                  key={asset.asset_id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.asset_id}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.asset_category || asset.type || '-'}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.asset_name}
                  </td>
                  <td className="py-3 px-6 break-words">
                    <div className="text-sm max-w-48">{asset.serial_number}</div>
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.brand_name}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    Rs. {asset.purchase_price}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {new Date(asset.purchase_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.current_status === 'Assigned' ? (asset.Assigned_to || 'Assigned') : 'Available'}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.Assigned_Date ? new Date(asset.Assigned_Date).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {asset.current_status === 'Assigned' ? (
                      asset.receipt_path ? (
                        <a
                          href={asset.receipt_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline"
                        >
                          View Receipt
                        </a>
                      ) : (
                        <button
                          onClick={() => openModal(asset, "receipt")}
                          className="text-blue-600 hover:text-blue-900 mx-1"
                        >
                          Upload Receipt
                        </button>
                      )
                    ) : (
                      "--"
                    )}
                  </td>
                  <td className="py-3 px-6 text-center whitespace-nowrap">
                    <button
                      onClick={() => openModal(asset, "view")}
                      className="text-gray-600 hover:text-gray-900 mx-1"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openModal(asset, "edit")}
                      className="text-blue-600 hover:text-blue-900 mx-1"
                    >
                      Edit
                    </button>
                    {asset.Assigned_to && !asset.is_submit ? (
                      <button
                        onClick={() => openModal(asset, "submit")}
                        className="text-indigo-600 hover:text-indigo-900 mx-1"
                      >
                        Submit
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal(asset, "assign")}
                        className="text-green-600 hover:text-green-900 mx-1"
                      >
                        Assign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden space-y-4 p-4">
          {sortedAssets.map((asset) => (
            <div
              key={asset.asset_id}
              className="bg-white border rounded-lg shadow p-4"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg">{asset.asset_name}</span>
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    asset.is_submit
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {asset.is_submit ? "Submitted" : "Pending"}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                <strong>Brand:</strong> {asset.brand_name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Price:</strong> Rs. {asset.purchase_price}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Purchase Date:</strong>{" "}
                {new Date(asset.purchase_date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Assigned to:</strong>{" "}
                {asset.is_submit
                  ? "Ready to assign"
                  : asset.Assigned_to || "N/A"}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Assigned Date:</strong>{" "}
                {asset.is_submit
                  ? "N/A"
                  : asset.Assigned_Date
                  ? new Date(asset.Assigned_Date).toLocaleDateString()
                  : "N/A"}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Receipt:</strong>{" "}
                {asset.Assigned_to && !asset.is_submit ? (
                  asset.receipt_path ? (
                    <a
                      href={asset.receipt_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      View Receipt
                    </a>
                  ) : (
                    <button
                      onClick={() => openModal(asset, "receipt")}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Upload Receipt
                    </button>
                  )
                ) : (
                  "--"
                )}
              </p>
              <div className="mt-4 flex justify-between space-x-2">
                <button
                  onClick={() => openModal(asset, "view")}
                  className="w-1/4 py-2 text-sm bg-gray-500 text-white rounded-md"
                >
                  View
                </button>
                <button
                  onClick={() => openModal(asset, "edit")}
                  className="w-1/4 py-2 text-sm bg-blue-500 text-white rounded-md"
                >
                  Edit
                </button>
                {asset.Assigned_to && !asset.is_submit ? (
                  <button
                    onClick={() => openModal(asset, "submit")}
                    className="w-1/2 py-2 text-sm bg-indigo-500 text-white rounded-md"
                  >
                    Submit
                  </button>
                ) : (
                  <button
                    onClick={() => openModal(asset, "assign")}
                    className="w-1/2 py-2 text-sm bg-green-500 text-white rounded-md"
                  >
                    Assign
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {renderModalContent()}
      </Modal>
    </div>
  );
}
