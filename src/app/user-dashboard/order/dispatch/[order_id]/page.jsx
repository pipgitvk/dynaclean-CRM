"use client";
import { useEffect, useState } from "react";
import { useAsyncClick } from "@/lib/useAsyncClick";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function DispatchFormPage({ params }) {
  const router = useRouter();
  const { order_id } = use(params);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [initialSerialNos, setInitialSerialNos] = useState(new Set());
  const [stockInfo, setStockInfo] = useState({});
  const [lowStockWarnings, setLowStockWarnings] = useState({});
  const [accessories, setAccessories] = useState({}); // { item_code: [accessories] }
  const [accessoriesChecked, setAccessoriesChecked] = useState({}); // { rowId: { accessoryId: boolean } }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/dispatch?order_id=${order_id}`);
        const json = await res.json();
        if (json.success) {
          const data = json.data || [];
          setRows(data);
          // Track which rows already have serial numbers from database
          const idsWithSerialNo = new Set(
            data.filter(r => r.serial_no && r.serial_no.trim() !== "").map(r => r.id)
          );
          setInitialSerialNos(idsWithSerialNo);
          setSavedIds(idsWithSerialNo);

          // Load accessories for each unique item_code
          const uniqueItemCodes = [...new Set(data.map(r => r.item_code).filter(Boolean))];
          for (const itemCode of uniqueItemCodes) {
            loadAccessoriesForProduct(itemCode);
          }

          // Parse existing accessories_checklist from database
          const checkedState = {};
          data.forEach(row => {
            if (row.accessories_checklist) {
              try {
                const parsed = JSON.parse(row.accessories_checklist);
                checkedState[row.id] = {};
                parsed.forEach(acc => {
                  checkedState[row.id][acc.id] = true;
                });
              } catch (e) {
                console.error('Failed to parse accessories_checklist:', e);
              }
            }
          });
          setAccessoriesChecked(checkedState);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [order_id]);

  const fetchStockForRow = async (rowId, quoteNumber, godown, itemCode) => {
    if (!quoteNumber || !godown || !itemCode) {
      setStockInfo(prev => ({ ...prev, [rowId]: null }));
      setLowStockWarnings(prev => ({ ...prev, [rowId]: "" }));
      return;
    }

    try {
      const res = await fetch("/api/stock/check-single-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_number: quoteNumber,
          godown: godown,
          item_code: itemCode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStockInfo(prev => ({ ...prev, [rowId]: data.stockResults }));

        // Check for low stock warnings
        let warningMessage = "";
        data.stockResults.forEach((item) => {
          if (
            item.stock_count !== null &&
            item.min_qty !== null &&
            item.stock_count < item.min_qty
          ) {
            warningMessage += `Warning: The stock for "${item.item_name}" is currently below the minimum required quantity. Please replenish the stock in the selected godown.\n`;
          }
        });
        setLowStockWarnings(prev => ({ ...prev, [rowId]: warningMessage }));
      } else {
        const { error } = await res.json();
        console.error("Stock check error:", error);
        setStockInfo(prev => ({ ...prev, [rowId]: null }));
        setLowStockWarnings(prev => ({ ...prev, [rowId]: "" }));
      }
    } catch (err) {
      console.error("Failed to fetch stock:", err);
      setStockInfo(prev => ({ ...prev, [rowId]: null }));
      setLowStockWarnings(prev => ({ ...prev, [rowId]: "" }));
    }
  };

  const loadAccessoriesForProduct = async (itemCode) => {
    try {
      const res = await fetch(`/api/product-accessories?product_code=${itemCode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setAccessories(prev => ({ ...prev, [itemCode]: json.data || [] }));
        }
      }
    } catch (err) {
      console.error('Failed to load accessories:', err);
    }
  };

  const updateField = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

    // Fetch stock when godown is selected
    if (field === "godown") {
      const row = rows.find(r => r.id === id);
      if (row && row.quote_number && row.item_code) {
        if (value) {
          // Godown selected - fetch stock for this specific item
          fetchStockForRow(id, row.quote_number, value, row.item_code);
        } else {
          // Godown cleared - clear stock info
          setStockInfo(prev => ({ ...prev, [id]: null }));
          setLowStockWarnings(prev => ({ ...prev, [id]: "" }));
        }
      }
    }
  };

  const updateAccessoryCheck = (rowId, accessoryId, checked) => {
    setAccessoriesChecked(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [accessoryId]: checked
      }
    }));
  };

  // Treat items with any alphabet in item_code as "product"; others are spares
  const isProductItem = (itemCode) => /[a-zA-Z]/.test(itemCode || "");

  const uploadForRow = async (row) => {
    const form = new FormData();
    form.append("id", row.id);
    if (row.serial_no) form.append("serial_no", row.serial_no);
    if (row.remarks) form.append("remarks", row.remarks);
    if (row.godown) form.append("godown", row.godown);

    // Build accessories checklist JSON
    const productAccessories = accessories[row.item_code] || [];
    const checkedAccessories = productAccessories.filter(acc => accessoriesChecked[row.id]?.[acc.id]);
    if (checkedAccessories.length > 0) {
      form.append("accessories_checklist", JSON.stringify(checkedAccessories));
    }

    // Check if all mandatory accessories are checked
    const mandatoryAccessories = productAccessories.filter(acc => acc.is_mandatory === 1);
    const allMandatoryChecked = mandatoryAccessories.every(acc => accessoriesChecked[row.id]?.[acc.id]);
    if (!allMandatoryChecked && mandatoryAccessories.length > 0) {
      throw new Error("Please check all mandatory accessories before saving.");
    }

    // append up to 4 photos: front, back, right, left
    const photoKeys = ["_frontPhoto", "_backPhoto", "_rightPhoto", "_leftPhoto"];
    for (const key of photoKeys) {
      const f = row[key];
      if (f) form.append("photos", f);
    }

    if (!row.godown) {
      throw new Error("Please select a godown before saving.");
    }

    // Check for low stock warning
    if (lowStockWarnings[row.id]) {
      throw new Error("Please add stock to the selected godown before dispatching this item.");
    }

    const res = await fetch("/api/dispatch/update", { method: "POST", body: form });
    const json = await res.json();
    if (!json.success) {
      // Check for duplicate serial number error
      if (json.error && json.error.includes("Duplicate entry")) {
        throw new Error("Serial number already exists. Please use a unique serial number.");
      }
      throw new Error(json.error || "Failed to update");
    }
    setSavedIds((prev) => new Set(prev).add(row.id));
  };

  const completeAll = async () => {
    try {
      setSaving(true);
      // For products: serial number is mandatory; for spares: serial number is optional
      const allProductSerialNosFilled = rows
        .filter(r => isProductItem(r.item_code))
        .every(r => r.serial_no && r.serial_no.trim() !== "");
      if (!allProductSerialNosFilled) {
        throw new Error("Please fill serial numbers for all product items before completing dispatch");
      }
      // Check if all godowns are selected
      const allGodownsSelected = rows.every(r => r.godown && r.godown.trim() !== "");
      if (!allGodownsSelected) {
        throw new Error("Please select godowns for all items before completing dispatch");
      }
      // Check if any items have low stock warnings
      const hasLowStockIssues = rows.some(r => lowStockWarnings[r.id]);
      if (hasLowStockIssues) {
        throw new Error("Please resolve all stock warnings before completing dispatch");
      }
      // mark order dispatch complete
      const doneRes = await fetch("/api/dispatch/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id }),
      });
      const doneJson = await doneRes.json();
      if (!doneRes.ok || !doneJson.success) throw new Error(doneJson.error || "Failed to mark dispatch complete");
      alert("Dispatch updated and marked complete");
      router.push(`/user-dashboard/order/dispatch/view/${order_id}`);
    } catch (e) {
      alert(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Dispatch for Order #{order_id}</h2>
      {rows.length === 0 ? (
        <div className="text-gray-600">No dispatch rows.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="border rounded-lg p-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div className="text-sm min-w-0">
                    <div className="font-medium truncate" title={r.item_name}>{r.item_name}</div>
                    <div className="text-gray-600 truncate" title={r.item_code}>{r.item_code}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Serial No</label>
                    <input
                      className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={r.serial_no || ""}
                      onChange={(e) => updateField(r.id, "serial_no", e.target.value)}
                      disabled={initialSerialNos.has(r.id)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Godown</label>
                    <select
                      className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={r.godown || ""}
                      onChange={(e) => updateField(r.id, "godown", e.target.value)}
                      disabled={initialSerialNos.has(r.id)}
                    >
                      <option value="">Select Godown</option>
                      <option value="Delhi - Mundka">Delhi - Mundka</option>
                      <option value="Tamil_Nadu - Coimbatore">Tamil_Nadu - Coimbatore</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Remarks</label>
                    <input
                      className="border rounded px-2 py-1 w-full disabled:bg-gray-100 disabled:cursor-not-allowed"
                      value={r.remarks || ""}
                      onChange={(e) => updateField(r.id, "remarks", e.target.value)}
                      disabled={initialSerialNos.has(r.id)}
                    />
                  </div>
                  <div className="text-xs text-gray-600">Upload Photos (Front, Back, Right, Left)</div>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "_frontPhoto", label: "Front" },
                    { key: "_backPhoto", label: "Back" },
                    { key: "_rightPhoto", label: "Right" },
                    { key: "_leftPhoto", label: "Left" },
                  ].map(({ key, label }) => (
                    <div key={key} className="border rounded-lg p-2 flex flex-col items-stretch justify-center min-w-0">
                      <div className="text-xs mb-2 font-medium">{label}</div>
                      <input
                        type="file"
                        accept="image/*"
                        className="block w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs file:cursor-pointer overflow-hidden text-ellipsis disabled:opacity-50 disabled:cursor-not-allowed"
                        onChange={(e) => updateField(r.id, key, (e.target.files && e.target.files[0]) || null)}
                        disabled={initialSerialNos.has(r.id)}
                      />
                      <div className="mt-1 max-w-full text-[10px] text-gray-600 truncate">
                        {(r[key] && r[key].name) ? r[key].name : "No file chosen"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stock Information Display */}
                {stockInfo[r.id] && stockInfo[r.id].length > 0 && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <h4 className="text-sm font-medium text-green-800 mb-2">Current Stock in {r.godown}:</h4>
                    <div className="space-y-1">
                      {stockInfo[r.id].map((item) => (
                        <p key={item.item_code} className="text-sm text-green-700">
                          {item.item_name || item.item_code}: {item.stock_count} (Min Qty: {item.min_qty || 0})
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low Stock Warning */}
                {lowStockWarnings[r.id] && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="text-sm font-medium text-red-800 mb-2">⚠️ Stock Warning:</h4>
                    <p className="text-sm text-red-700 whitespace-pre-line">
                      {lowStockWarnings[r.id]}
                    </p>
                  </div>
                )}

                {/* Accessories Checklist */}
                {accessories[r.item_code] && accessories[r.item_code].length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">
                      Accessories Checklist:
                    </h4>
                    <div className="space-y-1">
                      {accessories[r.item_code].map((acc) => (
                        <label key={acc.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-blue-100 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={accessoriesChecked[r.id]?.[acc.id] || false}
                            onChange={(e) => updateAccessoryCheck(r.id, acc.id, e.target.checked)}
                            disabled={initialSerialNos.has(r.id)}
                            className="cursor-pointer"
                          />
                          <span className="flex-1">
                            {acc.accessory_name}
                            {acc.is_mandatory === 1 && (
                              <span className="ml-1 text-red-600 font-bold" title="Mandatory">*</span>
                            )}
                          </span>
                          {acc.description && (
                            <span className="text-xs text-gray-600 italic">{acc.description}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <RowSaveButton
                    r={r}
                    uploadForRow={uploadForRow}
                    globalSaving={saving}
                    isSaved={savedIds.has(r.id)}
                    hasSerialNo={r.serial_no && r.serial_no.trim() !== ""}
                    hasGodown={r.godown && r.godown.trim() !== ""}
                    isLocked={initialSerialNos.has(r.id)}
                    hasLowStockWarning={!!lowStockWarnings[r.id]}
                    isProduct={isProductItem(r.item_code)}
                  />
                  {initialSerialNos.has(r.id) && (
                    <span className="text-xs text-green-700">✓ Already saved (locked)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => router.back()} className="px-3 py-1 border rounded">Back</button>
        <CompleteButton
          onComplete={completeAll}
          disabled={
            // All godowns must be selected
            !rows.every(r => r.godown && r.godown.trim() !== "") ||
            // For products, serial no is required; for spares, it's optional
            !rows
              .filter(r => isProductItem(r.item_code))
              .every(r => r.serial_no && r.serial_no.trim() !== "") ||
            // No pending low stock warnings
            rows.some(r => lowStockWarnings[r.id])
          }
          saving={saving}
        />
      </div>
    </div>
  );
}



function RowSaveButton({ r, uploadForRow, globalSaving, isSaved, hasSerialNo, hasGodown, isLocked, hasLowStockWarning, isProduct }) {
  const [handleClick, isLoading] = useAsyncClick(async () => {
    try {
      await uploadForRow(r);
    } catch (error) {
      alert(error.message || "Failed to save");
      throw error; // Re-throw to prevent marking as saved
    }
  });

  // For products serial number is mandatory; for spares it's optional
  const serialRequired = isProduct;

  // Disable if: locked, already saved, currently saving, (for products) no serial number, no godown, or has low stock warning
  const isDisabled =
    isLocked ||
    globalSaving ||
    isLoading ||
    isSaved ||
    (serialRequired && !hasSerialNo) ||
    !hasGodown ||
    hasLowStockWarning;

  return (
    <button
      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
      disabled={isDisabled}
      onClick={handleClick}
    >
      {isLoading ? "Saving..." : isLocked ? "Locked" : isSaved ? "Saved" : "Save"}
    </button>
  );
}

function CompleteButton({ onComplete, disabled, saving }) {
  const [handleClick, isLoading] = useAsyncClick(async () => {
    await onComplete();
  });
  const pending = saving || isLoading;
  return (
    <button
      onClick={handleClick}
      disabled={disabled || pending}
      className="px-3 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
    >
      {pending ? "Completing..." : "Complete"}
    </button>
  );
}

