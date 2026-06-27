"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Search, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function SpareList() {
  const [rows, setRows] = useState([]);
  const [stockTotals, setStockTotals] = useState({ totalQty: 0, totalValue: 0 });
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMake, setFilterMake] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterCompatible, setFilterCompatible] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // 'model' | 'compatible' | null
  const [editingPrice, setEditingPrice] = useState({ key: null, field: null, value: "" });
  const [savingPrice, setSavingPrice] = useState(false);
  const [editingSpare, setEditingSpare] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingSpare, setDeletingSpare] = useState(false);
  const [userRole, setUserRole] = useState("");
  
  // Products for compatible machines dropdown
  const [products, setProducts] = useState([]);
  const [machineSearch, setMachineSearch] = useState("");
  const [showMachineDropdown, setShowMachineDropdown] = useState(false);

  const handleSavePrice = async (row, field) => {
    const code = row.id;

    try {
      setSavingPrice(true);
      const res = await fetch("/api/stock/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: 'spare',
          code,
          price: editingPrice.value,
          field
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to update price");
        return;
      }

      setRows(prev => prev.map(r => {
        const key = r.id;
        if (key === code) {
          const targetField = field === 'price' ? 'price' : 'last_negotiation_price';
          return { ...r, [targetField]: editingPrice.value };
        }
        return r;
      }));
      setEditingPrice({ key: null, field: null, value: "" });
    } catch (err) {
      console.error(err);
      alert("Error updating price");
    } finally {
      setSavingPrice(false);
    }
  };

  const handleEditClick = (spare) => {
    setEditingSpare({ ...spare });
    setIsModalOpen(true);
  };

  const handleSaveSpare = async () => {
    try {
      const formData = new FormData();
      formData.append('id', editingSpare.id);
      formData.append('spare_number', editingSpare.spare_number);
      formData.append('item_name', editingSpare.item_name);
      formData.append('type', editingSpare.type || '');
      formData.append('make', editingSpare.make || '');
      formData.append('model', editingSpare.model || '');
      formData.append('compatible_machine', editingSpare.compatible_machine || '');
      formData.append('min_qty', editingSpare.min_qty);
      formData.append('purchase_price', editingSpare.purchase_price);
      formData.append('sale_price', editingSpare.sale_price);
      formData.append('tax', editingSpare.tax || 0);
      formData.append('last_negotiation_price', editingSpare.last_negotiation_price);
      formData.append('specification', editingSpare.specification);
      if (editingSpare.newImageFile) {
        formData.append('image', editingSpare.newImageFile);
      }

      const res = await fetch('/api/spare/update', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to update spare');
        return;
      }

      // Refresh the list
      fetch('/api/spare/list')
        .then(r => r.json())
        .then(d => setRows(Array.isArray(d) ? d : []))
        .catch(() => setRows([]));

      setIsModalOpen(false);
      setEditingSpare(null);
    } catch (error) {
      console.error('Error saving spare:', error);
      alert('Failed to update spare');
    }
  };

  const handleDeleteSpare = async (id) => {
    if (!confirm('Are you sure you want to delete this spare? This action cannot be undone.')) return;

    try {
      setDeletingSpare(true);
      const res = await fetch("/api/spare/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete spare");
        return;
      }

      // Refresh the list
      fetch('/api/spare/list')
        .then(r => r.json())
        .then(d => setRows(Array.isArray(d) ? d : []))
        .catch(() => setRows([]));

      alert("Spare deleted successfully");
    } catch (err) {
      console.error(err);
      alert("Error deleting spare");
    } finally {
      setDeletingSpare(false);
    }
  };

  // Filter products based on search input for modal dropdown
  const filteredProducts = products.filter((p) => {
    const query = machineSearch.toLowerCase();
    if (!query) return true;
    
    const itemName = String(p.item_name || "").toLowerCase();
    const itemCode = String(p.item_code || "").toLowerCase();
    const productNumber = String(p.product_number || "").toLowerCase();
    
    return itemName.includes(query) || itemCode.includes(query) || productNumber.includes(query);
  });

  // Add machine to compatible machines in modal
  const addMachineToModal = (product) => {
    if (!editingSpare) return;
    
    const machineId = product.product_number; // Store only product_number
    const currentMachines = String(editingSpare.compatible_machine || "").split(",").map(m => m.trim()).filter(m => m);
    
    // Check if already added
    if (currentMachines.includes(machineId)) {
      alert("This machine is already added");
      return;
    }

    const updatedMachines = [...currentMachines, machineId].join(", ");
    setEditingSpare({ ...editingSpare, compatible_machine: updatedMachines });
    setMachineSearch("");
    setShowMachineDropdown(false);
  };

  useEffect(() => {
    // Fetch user role
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUserRole(d.userRole))
      .catch(() => setUserRole(""));

    // Fetch products for compatible machines dropdown
    fetch('/api/products/list')
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]));

    fetch('/api/spare/list')
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));

    // Fetch actual stock totals
    fetch('/api/spare/total-value')
      .then(r => r.json())
      .then(d => setStockTotals({ totalQty: d.totalQty || 0, totalValue: d.totalValue || 0 }))
      .catch(() => setStockTotals({ totalQty: 0, totalValue: 0 }));
  }, []);

  // Create a map for fast product lookup
  const productMap = useMemo(() => {
    const map = {};
    products.forEach(p => {
      if (p.product_number) {
        map[p.product_number] = p.item_code;
      }
    });
    return map;
  }, [products]);

  const view = useMemo(() => {
    const qt = q.trim().toLowerCase();
    return rows.filter(r => {
      if (qt && !Object.values(r).some(v => String(v ?? '').toLowerCase().includes(qt))) return false;
      if (filterType && String(r.type ?? '') !== filterType) return false;
      if (filterMake && String(r.make ?? '').toLowerCase() !== filterMake.toLowerCase()) return false;
      if (filterModel && String(r.model ?? '').toLowerCase() !== filterModel.toLowerCase()) return false;
      if (filterCompatible && !String(r.compatible_machine ?? '').toLowerCase().includes(filterCompatible.toLowerCase())) return false;
      return true;
    });
  }, [rows, q, filterType, filterMake, filterModel, filterCompatible]);

  const uniqueTypes = useMemo(() => [...new Set(rows.map(r => r.type).filter(Boolean))].sort(), [rows]);
  const uniqueMakes = useMemo(() => [...new Set(rows.map(r => r.make).filter(Boolean))].sort(), [rows]);
  const uniqueModels = useMemo(() => [...new Set(rows.map(r => r.model).filter(Boolean))].sort(), [rows]);
  const uniqueCompatibles = useMemo(() => {
    const all = [];
    rows.forEach(r => {
      String(r.compatible_machine || '').split(',').forEach(m => { const t = m.trim(); if (t) all.push(t); });
    });
    return [...new Set(all)].sort();
  }, [rows]);

  const totals = useMemo(() => {
    return { totalMinQty: stockTotals.totalQty, totalPrice: stockTotals.totalValue };
  }, [stockTotals]);

  return (
    <div className="border rounded-lg">

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 p-4 border-b bg-gray-50">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="text-sm font-medium text-blue-600">Total Stock Qty</div>
          <div className="text-2xl font-bold text-blue-800">{totals.totalMinQty.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="text-sm font-medium text-green-600">Total Stock Value</div>
          <div className="text-2xl font-bold text-green-800">₹{totals.totalPrice.toLocaleString()}</div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="p-2 flex items-center gap-2 border-b bg-gray-50">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 border rounded-md text-sm w-full"
          />
        </div>
      </div>

      {/* FILTERS */}
      <div className="p-2 flex flex-col gap-1.5 border-b bg-gray-50">
        {/* Row 1: Type, Make */}
        <div className="flex gap-2 items-center">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="border rounded px-2 py-1.5 text-xs flex-1 min-w-0"
          >
            <option value="">All Types</option>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterMake}
            onChange={e => setFilterMake(e.target.value)}
            className="border rounded px-2 py-1.5 text-xs flex-1 min-w-0"
          >
            <option value="">All Makes</option>
            {uniqueMakes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* Row 2: Model, Compatible Models, Clear */}
        <div className="flex gap-2 items-center">
          {/* Custom Model dropdown */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'model' ? null : 'model')}
              className="w-full border rounded px-2 py-1.5 text-xs text-left bg-white flex justify-between items-center gap-1"
            >
              <span className="truncate">{filterModel || "All Models"}</span>
              <span className="shrink-0">▾</span>
            </button>
            {openDropdown === 'model' && (
              <div className="absolute left-0 top-full mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded shadow-lg z-50 text-xs">
                <div
                  onClick={() => { setFilterModel(""); setOpenDropdown(null); }}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${!filterModel ? 'bg-blue-50 font-semibold' : ''}`}
                >All Models</div>
                {uniqueModels.map(m => (
                  <div key={m}
                    onClick={() => { setFilterModel(m); setOpenDropdown(null); }}
                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 truncate ${filterModel === m ? 'bg-blue-100 font-semibold' : ''}`}
                  >{m}</div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Compatible dropdown */}
          <div className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'compatible' ? null : 'compatible')}
              className="w-full border rounded px-2 py-1.5 text-xs text-left bg-white flex justify-between items-center gap-1"
            >
              <span className="truncate">{filterCompatible || "Compatible"}</span>
              <span className="shrink-0">▾</span>
            </button>
            {openDropdown === 'compatible' && (
              <div className="absolute left-0 top-full mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded shadow-lg z-50 text-xs">
                <div
                  onClick={() => { setFilterCompatible(""); setOpenDropdown(null); }}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${!filterCompatible ? 'bg-blue-50 font-semibold' : ''}`}
                >All</div>
                {uniqueCompatibles.map(m => (
                  <div key={m}
                    onClick={() => { setFilterCompatible(m); setOpenDropdown(null); }}
                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 truncate ${filterCompatible === m ? 'bg-blue-100 font-semibold' : ''}`}
                  >{m}</div>
                ))}
              </div>
            )}
          </div>

          {(filterType || filterMake || filterModel || filterCompatible) && (
            <button
              onClick={() => { setFilterType(""); setFilterMake(""); setFilterModel(""); setFilterCompatible(""); setOpenDropdown(null); }}
              className="px-2 py-1.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="overflow-auto hidden sm:block">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Image</th>
              <th className="p-2 text-left">Spare No</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Make</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-left">Compatible Machines</th>
              <th className="p-2 text-left">Min Qty</th>
              <th className="p-2 text-left">Purchase Price</th>
              <th className="p-2 text-left">Sale Price</th>
              <th className="p-2 text-left">Last Neg. Price</th>
              <th className="p-2 text-left">Tax %</th>
              <th className="p-2 text-left">Specification</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>

          <tbody>
            {view.map((r, idx) => {
              const key = (r.spare_number || r.item_name || "row") + "_" + idx;
              const imageUrl = r.image;

              return (
                <tr key={key} className="border-t">
                  <>
                    <td className="p-2">
                      {imageUrl ? (
                        <img src={imageUrl} className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <span className="text-gray-400">No image</span>
                      )}
                    </td>
                    <td className="p-2">{r.spare_number}</td>
                    <td className="p-2">{r.item_name}</td>
                    <td className="p-2 text-xs bg-blue-50">{r.type || "-"}</td>
                    <td className="p-2 text-xs bg-green-50">{r.make || "-"}</td>
                    <td className="p-2 text-xs bg-yellow-50">{r.model || "-"}</td>
                    <td className="p-2 text-xs max-w-xs">
                      {r.compatible_machine ? (
                        <div className="space-y-1">
                          {String(r.compatible_machine).split(",").map((machine, idx) => {
                            const productNum = machine.trim();
                            const displayCode = productMap[productNum] || productNum;
                            return (
                              <span key={idx} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs mr-1 mb-1">
                                {displayCode}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-2">{r.min_qty}</td>
                    <td className="p-2">
                      {editingPrice.key === r.id && editingPrice.field === 'purchase_price' ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            className="w-20 border rounded px-1 text-xs"
                            value={editingPrice.value}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev, value: e.target.value }))}
                          />
                          <button disabled={savingPrice} onClick={() => handleSavePrice(r, 'purchase_price')} className="text-green-600 text-xs">Save</button>
                          <button disabled={savingPrice} onClick={() => setEditingPrice({ key: null, field: null, value: "" })} className="text-gray-500 text-xs">X</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>{r.purchase_price || 0}</span>
                          <Pencil className="w-3 h-3 text-gray-400 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => setEditingPrice({ key: r.id, field: 'purchase_price', value: r.purchase_price || 0 })} />
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {editingPrice.key === r.id && editingPrice.field === 'sale_price' ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            className="w-20 border rounded px-1 text-xs"
                            value={editingPrice.value}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev, value: e.target.value }))}
                          />
                          <button disabled={savingPrice} onClick={() => handleSavePrice(r, 'sale_price')} className="text-green-600 text-xs">Save</button>
                          <button disabled={savingPrice} onClick={() => setEditingPrice({ key: null, field: null, value: "" })} className="text-gray-500 text-xs">X</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>{r.sale_price || 0}</span>
                          <Pencil className="w-3 h-3 text-gray-400 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => setEditingPrice({ key: r.id, field: 'sale_price', value: r.sale_price || 0 })} />
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {editingPrice.key === r.id && editingPrice.field === 'last_negotiation_price' ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            className="w-20 border rounded px-1 text-xs"
                            value={editingPrice.value}
                            onChange={(e) => setEditingPrice(prev => ({ ...prev, value: e.target.value }))}
                          />
                          <button disabled={savingPrice} onClick={() => handleSavePrice(r, 'last_negotiation_price')} className="text-green-600 text-xs">Save</button>
                          <button disabled={savingPrice} onClick={() => setEditingPrice({ key: null, field: null, value: "" })} className="text-gray-500 text-xs">X</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <span>{r.last_negotiation_price || 0}</span>
                          <Pencil className="w-3 h-3 text-gray-400 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => setEditingPrice({ key: r.id, field: 'last_negotiation_price', value: r.last_negotiation_price || 0 })} />
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-xs bg-orange-50">{r.tax || 0}%</td>
                    <td className="p-2">{r.specification}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(r)}
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        {userRole === 'SUPERADMIN' && (
                          <button
                            onClick={() => handleDeleteSpare(r.id)}
                            disabled={deletingSpare}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                </tr>
              );
            })}

            {view.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan={15}>
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
          const key = (r.spare_number || r.item_name) + "_" + idx;
          const imageUrl = r.image;

          return (
            <div key={key} className="border rounded-lg p-3 shadow-sm bg-white">

              {/* TOP: IMAGE + NAME */}
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <img src={imageUrl} className="w-14 h-14 object-cover rounded" />
                ) : (
                  <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">
                    No Image
                  </div>
                )}

                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">{r.item_name}</div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleEditClick(r)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    {userRole === 'SUPERADMIN' && (
                      <button
                        onClick={() => handleDeleteSpare(r.id)}
                        disabled={deletingSpare}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* DETAILS */}
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                <p><span className="font-semibold">Spare No:</span> {r.spare_number}</p>
                <p><span className="font-semibold">Min Qty:</span> {r.min_qty}</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Price:</span>
                  {editingPrice.key === r.id && editingPrice.field === 'price' ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="number"
                        className="w-20 border rounded px-1 text-xs"
                        value={editingPrice.value}
                        onChange={(e) => setEditingPrice(prev => ({ ...prev, value: e.target.value }))}
                      />
                      <button disabled={savingPrice} onClick={() => handleSavePrice(r, 'price')} className="text-green-600 text-xs">Save</button>
                      <button disabled={savingPrice} onClick={() => setEditingPrice({ key: null, field: null, value: "" })} className="text-gray-500 text-xs">X</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{r.price || 0}</span>
                      <Pencil className="w-3 h-3 text-gray-400 cursor-pointer" onClick={() => setEditingPrice({ key: r.id, field: 'price', value: r.price || 0 })} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Last Neg. Price:</span>
                  {editingPrice.key === r.id && editingPrice.field === 'last_negotiation_price' ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="number"
                        className="w-20 border rounded px-1 text-xs"
                        value={editingPrice.value}
                        onChange={(e) => setEditingPrice(prev => ({ ...prev, value: e.target.value }))}
                      />
                      <button disabled={savingPrice} onClick={() => handleSavePrice(r, 'last_negotiation_price')} className="text-green-600 text-xs">Save</button>
                      <button disabled={savingPrice} onClick={() => setEditingPrice({ key: null, field: null, value: "" })} className="text-gray-500 text-xs">X</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{r.last_negotiation_price || 0}</span>
                      <Pencil className="w-3 h-3 text-gray-400 cursor-pointer" onClick={() => setEditingPrice({ key: r.id, field: 'last_negotiation_price', value: r.last_negotiation_price || 0 })} />
                    </div>
                  )}
                </div>
                <p><span className="font-semibold">Specification:</span> {r.specification}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT MODAL */}
      {isModalOpen && editingSpare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit Spare</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingSpare(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Spare Number */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Spare No</label>
                <input
                  type="text"
                  value={editingSpare.spare_number || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, spare_number: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Item Name */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingSpare.item_name || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, item_name: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Type */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Type</label>
                <select
                  value={editingSpare.type || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, type: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  <option value="Raw Materials">Raw Materials</option>
                  <option value="Consumables">Consumables</option>
                  <option value="Spares">Spares</option>
                </select>
              </div>
              {/* Make */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Make</label>
                <input
                  type="text"
                  value={editingSpare.make || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, make: e.target.value })}
                  placeholder="e.g., Siemens"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Model */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={editingSpare.model || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, model: e.target.value })}
                  placeholder="e.g., 6ES7 214-1AG40-0XB0"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Compatible Machines */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Compatible Machines</label>
                
                {/* Searchable Dropdown */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={machineSearch}
                    onChange={(e) => {
                      setMachineSearch(e.target.value);
                      setShowMachineDropdown(true);
                    }}
                    onFocus={() => setShowMachineDropdown(true)}
                    placeholder="Search by product name or code (e.g., Scrubber, DSC-30)..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />

                  {/* Dropdown list */}
                  {showMachineDropdown && machineSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.slice(0, 20).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addMachineToModal(product)}
                            className="w-full text-left px-4 py-3 border-b hover:bg-blue-50 transition-colors duration-150 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">
                                {product.item_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                Product #: {product.product_number}
                              </div>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full ml-2">
                              Add
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          No products found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected machines display */}
                <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-12">
                  {String(editingSpare.compatible_machine || "")
                    .split(",")
                    .map((machine, idx) => machine.trim())
                    .filter((m) => m)
                    .map((machine, idx) => {
                      const displayCode = productMap[machine] || machine;
                      return (
                        <span
                          key={idx}
                          className="flex items-center px-3 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                        >
                          {displayCode}
                          <button
                            type="button"
                            onClick={() => {
                              const machines = String(editingSpare.compatible_machine || "")
                                .split(",")
                                .map(m => m.trim())
                                .filter(m => m && m !== machine)
                                .join(", ");
                              setEditingSpare({ ...editingSpare, compatible_machine: machines });
                            }}
                            className="ml-2 text-blue-500 hover:text-blue-700 font-bold"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  {!String(editingSpare.compatible_machine || "").trim() && (
                    <p className="text-xs text-gray-500 py-2">No machines selected yet</p>
                  )}
                </div>
              </div>
              {/* Min Qty */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Min Qty</label>
                <input
                  type="number"
                  value={editingSpare.min_qty || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, min_qty: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              {/* Price */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Purchase Price</label>
                <input
                  type="number"
                  value={editingSpare.purchase_price || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, purchase_price: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  step="0.01"
                />
              </div>
              {/* Sale Price */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Sale Price</label>
                <input
                  type="number"
                  value={editingSpare.sale_price || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, sale_price: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  step="0.01"
                />
              </div>
              {/* Tax */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Tax %</label>
                <input
                  type="number"
                  value={editingSpare.tax || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, tax: e.target.value })}
                  placeholder="e.g., 18"
                  className="w-full border rounded px-3 py-2 text-sm"
                  step="0.01"
                />
              </div>
              {/* Last Negotiation Price */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Last Neg. Price</label>
                <input
                  type="number"
                  value={editingSpare.last_negotiation_price || 0}
                  onChange={(e) => setEditingSpare({ ...editingSpare, last_negotiation_price: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  step="0.01"
                />
              </div>
              {/* Specification */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Specification</label>
                <textarea
                  value={editingSpare.specification || ""}
                  onChange={(e) => setEditingSpare({ ...editingSpare, specification: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  rows={4}
                />
              </div>
              {/* Image Upload */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Image</label>
                {editingSpare.image && (
                  <img
                    src={editingSpare.image}
                    className="w-24 h-24 object-cover rounded mb-2"
                    alt="Current"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setEditingSpare({
                        ...editingSpare,
                        newImageFile: file,
                        imagePreview: URL.createObjectURL(file)
                      });
                    }
                  }}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                {editingSpare.imagePreview && (
                  <img
                    src={editingSpare.imagePreview}
                    className="w-24 h-24 object-cover rounded mt-2"
                    alt="Preview"
                  />
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingSpare(null);
                }}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSpare}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function SpareStockPage() {
  const [availableData, setAvailableData] = useState([]);
  const [txData, setTxData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);

  const [availableSearch, setAvailableSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [summarySearch, setSummarySearch] = useState("");
  const [txStatusFilter, setTxStatusFilter] = useState(null);
  const [summaryStatusFilter, setSummaryStatusFilter] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const [openSection, setOpenSection] = useState("list");
  const [editingLocation, setEditingLocation] = useState({ key: null, value: "" });
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    fetch("/api/spare/available-stock").then(r => r.json()).then(d => setAvailableData(Array.isArray(d) ? d : [])).catch(() => setAvailableData([]));
    fetch("/api/spare/modelsummary").then(r => r.json()).then(setTxData).catch(() => setTxData([]));
    fetch("/api/spare/modelsummaryspare").then(r => r.json()).then(setSummaryData).catch(() => setSummaryData([]));
  }, []);

  const handleSaveLocation = async (row) => {
    if (!editingLocation.key || savingLocation) return;
    try {
      setSavingLocation(true);
      const res = await fetch("/api/stock/update-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "spare",
          code: row.spare_id,
          location: editingLocation.value || "",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        console.error("Failed to update location", data.error || data.message);
        return;
      }
      setAvailableData((prev) =>
        Array.isArray(prev)
          ? prev.map((r) =>
            r.spare_id === row.spare_id
              ? { ...r, location: editingLocation.value || "" }
              : r
          )
          : prev
      );
      setEditingLocation({ key: null, value: "" });
    } catch (e) {
      console.error("Error updating location", e);
    } finally {
      setSavingLocation(false);
    }
  };

  function getFileType(url) {
    const ext = String(url || "").split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "unknown";
  }

  const filteredAvailable = useMemo(() => {
    const rows = Array.isArray(availableData) ? [...availableData] : [];
    if (!availableSearch) return rows;
    return rows.filter((item) => Object.values(item).some((v) => String(v ?? "").toLowerCase().includes(availableSearch.toLowerCase())));
  }, [availableData, availableSearch]);

  const filteredTx = useMemo(() => {
    let rows = Array.isArray(txData) ? [...txData] : [];
    if (txStatusFilter) rows = rows.filter((r) => String(r.stock_status || "").toUpperCase() === txStatusFilter);
    if (txSearch) rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(txSearch.toLowerCase())));
    return rows;
  }, [txData, txSearch, txStatusFilter]);

  const filteredSummary = useMemo(() => {
    let rows = Array.isArray(summaryData) ? [...summaryData] : [];
    if (summaryStatusFilter) rows = rows.filter((r) => String(r.stock_status || "").toLowerCase() === summaryStatusFilter.toLowerCase());
    if (summarySearch) rows = rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(summarySearch.toLowerCase())));
    return rows;
  }, [summaryData, summarySearch, summaryStatusFilter]);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Spare Stock Management</h2>
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const pathname = usePathname(); const isAdmin = pathname?.startsWith('/admin-dashboard'); const addHref = `${isAdmin ? '/admin-dashboard' : '/user-dashboard'}/add-spare`; return (
              <Link href={addHref} className="text-sm px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700">Add New Spare</Link>
            );
          })()}
          <button onClick={() => setOpenSection("list")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "list" ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"}`}>List</button>
          <button onClick={() => setOpenSection("available")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "available" ? "bg-teal-600" : "bg-teal-500 hover:bg-teal-600"}`}>Available Stock</button>
          <button onClick={() => setOpenSection("transactions")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "transactions" ? "bg-indigo-600" : "bg-gray-500 hover:bg-gray-600"}`}>Stock Transactions</button>
          <button onClick={() => setOpenSection("summary")} className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "summary" ? "bg-pink-600" : "bg-gray-500 hover:bg-gray-600"}`}>Stock Summary</button>
        </div>
      </div>

      {/* List Section (Spare) */}
      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "list" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "list" ? null : "list")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">List</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "list" ? "−" : "+"}</span>
        </div>
        {openSection === "list" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <SpareList />
          </div>
        )}
      </div>

      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "available" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "available" ? null : "available")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Available Stock</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "available" ? "−" : "+"}</span>
        </div>
        {openSection === "available" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={availableSearch} onChange={(e) => setAvailableSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full" />
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredAvailable.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">No stock data available</p>
              ) : (
                filteredAvailable.map((row, idx) => (
                  <div
                    key={(row.spare_number || "spare") + "_" + idx}
                    className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Spare Number</p>
                        <p className="text-sm font-semibold text-gray-800">{row.spare_number}</p>
                      </div>
                      <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded">
                        {row.spare_image ? (
                          <img
                            src={row.spare_image}
                            alt={row.spare_name || "Spare"}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <span className="text-[11px] text-gray-400">No image</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Spare Name</p>
                        <p className="font-medium text-gray-800 break-words">{row.spare_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Qty</p>
                        <p className="font-semibold text-gray-900">{row.total}</p>
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
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Storage Location</p>
                      {editingLocation.key === row.spare_id ? (
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
                            onClick={() => setEditingLocation({ key: null, value: "" })}
                            disabled={savingLocation}
                            className="px-2 py-1 text-[11px] bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.location || "--"}</span>
                          <button
                            onClick={() =>
                              setEditingLocation({
                                key: row.spare_id,
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
                    <div className="mt-1 text-[11px] text-gray-500">
                      Updated: {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto mt-3">
              <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-2 sm:p-3 border-b">Spare Number</th>
                    <th className="p-2 sm:p-3 border-b">Spare Image</th>
                    <th className="p-2 sm:p-3 border-b">Spare Name</th>
                    <th className="p-2 sm:p-3 border-b">Total Qty</th>
                    <th className="p-2 sm:p-3 border-b">Delhi Godown</th>
                    <th className="p-2 sm:p-3 border-b">South Godown</th>
                    <th className="p-2 sm:p-3 border-b">Storage Location</th>
                    <th className="p-2 sm:p-3 border-b">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailable.length === 0 ? (
                    <tr><td colSpan="8" className="p-4 text-center text-gray-500">No stock data available</td></tr>
                  ) : (
                    filteredAvailable.map((row, idx) => (
                      <tr key={(row.spare_number || "spare") + "_" + idx} className="border-t hover:bg-gray-50">
                        <td className="p-2 sm:p-3">{row.spare_number}</td>
                        <td className="p-2 sm:p-3">{row.spare_image ? (<img src={row.spare_image} alt={row.spare_name || "Spare"} className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded" />) : (<span className="text-gray-400">No image</span>)}</td>
                        <td className="p-2 sm:p-3">{row.spare_name}</td>
                        <td className="p-2 sm:p-3 font-semibold">{row.total}</td>
                        <td className="p-2 sm:p-3">{row.delhi}</td>
                        <td className="p-2 sm:p-3">{row.south}</td>
                        <td className="p-2 sm:p-3">
                          {editingLocation.key === row.spare_id ? (
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
                                onClick={() => setEditingLocation({ key: null, value: "" })}
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
                                    key: row.spare_id,
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
                        <td className="p-2 sm:p-3 whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "transactions" ? "" : "hidden"}`}>
        <div className="flex items-center justify_between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "transactions" ? null : "transactions")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Stock Transactions</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "transactions" ? "−" : "+"}</span>
        </div>
        {openSection === "transactions" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={txSearch} onChange={(e) => setTxSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTxStatusFilter("IN")} className={`px-3 py-1.5 text-xs sm:text-sm rounded ${txStatusFilter === "IN" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>IN</button>
                <button onClick={() => setTxStatusFilter("OUT")} className={`px-3 py-1.5 text-xs sm:text-sm rounded ${txStatusFilter === "OUT" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>OUT</button>
                <button onClick={() => setTxStatusFilter(null)} className={`px-3 py-1.5 text-xs sm:text-sm rounded ${txStatusFilter === null ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>All</button>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredTx.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">No stock transactions available</p>
              ) : (
                filteredTx.map((row, idx) => (
                  <div
                    key={(row.spare_id || "spare") + "_" + idx}
                    className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                  >
                    <div className="grid grid-cols-2 gap-3 text-xs">

                      <div>
                        <p className="text-gray-500">Spare ID</p>
                        <p className="font-semibold text-gray-800">{row.spare_id}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Spare Number</p>
                        <p className="font-medium text-gray-800">{row.spare_number}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-gray-500">Spare Name</p>
                        <p className="font-medium text-gray-800 break-words">{row.spare_name}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Latest Qty</p>
                        <p className="font-semibold text-gray-900">{row.quantity}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">From Company</p>
                        <p className="font-medium text-gray-800">{row.from_company || "--"}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-gray-500">Location</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.location || "--"}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-gray-500">Godown</p>
                        <p className="font-medium">{row.godown || "--"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Added By</p>
                        <p className="font-medium">{row.added_by || "--"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Sold To</p>
                        <p className="font-medium">{row.to_company || "--"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Sold Address</p>
                        <p className="font-medium break-words">{row.delivery_address || "--"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Net Amount</p>
                        <p className="font-medium">{row.net_amount}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Status</p>
                        <p className={`font-semibold ${row.stock_status === "IN" ? "text-green-600" : "text-red-600"}`}>
                          {row.stock_status}
                        </p>
                      </div>

                    </div>

                    <div className="mt-2 text-[11px] text-gray-500">
                      Updated: {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
                    </div>

                    <div className="mt-1">
                      {row.supporting_file ? (
                        <button
                          onClick={() =>
                            setPreviewFile({
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
                        <span className="text-gray-400 text-xs">No File</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto mt-3">
              <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-2 border-b">Spare ID</th>
                    <th className="p-2 border-b">Spare Number</th>
                    <th className="p-2 border-b">Spare Name</th>
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
                  {filteredTx.map((row, idx) => (
                    <tr key={(row.spare_id || "spare") + "_" + idx} className="border-t">
                      <td className="p-2 align-top">{row.spare_id}</td>
                      <td className="p-2 align-top">{row.spare_number}</td>
                      <td className="p-2 align-top">{row.spare_name}</td>
                      <td className="p-2 align-top">{row.quantity}</td>
                      <td className="p-2 align-top">{row.from_company || "--"}</td>
                      <td className="p-2 align-top">{row.location || "--"}</td>
                      <td className="p-2 align-top">{row.godown || "--"}</td>
                      <td className="p-2 align-top">{row.added_by || "--"}</td>
                      <td className="p-2 align-top">{row.to_company || "--"}</td>
                      <td className="p-2 align-top">{row.delivery_address || "--"}</td>
                      <td className="p-2 align-top">{row.net_amount}</td>
                      <td className="p-2 align-top"><span className={`font-semibold ${row.stock_status === "IN" ? "text-green-600" : "text-red-600"}`}>{row.stock_status}</span></td>
                      <td className="p-2 align-top whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                      <td className="p-2 text-center align-top">
                        {row.supporting_file ? (
                          <button onClick={() => setPreviewFile({ url: row.supporting_file, type: getFileType(row.supporting_file) })} className="text-gray-600 hover:text-blue-700">
                            <Eye className="w-5 h-5 inline" />
                          </button>
                        ) : (<span className="text-gray-400">--</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>

      <div className={`bg-white border rounded-lg shadow-sm mt-6 ${openSection === "summary" ? "" : "hidden"}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenSection(openSection === "summary" ? null : "summary")}>
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Stock Summary (Spare)</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "summary" ? "−" : "+"}</span>
        </div>
        {openSection === "summary" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input type="text" placeholder="Search..." value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} className="pl-8 pr-3 py-1.5 border rounded-md text-xs sm:text-sm w-full" />
              </div>
              <button onClick={() => setSummaryStatusFilter("IN")} className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "IN" ? "bg-blue-700 text-white" : "bg-gray-200 text-black"}`}>IN</button>
              <button onClick={() => setSummaryStatusFilter("OUT")} className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "OUT" ? "bg-blue-700 text-white" : "bg-gray-200 text-black"}`}>OUT</button>
              <button onClick={() => setSummaryStatusFilter(null)} className="px-3 py-1.5 rounded-md text-xs sm:text-sm bg-gray-100">Reset</button>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3 mt-3">
              {filteredSummary.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">No stock summary available</p>
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
                          <p className="text-[11px] text-gray-500">Spare Number</p>
                          <p className="text-sm font-semibold text-gray-800">{row.spare_number}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-500">Spare Name</p>
                          <p className="text-sm font-medium text-gray-800 break-words">{row.item_name}</p>
                        </div>
                      </div>

                      {/* Qty Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                        <div>
                          <p className="text-gray-500">Min Qty</p>
                          <p className="font-semibold text-gray-900">{row.min_qty ?? "--"}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Quantity</p>
                          <p className="font-semibold text-gray-900">{row.total_quantity}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Delhi</p>
                          <p className="font-medium text-gray-800">{row.Delhi ?? row.delhi}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">South</p>
                          <p className="font-medium text-gray-800">{row.South ?? row.south}</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="mt-2">
                        <p className="text-[11px] text-gray-500">Last Status</p>
                        <span
                          className={`font-semibold text-sm ${status === "IN"
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
                        Updated: {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto mt-3">
              <table className="min-w-full text-xs sm:text-sm border border-gray-200 rounded">
                <thead className="bg-gray-100 text-left text-[11px] sm:text-xs">
                  <tr>
                    <th className="p-2 border-b">Spare Number</th>
                    <th className="p-2 border-b">Spare Name</th>
                    <th className="p-2 border-b">Min Qty</th>
                    <th className="p-2 border-b">Total Quantity</th>
                    <th className="p-2 border-b">Delhi</th>
                    <th className="p-2 border-b">South</th>
                    <th className="p-2 border-b">Last Status</th>
                    <th className="p-2 border-b">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((row, idx) => {
                    const status = row.last_status || row.stock_status || '';
                    return (
                      <tr key={(row.spare_id || "spare") + "_" + idx} className="border-t">
                        <td className="p-2">{row.spare_number}</td>
                        <td className="p-2">{row.item_name}</td>
                        <td className="p-2">{row.min_qty ?? ''}</td>
                        <td className="p-2">{row.total_quantity}</td>
                        <td className="p-2">{row.Delhi ?? row.delhi}</td>
                        <td className="p-2">{row.South ?? row.south}</td>
                        <td className="p-2">
                          <span className={`font-semibold ${status === 'IN' ? 'text-green-600' : status === 'OUT' ? 'text-red-600' : 'text-gray-700'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">{row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60" onClick={() => setPreviewFile(null)}>
          <div className="bg-white p-4 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2"><h4 className="font-semibold">Preview</h4><button onClick={() => setPreviewFile(null)}>✕</button></div>
            {previewFile.type === "image" ? (
              <img src={previewFile.url} alt="Preview" className="max-h-[70vh] object-contain mx-auto" />
            ) : previewFile.type === "pdf" ? (
              <iframe src={previewFile.url} title="PDF Preview" className="w-full h-[70vh]" />
            ) : (
              <p className="text-red-500 text-center mt-4">Cannot preview this file type.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
