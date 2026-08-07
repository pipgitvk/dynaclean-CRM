"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddSpecialPriceModal({
  customerId,
  buttonLabel = "+ Add Special Price",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const [productsRes, sparesRes] = await Promise.all([
          fetch("/api/products/list"),
          fetch("/api/spare/list"),
        ]);
        const productsData = await productsRes.json();
        const sparesData = await sparesRes.json();

        // Tag each item with its type
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

  // Unique key: type + id
  const getKey = (item) => `${item._type}-${item.id}`;

  const toggleSelect = (item) => {
    const key = getKey(item);
    setSelectedItems((prev) => {
      const exists = prev.some((p) => getKey(p) === key);
      return exists ? prev.filter((p) => getKey(p) !== key) : [...prev, item];
    });
  };

  const handleSave = async () => {
    if (!selectedItems.length) {
      alert("Please select at least one item.");
      return;
    }

    for (const item of selectedItems) {
      const basePrice = Number(item.last_negotiation_price ?? 0);
      if (Number.isNaN(basePrice) || basePrice < 0) continue;

      const payload = {
        customer_id: customerId,
        item_type: item._type,
        price: basePrice,
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
        alert(data.error);
        return;
      }
    }

    setOpen(false);
    setSelectedItems([]);
    setSearch("");
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded text-center whitespace-nowrap"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center px-2 z-50">
          <div className="bg-white p-6 rounded w-full max-w-4xl max-h-[90vh] flex flex-col">

            <h2 className="text-lg font-bold mb-4">Add Special Price</h2>

            {/* Search */}
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

            {/* Table */}
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
                        <td className="p-2 text-right">{item.price_per_unit ?? item.sale_price ?? 0}</td>
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
                  onClick={() => { setOpen(false); setSelectedItems([]); setSearch(""); }}
                  className="bg-gray-300 px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Save
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
