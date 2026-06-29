"use client";

import { useEffect, useState, useMemo } from "react";
import { Eye, Search, Pencil, ArrowRightLeft, History, X } from "lucide-react";
import Link from "next/link";
import { pickProductImageUrl } from "@/lib/productImageUrl";


function ProductAndSpareLists({ type }) {
  const [rows, setRows] = useState([]);
  const [stockTotals, setStockTotals] = useState({ totalQty: 0, totalValue: 0 });
  const [q, setQ] = useState("");
  const [editingPrice, setEditingPrice] = useState({ key: null, field: null, value: "" });
  const [savingPrice, setSavingPrice] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [showSparesModal, setShowSparesModal] = useState(false);
  const [selectedProductSpares, setSelectedProductSpares] = useState([]);
  const [allSpares, setAllSpares] = useState([]);
  const [sparesSearchQuery, setSparesSearchQuery] = useState("");
  const [sparesTypeFilter, setSparesTypeFilter] = useState("all");
  const [editFormData, setEditFormData] = useState({
    item_code: '',
    item_name: '',
    product_number: '',
    min_qty: '',
    price_per_unit: '',
    last_negotiation_price: '',
    specification: '',
    image: null,
    productImages: [] // To store all product images
  });

  const refreshProducts = () => {
    const url = type === 'product' ? '/api/products/list' : '/api/spare/list';
    fetch(url)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  };

  const handleViewSpares = (product) => {
    // Filter spares based on product/machine compatibility
    // Check multiple product identifiers
    const searchTerms = [
      String(product.product_number || '').trim(),
      String(product.item_code || '').trim(),
      String(product.item_name || '').trim()
    ].filter(term => term !== '');
    
    console.log('=== SPARES MATCHING DEBUG ===');
    console.log('Product:', product);
    console.log('Search terms:', searchTerms);
    console.log('Total spares loaded:', allSpares.length);
    console.log('All spares:', allSpares);
    
    // Filter spares that have compatible_machine matching this product
    const compatibleSpares = allSpares.filter(spare => {
      if (!spare.compatible_machine) {
        console.log('Spare skipped (no compatible_machine):', spare.item_name);
        return false;
      }
      
      // Handle JSON array or comma-separated string
      try {
        const machines = typeof spare.compatible_machine === 'string' 
          ? spare.compatible_machine.split(',').map(m => m.trim().toLowerCase())
          : Array.isArray(spare.compatible_machine) 
            ? spare.compatible_machine.map(m => String(m).toLowerCase())
            : [];
        
        console.log(`Spare: ${spare.item_name}, Compatible machines:`, machines);
        
        // Check if any machine matches any search term
        const isMatch = machines.some(machine => 
          searchTerms.some(term => {
            const termLower = term.toLowerCase();
            const matches = machine.includes(termLower) || termLower.includes(machine);
            if (matches) {
              console.log(`MATCH FOUND: "${machine}" <-> "${termLower}"`);
            }
            return matches;
          })
        );
        return isMatch;
      } catch (e) {
        console.error('Error matching spare:', spare, e);
        return false;
      }
    });
    
    console.log('Compatible spares found:', compatibleSpares.length);
    console.log('=== END DEBUG ===');
    setSelectedProductSpares(compatibleSpares);
    setShowSparesModal(true);
  };

  const handleSavePrice = async (row, field) => {
    const code = type === 'product' ? row.item_code : row.id;
    if (!code || savingPrice) return;

    try {
      setSavingPrice(true);
      const res = await fetch("/api/stock/update-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
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
        const key = type === 'product' ? r.item_code : r.id;
        if (key === code) {
          const targetField = field === 'price' ? (type === 'product' ? 'price_per_unit' : 'price') : 'last_negotiation_price';
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

  const handleOpenEditModal = (row) => {
    setEditingProduct(row);
    // Get all images - use row.images if available, otherwise create an array with single image
    const images = row.images || (row.image_path ? [row.image_path] : []);
    setEditFormData({
      item_code: row.item_code || '',
      item_name: row.item_name || '',
      product_number: row.product_number || '',
      min_qty: row.min_qty || '',
      price_per_unit: row.price_per_unit || row.price || '',
      last_negotiation_price: row.last_negotiation_price || '',
      specification: row.specification || '',
      image: null,
      productImages: images
    });
    setShowEditModal(true);
  };

  const handleDeleteImage = async (imagePath) => {
    if (!editingProduct || deletingImage) return;
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      setDeletingImage(true);
      const res = await fetch("/api/products/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code: editFormData.item_code,
          image_path: imagePath
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete image");
        return;
      }

      // Update local state
      setEditFormData(prev => ({
        ...prev,
        productImages: prev.productImages.filter(img => img !== imagePath)
      }));

      // Refresh the product list
      refreshProducts();

      alert("Image deleted successfully");
    } catch (err) {
      console.error(err);
      alert("Error deleting image");
    } finally {
      setDeletingImage(false);
    }
  };

  const handleDeleteProduct = async (itemCode) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

    try {
      setDeletingProduct(true);
      const res = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_code: itemCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete product");
        return;
      }

      // Refresh the product list
      refreshProducts();

      alert("Product deleted successfully");
    } catch (err) {
      console.error(err);
      alert("Error deleting product");
    } finally {
      setDeletingProduct(false);
    }
  };

  const handleDeleteSpare = async (id) => {
    if (!confirm('Are you sure you want to delete this spare? This action cannot be undone.')) return;

    try {
      setDeletingProduct(true);
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
      refreshProducts();

      alert("Spare deleted successfully");
    } catch (err) {
      console.error(err);
      alert("Error deleting spare");
    } finally {
      setDeletingProduct(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct || savingProduct) return;

    try {
      setSavingProduct(true);
      const formData = new FormData();
      formData.append('item_code', editFormData.item_code);
      formData.append('item_name', editFormData.item_name);
      formData.append('product_number', editFormData.product_number);
      formData.append('min_qty', editFormData.min_qty);
      formData.append('price_per_unit', editFormData.price_per_unit);
      formData.append('last_negotiation_price', editFormData.last_negotiation_price);
      formData.append('specification', editFormData.specification);
      if (editFormData.image) {
        formData.append('image', editFormData.image);
      }

      const res = await fetch("/api/products/update", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to update product");
        return;
      }

      // Refresh the data
      refreshProducts();

      setShowEditModal(false);
      setEditingProduct(null);
      alert("Product updated successfully");
    } catch (err) {
      console.error(err);
      alert("Error updating product");
    } finally {
      setSavingProduct(false);
    }
  };

  useEffect(() => {
    // Fetch user role
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUserRole(d.userRole))
      .catch(() => setUserRole(""));
      
    const url = type === 'product' ? '/api/products/list' : '/api/spare/list';
    fetch(url)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));

    // Load all spares for compatibility check
    if (type === 'product') {
      fetch('/api/spare/list')
        .then(r => r.json())
        .then(d => setAllSpares(Array.isArray(d) ? d : []))
        .catch(() => setAllSpares([]));
    }

    // Fetch actual stock totals
    if (type === 'product') {
      fetch('/api/stock/total-value')
        .then(r => r.json())
        .then(d => setStockTotals({ totalQty: d.totalQty || 0, totalValue: d.totalValue || 0 }))
        .catch(() => setStockTotals({ totalQty: 0, totalValue: 0 }));
    } else {
      fetch('/api/spare/total-value')
        .then(r => r.json())
        .then(d => setStockTotals({ totalQty: d.totalQty || 0, totalValue: d.totalValue || 0 }))
        .catch(() => setStockTotals({ totalQty: 0, totalValue: 0 }));
    }
  }, [type]);

  const view = useMemo(() => {
    const qt = q.trim().toLowerCase();
    if (!qt) return rows;
    return rows.filter(r =>
      Object.values(r).some(v => String(v ?? '').toLowerCase().includes(qt))
    );
  }, [rows, q]);

  const totalMinQty = rows.reduce((sum, row) => sum + (row.min_qty || 0), 0);
  const totalPrice = rows.reduce((sum, row) => sum + ((row.min_qty || 0) * (row.price_per_unit || row.price || 0)), 0);

  return (
    <div className="border rounded-lg">

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-4 p-4 border-b bg-gray-50">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="text-sm font-medium text-blue-600">Total Stock Qty</div>
          <div className="text-2xl font-bold text-blue-800">{totalMinQty.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="text-sm font-medium text-green-600">Total Stock Value</div>
          <div className="text-2xl font-bold text-green-800">₹{totalPrice.toLocaleString()}</div>
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

      {/* DESKTOP TABLE VIEW */}
      <div className="overflow-auto hidden sm:block">
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              {type === 'product' ? (
                <>
                  <th className="p-2 text-left">Image</th>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Product No</th>
                  <th className="p-2 text-left">Min Qty</th>
                  <th className="p-2 text-left">Price</th>
                  <th className="p-2 text-left">Last Neg. Price</th>
                  <th className="p-2 text-left">Specification</th>
                  <th className="p-2 text-left">Spares</th>
                  <th className="p-2 text-left">Actions</th>
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
                  <th className="p-2 text-left">Actions</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {view.map((r, idx) => {
              const key = (r.item_code || r.spare_number || r.item_name || "row") + "_" + idx;
              const imageUrl = type === "product" ? pickProductImageUrl(r.image_path, r.product_image) : r.image;

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

                    {type === "product" ? (
                      <>
                        <td className="p-2">{r.item_code}</td>
                        <td className="p-2">{r.item_name}</td>
                        <td className="p-2">{r.product_number}</td>
                        <td className="p-2">{r.min_qty}</td>
                        <td className="p-2">
                          {editingPrice.key === r.item_code && editingPrice.field === 'price' ? (
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
                            <div className="flex items-center gap-2 group">
                              <span>{r.price_per_unit || 0}</span>
                              <Pencil className="w-3 h-3 text-gray-400 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => setEditingPrice({ key: r.item_code, field: 'price', value: r.price_per_unit || 0 })} />
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          {editingPrice.key === r.item_code && editingPrice.field === 'last_negotiation_price' ? (
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
                              <Pencil className="w-3 h-3 text-gray-400 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => setEditingPrice({ key: r.item_code, field: 'last_negotiation_price', value: r.last_negotiation_price || 0 })} />
                            </div>
                          )}
                        </td>
                        <td className="p-2">{r.specification}</td>
                        <td className="p-2">
                          <button
                            onClick={() => handleViewSpares(r)}
                            className="p-1 hover:bg-blue-100 rounded"
                            title="View compatible spares"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenEditModal(r)}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Edit
                            </button>
                            {/* Delete product button hidden
                            {userRole === 'SUPERADMIN' && (
                              <button
                                onClick={() => handleDeleteProduct(r.item_code)}
                                disabled={deletingProduct}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                            */}
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-2">{r.spare_number}</td>
                        <td className="p-2">{r.item_name}</td>
                        <td className="p-2">{r.min_qty}</td>
                        <td className="p-2">
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
                            <div className="flex items-center gap-2 group">
                              <span>{r.price || 0}</span>
                              <Pencil className="w-3 h-3 text-gray-400 cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => setEditingPrice({ key: r.id, field: 'price', value: r.price || 0 })} />
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
                        <td className="p-2">{r.specification}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenEditModal(r)}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Edit
                            </button>
                            {/* Delete spare button hidden
                            {userRole === 'SUPERADMIN' && (
                              <button
                                onClick={() => handleDeleteSpare(r.id)}
                                disabled={deletingProduct}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                            */}
                          </div>
                        </td>
                      </>
                    )}
                  </>
                </tr>
              );
            })}

            {view.length === 0 && (
              <tr>
                <td className="p-2 text-gray-500" colSpan={type === "product" ? 10 : 8}>
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
          const key = (r.item_code || r.spare_number || r.item_name) + "_" + idx;
          const imageUrl = type === "product"
            ? pickProductImageUrl(r.image_path, r.product_image)
            : r.image;

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

                <div className="text-sm font-semibold text-gray-800">
                  {r.item_name}
                </div>
              </div>

              {/* DETAILS */}
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                {type === "product" ? (
                  <>
                    <p><span className="font-semibold">Code:</span> {r.item_code}</p>
                    <p><span className="font-semibold">Product No:</span> {r.product_number}</p>
                    <p><span className="font-semibold">Min Qty:</span> {r.min_qty}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Price:</span>
                      {editingPrice.key === r.item_code && editingPrice.field === 'price' ? (
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
                          <span>{r.price_per_unit || 0}</span>
                          <Pencil className="w-3 h-3 text-gray-400 cursor-pointer" onClick={() => setEditingPrice({ key: r.item_code, field: 'price', value: r.price_per_unit || 0 })} />
                        </div>
                      )}
                    </div>
                    {/* Mobile Edit for Last Neg Price */}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Last Neg. Price:</span>
                      {editingPrice.key === r.item_code && editingPrice.field === 'last_negotiation_price' ? (
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
                          <Pencil className="w-3 h-3 text-gray-400 cursor-pointer" onClick={() => setEditingPrice({ key: r.item_code, field: 'last_negotiation_price', value: r.last_negotiation_price || 0 })} />
                        </div>
                      )}
                    </div>
                    <p><span className="font-semibold">Specification:</span> {r.specification}</p>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <div className="mt-2 pt-2 border-t space-y-2">
                  {type === 'product' && (
                    <button
                      onClick={() => handleViewSpares(r)}
                      className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 w-full flex items-center justify-center gap-2"
                      title="View compatible spares"
                    >
                      <Eye className="w-4 h-4" />
                      View Spares
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEditModal(r)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 w-full"
                  >
                    Edit
                  </button>
                  {/* Delete product button hidden
                  {type === 'product' && userRole === 'SUPERADMIN' && (
                    <button
                      onClick={() => handleDeleteProduct(r.item_code)}
                      disabled={deletingProduct}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 w-full disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                  {type === 'spare' && userRole === 'SUPERADMIN' && (
                    <button
                      onClick={() => handleDeleteSpare(r.id)}
                      disabled={deletingProduct}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 w-full disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                  */}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT MODAL */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Edit {type === 'product' ? 'Product' : 'Spare'}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
                
                {/* Display all existing images */}
                {type === 'product' && editFormData.productImages.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {editFormData.productImages.map((imgUrl, idx) => {
                      const fullUrl = imgUrl.startsWith('http') ? imgUrl : imgUrl;
                      return (
                        <div key={idx} className="relative">
                          <img
                            src={fullUrl}
                            alt={`Product image ${idx + 1}`}
                            className="w-24 h-24 object-cover rounded border"
                          />
                          {userRole === 'SUPERADMIN' && (
                            <button
                              onClick={() => handleDeleteImage(imgUrl)}
                              disabled={deletingImage}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add new image */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditFormData({ ...editFormData, image: e.target.files[0] })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {type === 'product' ? 'Code' : 'Spare No'}
                </label>
                <input
                  type="text"
                  value={editFormData.item_code}
                  onChange={(e) => setEditFormData({ ...editFormData, item_code: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  disabled={type === 'product'} // Code should not be editable for products
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editFormData.item_name}
                  onChange={(e) => setEditFormData({ ...editFormData, item_name: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>

              {/* Product Number (only for products) */}
              {type === 'product' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product No</label>
                  <input
                    type="text"
                    value={editFormData.product_number}
                    onChange={(e) => setEditFormData({ ...editFormData, product_number: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              )}

              {/* Min Qty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Qty</label>
                <input
                  type="number"
                  value={editFormData.min_qty}
                  onChange={(e) => setEditFormData({ ...editFormData, min_qty: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  value={editFormData.price_per_unit}
                  onChange={(e) => setEditFormData({ ...editFormData, price_per_unit: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>

              {/* Last Negotiation Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Neg. Price</label>
                <input
                  type="number"
                  value={editFormData.last_negotiation_price}
                  onChange={(e) => setEditFormData({ ...editFormData, last_negotiation_price: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>

              {/* Specification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specification</label>
                <textarea
                  value={editFormData.specification}
                  onChange={(e) => setEditFormData({ ...editFormData, specification: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                disabled={savingProduct}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={savingProduct}
              >
                {savingProduct ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spares Modal */}
      {showSparesModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-800">Compatible Spares</h2>
              <button
                onClick={() => {
                  setShowSparesModal(false);
                  setSparesSearchQuery("");
                  setSparesTypeFilter("all");
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="p-3 border-b bg-gray-50 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search spares by name, number..."
                  value={sparesSearchQuery}
                  onChange={(e) => setSparesSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSparesTypeFilter("all")}
                  className={`px-3 py-1.5 text-xs rounded transition ${
                    sparesTypeFilter === "all" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  All
                </button>
                <button 
                  onClick={() => setSparesTypeFilter("spares")}
                  className={`px-3 py-1.5 text-xs rounded transition ${
                    sparesTypeFilter === "spares" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Spares
                </button>
                <button 
                  onClick={() => setSparesTypeFilter("consumables")}
                  className={`px-3 py-1.5 text-xs rounded transition ${
                    sparesTypeFilter === "consumables" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Consumables
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {selectedProductSpares.length === 0 ? (
                <div className="text-center py-8 text-gray-500 p-4">
                  <p>No compatible spares found for this product</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Image</th>
                      <th className="p-2 text-left">Spare No</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Model</th>
                      <th className="p-2 text-left">Sale Price</th>
                      <th className="p-2 text-left">Last Neg. Price</th>
                      <th className="p-2 text-left">Specification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProductSpares
                      .filter(spare => {
                        const spareType = String(spare.type || '').toLowerCase();
                        // Exclude Raw Materials always
                        if (spareType === 'raw materials' || spareType === 'raw material') return false;
                        
                        // Filter by type button
                        if (sparesTypeFilter === "spares") {
                          return spareType === 'spares' || spareType === 'spare';
                        } else if (sparesTypeFilter === "consumables") {
                          return spareType === 'consumables' || spareType === 'consumable';
                        }
                        // "all" shows everything except raw materials
                        return true;
                      })
                      .filter(spare => {
                        // Search filter
                        if (!sparesSearchQuery.trim()) return true;
                        const q = sparesSearchQuery.toLowerCase();
                        return (
                          String(spare.item_name || '').toLowerCase().includes(q) ||
                          String(spare.spare_number || '').toLowerCase().includes(q) ||
                          String(spare.type || '').toLowerCase().includes(q)
                        );
                      })
                      .map((spare, idx) => (
                      <tr key={idx} className="border-t hover:bg-blue-50">
                        <td className="p-2">
                          {spare.image ? (
                            <img
                              src={spare.image}
                              alt={spare.item_name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <span className="text-gray-400">No image</span>
                          )}
                        </td>
                        <td className="p-2">{spare.spare_number}</td>
                        <td className="p-2 font-semibold text-gray-800">{spare.item_name}</td>
                        <td className="p-2">{spare.type || '-'}</td>
                        <td className="p-2">{spare.model || '-'}</td>
                        <td className="p-2">₹{spare.sale_price || 0}</td>
                        <td className="p-2">₹{spare.last_negotiation_price || 0}</td>
                        <td className="p-2">{spare.specification || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

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
  const [transactionsStatusFilter, setTransactionsStatusFilter] = useState(null);
  const [summaryStatusFilter, setSummaryStatusFilter] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showExportOptions, setShowExportOptions] = useState({ available: false, transactions: false, summary: false });

  // Accordion state - only one section open at a time
  const [openSection, setOpenSection] = useState("list");
  const [editingLocation, setEditingLocation] = useState({ key: null, value: "" });
  const [savingLocation, setSavingLocation] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [fromGodown, setFromGodown] = useState("");
  const [toGodown, setToGodown] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [showTransferHistoryModal, setShowTransferHistoryModal] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [transferHistoryData, setTransferHistoryData] = useState([]);
  const [loadingTransferHistory, setLoadingTransferHistory] = useState(false);



  // Fetch all data on component mount
  useEffect(() => {
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
    const ext = url.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    return "unknown";
  }

  const handleStockTransfer = async () => {
    if (!selectedProduct || !transferQuantity || !fromGodown || !toGodown) {
      alert("Please fill all fields");
      return;
    }

    if (fromGodown === toGodown) {
      alert("Source and destination godowns cannot be the same");
      return;
    }

    const quantity = parseInt(transferQuantity);
    const availableQuantity = fromGodown === "Delhi" ? selectedProduct.delhi : selectedProduct.south;
    
    if (quantity > availableQuantity) {
      alert(`Insufficient stock in ${fromGodown}. Available: ${availableQuantity}`);
      return;
    }

    try {
      setTransferring(true);
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_code: selectedProduct.product_code,
          from_godown: fromGodown,
          to_godown: toGodown,
          quantity: quantity
        })
      });
      
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        alert(data.error || "Transfer failed");
        return;
      }
      
      // Update local state
      setAvailableStockData(prev => 
        prev.map(item => 
          item.product_code === selectedProduct.product_code 
            ? { ...item, delhi: data.newDelhi, south: data.newSouth }
            : item
        )
      );
      
      alert(data.message);
      setShowTransferModal(false);
      setSelectedProduct(null);
      setTransferQuantity("");
      setFromGodown("");
      setToGodown("");
    } catch (error) {
      console.error("Transfer error:", error);
      alert("Transfer failed. Please try again.");
    } finally {
      setTransferring(false);
    }
  };

  const openTransferModal = (product) => {
    setSelectedProduct(product);
    setShowTransferModal(true);
  };

  const fetchTransferHistory = async (productCode) => {
    try {
      setLoadingTransferHistory(true);
      const res = await fetch(`/api/stock/transfer-history?product_code=${productCode}`);
      const data = await res.json();
      
      if (!res.ok || data.success === false) {
        console.error("Failed to fetch transfer history", data.error);
        alert("Failed to fetch transfer history");
        return;
      }
      
      setTransferHistoryData(data.data || []);
    } catch (error) {
      console.error("Error fetching transfer history:", error);
      alert("Error fetching transfer history");
    } finally {
      setLoadingTransferHistory(false);
    }
  };

  const openTransferHistoryModal = (product) => {
    setSelectedProductForHistory(product);
    setShowTransferHistoryModal(true);
    fetchTransferHistory(product.product_code);
  };

  // Filtered data for each section
  const filteredAvailableStock = useMemo(() => {
    const rows = Array.isArray(availableStockData) ? [...availableStockData] : [];
    return availableSearch
      ? rows.filter((item) =>
        Object.values(item).some((val) =>
          String(val ?? "").toLowerCase().includes(availableSearch.toLowerCase())
        )
      )
      : rows;
  }, [availableStockData, availableSearch]);

  const filteredTransactions = useMemo(() => {
    let filtered = stockTransactionsData;
    if (transactionsStatusFilter) {
      filtered = filtered.filter(
        (item) => item.stock_status?.toUpperCase() === transactionsStatusFilter
      );
    }
    if (transactionsSearch) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(transactionsSearch.toLowerCase())
        )
      );
    }
    return filtered;
  }, [stockTransactionsData, transactionsSearch, transactionsStatusFilter]);

  const filteredSummary = useMemo(() => {
    let filtered = Array.isArray(stockSummaryData) ? stockSummaryData : [];
    if (summaryStatusFilter) {
      filtered = filtered.filter(
        (item) => item.stock_status?.toLowerCase() === summaryStatusFilter.toLowerCase()
      );
    }
    if (summarySearch) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(summarySearch.toLowerCase())
        )
      );
    }
    return filtered;
  }, [stockSummaryData, summarySearch, summaryStatusFilter]);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Product Stock Management</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin-dashboard/add-assets" className="text-sm px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700">
            Add New Product
          </Link>
          {/* Section Toggle Buttons */}
          <button
            onClick={() => setOpenSection("list")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "list"
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-blue-500 hover:bg-blue-600"
              }`}
          >
            List
          </button>
          <button
            onClick={() => setOpenSection("available")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "available"
              ? "bg-teal-600 hover:bg-teal-700"
              : "bg-teal-500 hover:bg-teal-600"
              }`}
          >
            Available Stock
          </button>
          <button
            onClick={() => setOpenSection("transactions")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "transactions"
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "bg-gray-500 hover:bg-gray-600"
              }`}
          >
            Stock Transactions
          </button>
          <button
            onClick={() => setOpenSection("summary")}
            className={`text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded text-white ${openSection === "summary"
              ? "bg-pink-600 hover:bg-pink-700"
              : "bg-gray-500 hover:bg-gray-600"
              }`}
          >
            Stock Summary
          </button>
        </div>
      </div>

      {/* List Section (Product) */}
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "list" ? "" : "hidden"}`}>
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setOpenSection("list")}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">List</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "list" ? "−" : "+"}</span>
        </div>
        {openSection === "list" && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
            <ProductAndSpareLists type="product" />
          </div>
        )}
      </div>

      {/* Available Stock Section */}
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "available" ? "" : "hidden"}`}>
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setOpenSection("available")}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Available Stock</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "available" ? "−" : "+"}</span>
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
                <p className="text-gray-500 text-sm text-center">No stock data available</p>
              ) : (
                filteredAvailableStock.map((row, idx) => (
                  <div
                    key={(row.product_code || "product") + "_" + idx}
                    className="border rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2"
                  >
                    {/* Top Row */}
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Product Code</p>
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
                          <span className="text-[11px] text-gray-400">No image</span>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Item Name</p>
                        <p className="font-medium text-gray-800 break-words">{row.item_name}</p>
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

                    {/* Storage Location Editor */}
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Storage Location</p>

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
                      Updated: {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
                    </div>

                    {/* Transfer Buttons */}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => openTransferModal(row)}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Transfer Stock
                      </button>
                      <button
                        onClick={() => openTransferHistoryModal(row)}
                        className="flex-1 px-3 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 flex items-center justify-center gap-2"
                      >
                        <History className="w-4 h-4" />
                        Transfer History
                      </button>
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
                    <th className="p-3 border-b font-semibold">Product Code</th>
                    <th className="p-3 border-b font-semibold">Product Image</th>
                    <th className="p-3 border-b font-semibold">Item Name</th>
                    <th className="p-3 border-b font-semibold">Total Qty</th>
                    <th className="p-3 border-b font-semibold">Delhi Godown</th>
                    <th className="p-3 border-b font-semibold">South Godown</th>
                    <th className="p-3 border-b font-semibold">Storage Location</th>
                    <th className="p-3 border-b font-semibold">Updated At</th>
                    <th className="p-3 border-b font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailableStock.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-4 text-center text-gray-500">
                        No stock data available
                      </td>
                    </tr>
                  ) : (
                    filteredAvailableStock.map((row, idx) => (
                      <tr key={`${row.product_code}_${idx}`} className="border-t hover:bg-gray-50">
                        <td className="p-2 sm:p-3">{row.product_code}</td>
                        <td className="p-2 sm:p-3">
                          {row.product_image ? (
                            <img
                              src={row.product_image?.startsWith('http')
                                ? row.product_image
                                : (row.product_image?.startsWith('/') ? row.product_image : `/${row.product_image}`)}
                              alt={row.item_name || "Product"}
                              width={64}
                              height={64}
                              className="object-cover rounded w-12 h-12 sm:w-16 sm:h-16"
                            />
                          ) : (
                            <span className="text-gray-400">No image</span>
                          )}
                        </td>
                        <td className="p-2 sm:p-3">{row.item_name}</td>
                        <td className="p-2 sm:p-3 font-semibold">{row.total}</td>
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
                          {row.updated_at ? new Date(row.updated_at).toLocaleString() : ""}
                        </td>
                        <td className="p-2 sm:p-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openTransferModal(row)}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Transfer
                            </button>
                            <button
                              onClick={() => openTransferHistoryModal(row)}
                              className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 flex items-center gap-1"
                            >
                              <History className="w-3 h-3" />
                              History
                            </button>
                          </div>
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
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "transactions" ? "" : "hidden"}`}>
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setOpenSection("transactions")}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Stock Transactions</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "transactions" ? "−" : "+"}</span>
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
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded ${transactionsStatusFilter === "IN"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                  IN
                </button>
                <button
                  onClick={() => setTransactionsStatusFilter("OUT")}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded ${transactionsStatusFilter === "OUT"
                    ? "bg-red-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                  OUT
                </button>
                <button
                  onClick={() => setTransactionsStatusFilter(null)}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded ${transactionsStatusFilter === null
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
                        <p className="font-semibold text-gray-800">{row.product_code}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Product UID No</p>
                        <p className="font-medium text-gray-800 break-words">{row.product_number}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-gray-500">Item Name</p>
                        <p className="font-medium text-gray-800 break-words">{row.item_name}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Latest Qty</p>
                        <p className="font-semibold text-gray-900">{row.quantity}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">From Company</p>
                        <p className="font-medium">{row.from_company || "--"}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-gray-500">Location</p>
                        <p className="font-medium break-words">{row.location || "--"}</p>
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

                      <div className="col-span-2">
                        <p className="text-gray-500">Sold Address</p>
                        <p className="font-medium break-words">{row.delivery_address || "--"}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Net Amount</p>
                        <p className="font-medium">{row.net_amount}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Status</p>
                        <p
                          className={`font-semibold ${row.stock_status === "IN"
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
                      {row.updated_at ? new Date(row.updated_at).toLocaleString() : "--"}
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
                        <span className="text-gray-400 text-xs">No File</span>
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
                    <tr key={row.product_code + "_" + idx} className="border-t">
                      <td className="p-2 align-top">{row.product_code}</td>
                      <td className="p-2 align-top">{row.product_number}</td>
                      <td className="p-2 align-top">{row.item_name}</td>
                      <td className="p-2 align-top">{row.quantity}</td>
                      <td className="p-2 align-top">{row.from_company || "--"}</td>
                      <td className="p-2 align-top">{row.location}</td>
                      <td className="p-2 align-top">{row.godown || "--"}</td>
                      <td className="p-2 align-top">{row.added_by || "--"}</td>
                      <td className="p-2 align-top">{row.to_company || "--"}</td>
                      <td className="p-2 align-top">{row.delivery_address || "--"}</td>
                      <td className="p-2 align-top">{row.net_amount}</td>
                      <td className="p-2 align-top">
                        <span
                          className={`font-semibold ${row.stock_status === "IN"
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
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm mt-6 ${openSection === "summary" ? "" : "hidden"}`}>
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setOpenSection("summary")}
        >
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">Stock Summary</h3>
          <span className="text-xl sm:text-2xl font-bold text-gray-500">{openSection === "summary" ? "−" : "+"}</span>
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
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "IN"
                  ? "bg-blue-700 text-white"
                  : "bg-gray-200 text-black"
                  }`}
              >
                IN
              </button>
              <button
                onClick={() => setSummaryStatusFilter("OUT")}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm ${summaryStatusFilter === "OUT"
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
                    <tr key={row.product_code + "_" + idx} className="border-t">
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

      {/* Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60"
          onClick={() => setPreviewImage(null)}>
          <div className="bg-white p-4 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}>
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
      
      {/* Stock Transfer Modal */}
      {showTransferModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Transfer Stock</h3>
              <button 
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedProduct(null);
                  setTransferQuantity("");
                  setFromGodown("");
                  setToGodown("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Product Code</p>
                <p className="font-semibold">{selectedProduct.product_code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Item Name</p>
                <p className="font-medium">{selectedProduct.item_name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Delhi Stock</p>
                  <p className="font-semibold text-green-600">{selectedProduct.delhi}</p>
                </div>
                <div>
                  <p className="text-gray-600">South Stock</p>
                  <p className="font-semibold text-green-600">{selectedProduct.south}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Godown
                </label>
                <select
                  value={fromGodown}
                  onChange={(e) => {
                    setFromGodown(e.target.value);
                    if (e.target.value === toGodown) {
                      setToGodown("");
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select source</option>
                  <option value="Delhi">Delhi Godown</option>
                  <option value="South">South Godown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Godown
                </label>
                <select
                  value={toGodown}
                  onChange={(e) => {
                    setToGodown(e.target.value);
                    if (e.target.value === fromGodown) {
                      setFromGodown("");
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select destination</option>
                  <option value="Delhi">Delhi Godown</option>
                  <option value="South">South Godown</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  min="1"
                  max={fromGodown === "Delhi" ? selectedProduct.delhi : fromGodown === "South" ? selectedProduct.south : ""}
                  placeholder="Enter quantity"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleStockTransfer}
                  disabled={transferring || !transferQuantity || !fromGodown || !toGodown}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {transferring ? "Transferring..." : "Transfer Stock"}
                </button>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedProduct(null);
                    setTransferQuantity("");
                    setFromGodown("");
                    setToGodown("");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Transfer History Modal */}
      {showTransferHistoryModal && selectedProductForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Transfer History</h3>
              <button 
                onClick={() => {
                  setShowTransferHistoryModal(false);
                  setSelectedProductForHistory(null);
                  setTransferHistoryData([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">Product Code</p>
              <p className="font-semibold">{selectedProductForHistory.product_code}</p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Item Name</p>
              <p className="font-medium">{selectedProductForHistory.item_name}</p>
            </div>

            {loadingTransferHistory ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading transfer history...</p>
              </div>
            ) : transferHistoryData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No transfer history found for this product.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="p-3 border-b font-semibold">Date</th>
                      <th className="p-3 border-b font-semibold">Quantity</th>
                      <th className="p-3 border-b font-semibold">From/To Godown</th>
                      <th className="p-3 border-b font-semibold">Note</th>
                      <th className="p-3 border-b font-semibold">Added By</th>
                      <th className="p-3 border-b font-semibold">Stock After Transfer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferHistoryData.map((record, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          {record.added_date ? 
                            new Date(record.added_date).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }) : "--"
                          }
                        </td>
                        <td className="p-3 font-semibold">{record.quantity}</td>
                        <td className="p-3">{record.godown || "--"}</td>
                        <td className="p-3 max-w-xs truncate">{record.note || "--"}</td>
                        <td className="p-3">{record.added_by || "--"}</td>
                        <td className="p-3">
                          <div className="text-xs">
                            <div>Total: {record.total}</div>
                            <div>Delhi: {record.delhi}</div>
                            <div>South: {record.south}</div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
