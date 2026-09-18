"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  SPECIAL_PRICE_TERM_DEFAULT,
  SPECIAL_PRICE_TYPE_DEFAULT,
} from "@/lib/specialPriceDefaults";

export default function AddSpecialPriceModal({
  customerId,
  buttonLabel = "+ Add Special Price",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("select");
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [priceEntries, setPriceEntries] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const resetModal = () => {
    setStep("select");
    setSelectedItems([]);
    setSearch("");
    setPriceEntries({});
    setShowSuggestions(false);
    setSubmitting(false);
  };

  const closeModal = () => {
    setOpen(false);
    resetModal();
  };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const [productsRes, sparesRes] = await Promise.all([
          fetch("/api/products/list"),
          fetch("/api/spare/list"),
        ]);
        const productsData = await productsRes.json();
        const sparesData = await sparesRes.json();

        const products = (Array.isArray(productsData) ? productsData : []).map(
          (p) => ({ ...p, _type: "product", _code: p.item_code, _model: p.product_number })
        );
        const spares = (Array.isArray(sparesData) ? sparesData : []).map(
          (s) => ({ ...s, _type: "spare", _code: s.spare_number, _model: s.model })
        );

        setAllItems([...products, ...spares]);
      } catch (err) {
        console.error("Failed to fetch items:", err);
      }
    };
    fetchItems();
  }, []);

  const filteredItems = allItems.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = String(p.item_name ?? "").toLowerCase();
    const spec = String(p.specification ?? "").toLowerCase();
    const model = String(p._model ?? "").toLowerCase();
    const code = String(p._code ?? "").toLowerCase();
    return name.includes(q) || spec.includes(q) || model.includes(q) || code.includes(q);
  });

  const getKey = (item) => `${item._type}-${item.id}`;

  const getOriginalPrice = (item) =>
    Number(item.price_per_unit ?? item.sale_price ?? 0);

  const toggleSelect = (item) => {
    const key = getKey(item);
    setSelectedItems((prev) => {
      const exists = prev.some((p) => getKey(p) === key);
      return exists ? prev.filter((p) => getKey(p) !== key) : [...prev, item];
    });
  };

  const handleContinueToPrice = () => {
    if (!selectedItems.length) {
      alert("Please select at least one item.");
      return;
    }

    const initialPrices = {};
    selectedItems.forEach((item) => {
      const key = getKey(item);
      const suggested = item.last_negotiation_price ?? "";
      initialPrices[key] = suggested ? String(suggested) : "";
    });
    setPriceEntries(initialPrices);
    setStep("price");
  };

  const handleFinalSave = async () => {
    for (const item of selectedItems) {
      const key = getKey(item);
      const price = Number(priceEntries[key]);
      if (!Number.isFinite(price) || price <= 0) {
        alert(`Please enter a valid special price for ${item.item_name || "selected item"}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      for (const item of selectedItems) {
        const key = getKey(item);
        const price = Number(priceEntries[key]);

        const payload = {
          customer_id: customerId,
          item_type: item._type,
          price,
          price_type: SPECIAL_PRICE_TYPE_DEFAULT,
          price_term: SPECIAL_PRICE_TERM_DEFAULT,
        };

        if (item._type === "product") {
          payload.product_id = item.id;
          payload.product_code = item.item_code;
        } else {
          payload.spare_id = item.id;
        }

        const res = await fetch("/api/special-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }
      }

      closeModal();
      router.refresh();
    } catch (error) {
      alert(error.message || "Failed to save special price");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded text-center whitespace-nowrap"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center px-2 z-50">
          <div className="bg-white p-6 rounded w-full max-w-4xl max-h-[90vh] flex flex-col">
            {step === "select" ? (
              <>
                <h2 className="text-lg font-bold mb-4">Add Special Price</h2>

                <div className="mb-3 relative">
                  <input
                    type="text"
                    placeholder="Search by name, code, model, or specification..."
                    className="border p-2 w-full rounded"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => { if (search.trim()) setShowSuggestions(true); }}
                    autoComplete="off"
                  />

                  {showSuggestions && search.trim() && filteredItems.length > 0 && (
                    <ul className="absolute z-20 bg-white border shadow-sm rounded mt-1 max-h-60 overflow-y-auto w-full text-xs">
                      {filteredItems.slice(0, 10).map((p) => (
                        <li
                          key={getKey(p)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                          onClick={() => {
                            toggleSelect(p);
                            setSearch(p.item_name || "");
                            setShowSuggestions(false);
                          }}
                        >
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            p._type === "product" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {p._type === "product" ? "Product" : "Spare"}
                          </span>
                          <span className="font-medium">{p.item_name || "Unnamed"}</span>
                          {p._code && <span className="text-gray-400">({p._code})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto border rounded mb-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 text-center">Select</th>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Image</th>
                        <th className="p-2 text-left">Code</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Model/No</th>
                        <th className="p-2 text-right">Price</th>
                        <th className="p-2 text-right">Last Neg. Price</th>
                        <th className="p-2 text-left">Specification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => {
                        const imageUrl = item.image_path || item.product_image || item.image || null;
                        const isSelected = selectedItems.some((p) => getKey(p) === getKey(item));

                        return (
                          <tr
                            key={getKey(item)}
                            className={`border-t cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                            onClick={() => toggleSelect(item)}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => { e.stopPropagation(); toggleSelect(item); }}
                              />
                            </td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                item._type === "product" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                              }`}>
                                {item._type === "product" ? "Product" : "Spare"}
                              </span>
                            </td>
                            <td className="p-2">
                              {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imageUrl} alt={item.item_name || "Item"} className="w-10 h-10 object-cover rounded" />
                              ) : (
                                <span className="text-gray-400 text-[11px]">No image</span>
                              )}
                            </td>
                            <td className="p-2">{item._code}</td>
                            <td className="p-2">{item.item_name}</td>
                            <td className="p-2">{item._model}</td>
                            <td className="p-2 text-right">{getOriginalPrice(item)}</td>
                            <td className="p-2 text-right">{item.last_negotiation_price ?? 0}</td>
                            <td className="p-2 max-w-xs">
                              <span className="line-clamp-2">{item.specification}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-3 text-center text-gray-500 text-xs">
                            No items found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-gray-300 px-4 py-2 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToPrice}
                      className="bg-blue-600 text-white px-4 py-2 rounded"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Enter Special Price</h2>
                  <button
                    type="button"
                    onClick={() => setStep("select")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    ← Back to selection
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Enter special price for each selected item. Price type will be{" "}
                  <span className="font-medium capitalize">{SPECIAL_PRICE_TYPE_DEFAULT}</span>{" "}
                  with term{" "}
                  <span className="font-medium capitalize">{SPECIAL_PRICE_TERM_DEFAULT}</span>.
                </p>

                <div className="flex-1 overflow-y-auto border rounded mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-3 text-left">Type</th>
                        <th className="p-3 text-left">Code</th>
                        <th className="p-3 text-left">Product/Spare</th>
                        <th className="p-3 text-right">Original Price</th>
                        <th className="p-3 text-right">Special Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => {
                        const key = getKey(item);
                        return (
                          <tr key={key} className="border-t">
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                item._type === "product"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}>
                                {item._type === "product" ? "Product" : "Spare"}
                              </span>
                            </td>
                            <td className="p-3 text-gray-700">{item._code || "-"}</td>
                            <td className="p-3">{item.item_name}</td>
                            <td className="p-3 text-right text-gray-600">
                              ₹ {getOriginalPrice(item)}
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                value={priceEntries[key] ?? ""}
                                onChange={(e) =>
                                  setPriceEntries((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="Enter price"
                                className="w-36 border border-gray-300 rounded px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSave}
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
