// src/app/components/assets/AssetsTable.jsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import ViewModal from "./modals/ViewModal";
import EditModal from "./modals/EditModal";
import AssignModal from "./modals/AssignModal";
import ReceiptModal from "./modals/ReceiptModal";
import SubmitReportModal from "./SubmitReportModal";
import LinkStatementModal from "./modals/LinkStatementModal";
import BulkLinkStatementModal from "./modals/BulkLinkStatementModal";

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
  const [showLinkStatementModal, setShowLinkStatementModal] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState(new Set());
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false);

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

  const openLinkStatementModal = (asset) => {
    setSelectedAsset(asset);
    setShowLinkStatementModal(true);
  };

  const handleStatementLinked = () => {
    // Refresh assets data after linking statement
    fetchAssets();
  };

  const toggleAssetSelection = (assetId) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      const clickedAsset = assets.find(a => a.asset_id === assetId);
      
      if (next.has(assetId)) {
        // Deselecting
        next.delete(assetId);
      } else {
        // Selecting
        next.add(assetId);
        
        // Check if this asset has linked statements
        if (clickedAsset?.linked_trans_id) {
          // Get all assets with same linked_trans_id
          const linkedAssetIds = assets
            .filter(a => a.linked_trans_id === clickedAsset.linked_trans_id)
            .map(a => a.asset_id);
          
          // Find parent (highest purchase_price)
          const linkedAssets = assets.filter(a => linkedAssetIds.includes(a.asset_id));
          const parentAsset = linkedAssets.reduce((max, current) => 
            Number(current.purchase_price || 0) > Number(max.purchase_price || 0) ? current : max
          );
          
          // Auto-select parent if not already selected
          if (!next.has(parentAsset.asset_id)) {
            next.add(parentAsset.asset_id);
          }
          
          // Auto-select all siblings (other assets with same linked statements)
          linkedAssetIds.forEach(id => next.add(id));
        }
      }
      
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAssetIds.size === sortedAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      const allIds = new Set();
      sortedAssets.forEach((asset) => {
        allIds.add(asset.asset_id);
        
        // If asset has linked statements, auto-add siblings
        if (asset.linked_trans_id) {
          const siblings = sortedAssets.filter(a => a.linked_trans_id === asset.linked_trans_id);
          siblings.forEach(sibling => allIds.add(sibling.asset_id));
        }
      });
      setSelectedAssetIds(allIds);
    }
  };

  const getSelectedAssets = () => {
    return assets.filter((a) => selectedAssetIds.has(a.asset_id));
  };

  const getTotalSelectedPrice = () => {
    return getSelectedAssets().reduce((sum, a) => sum + Number(a.purchase_price || 0), 0);
  };

  const handleBulkLinkSuccess = () => {
    fetchAssets();
    setSelectedAssetIds(new Set());
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

      {/* Bulk Actions Toolbar */}
      {selectedAssetIds.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            <span className="font-bold text-blue-600">{selectedAssetIds.size}</span> asset(s) selected • Total: <span className="font-bold text-blue-600">₹{getTotalSelectedPrice().toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkLinkModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
            >
              Link Payment to Selected Assets
            </button>
            <button
              onClick={() => setSelectedAssetIds(new Set())}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden max-h-[80vh] overflow-y-auto">
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full leading-normal" style={{ minWidth: '1200px' }}>
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
                <th className="py-3 px-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={selectedAssetIds.size === sortedAssets.length && sortedAssets.length > 0}
                    indeterminate={selectedAssetIds.size > 0 && selectedAssetIds.size < sortedAssets.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                </th>
                <th className="py-3 px-6 text-left cursor-pointer w-24" onClick={() => handleSort('asset_id')}>Asset ID {sortConfig.key==='asset_id' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-28" onClick={() => handleSort('asset_category')}>Category {sortConfig.key==='asset_category' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-40" onClick={() => handleSort('asset_name')}>Asset Name {sortConfig.key==='asset_name' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-48" onClick={() => handleSort('serial_number')}>Serial Number {sortConfig.key==='serial_number' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('brand_name')}>Brand {sortConfig.key==='brand_name' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('purchase_price')}>Purchase Price {sortConfig.key==='purchase_price' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('purchase_date')}>Purchase Date {sortConfig.key==='purchase_date' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('Assigned_to')}>Assigned To {sortConfig.key==='Assigned_to' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left cursor-pointer w-32" onClick={() => handleSort('Assigned_Date')}>Assigned Date {sortConfig.key==='Assigned_Date' && (<span>{sortConfig.direction==='asc'?' ▲':' ▼'}</span>)}</th>
                <th className="py-3 px-6 text-left w-32">Linked Trans ID</th>
                <th className="py-3 px-6 text-left w-28">Receipt</th>
                <th className="py-3 px-6 text-center w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-sm">
              {sortedAssets.map((asset) => (
                <tr
                  key={asset.asset_id}
                  className={`border-b border-gray-200 hover:bg-gray-50 ${selectedAssetIds.has(asset.asset_id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.has(asset.asset_id)}
                      onChange={() => toggleAssetSelection(asset.asset_id)}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </td>
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
                    {asset.linked_trans_id ? (
                      <div className="flex flex-wrap gap-1">
                        {asset.linked_trans_id.split(', ').map((transId, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-mono rounded">
                            {transId}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
                    <button
                      onClick={() => openLinkStatementModal(asset)}
                      disabled={!!asset.linked_trans_id}
                      className={`mx-1 ${
                        asset.linked_trans_id
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-purple-600 hover:text-purple-900"
                      }`}
                      title={asset.linked_trans_id ? "Cannot link individual asset with parent-child relationship" : "Link Statement"}
                    >
                      Link Statement
                    </button>
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
              <div className="mt-4 flex justify-between space-x-2 flex-wrap gap-2">
                <button
                  onClick={() => openModal(asset, "view")}
                  className="flex-1 py-2 text-sm bg-gray-500 text-white rounded-md"
                >
                  View
                </button>
                <button
                  onClick={() => openModal(asset, "edit")}
                  className="flex-1 py-2 text-sm bg-blue-500 text-white rounded-md"
                >
                  Edit
                </button>
                <button
                  onClick={() => openLinkStatementModal(asset)}
                  disabled={!!asset.linked_trans_id}
                  className={`flex-1 py-2 text-sm rounded-md ${
                    asset.linked_trans_id
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-purple-500 text-white"
                  }`}
                  title={asset.linked_trans_id ? "Cannot link individual asset with parent-child relationship" : "Link Statement"}
                >
                  Link
                </button>
                {asset.Assigned_to && !asset.is_submit ? (
                  <button
                    onClick={() => openModal(asset, "submit")}
                    className="w-full py-2 text-sm bg-indigo-500 text-white rounded-md"
                  >
                    Submit
                  </button>
                ) : (
                  <button
                    onClick={() => openModal(asset, "assign")}
                    className="w-full py-2 text-sm bg-green-500 text-white rounded-md"
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
      <LinkStatementModal 
        isOpen={showLinkStatementModal} 
        onClose={() => setShowLinkStatementModal(false)}
        asset={selectedAsset}
        onLinked={handleStatementLinked}
      />
      <BulkLinkStatementModal
        isOpen={showBulkLinkModal}
        onClose={() => setShowBulkLinkModal(false)}
        selectedAssets={getSelectedAssets()}
        selectedAssetIds={selectedAssetIds}
        totalSelectedPrice={getTotalSelectedPrice()}
        onSuccess={handleBulkLinkSuccess}
      />
    </div>
  );
}
