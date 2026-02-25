"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddSpecialPriceModal({
  customerId,
  buttonLabel = "+ Add Special Price",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await fetch("/api/products/list");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    const name = String(p.item_name ?? "").toLowerCase();
    const spec = String(p.specification ?? "").toLowerCase();
    const model = String(p.product_number ?? "").toLowerCase();
    const code = String(p.item_code ?? "").toLowerCase();

    return (
      name.includes(q) ||
      spec.includes(q) ||
      model.includes(q) ||
      code.includes(q)
    );
  });

  const toggleSelectProduct = (product) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const handleSave = async () => {
    if (!selectedProducts.length) {
      alert("Please select at least one product.");
      return;
    }

    for (const product of selectedProducts) {
      const basePrice = Number(product.last_negotiation_price ?? 0);

      if (Number.isNaN(basePrice) || basePrice < 0) {
        // Skip products with invalid price
        // eslint-disable-next-line no-continue
        continue;
      }

      const res = await fetch("/api/special-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          product_id: product.id,
          product_code: product.item_code,
          price: basePrice,
        }),
      });

      const data = await res.json();

      if (data.error) {
        alert(data.error);
        // Stop on first error to avoid confusion
        return;
      }
    }

    setOpen(false);
    setSelectedProducts([]);
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
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center px-2">
          <div className="bg-white p-6 rounded w-full max-w-4xl">

            <h2 className="text-lg font-bold mb-4">Add Special Price</h2>

            <div className="mb-3 relative">
              <input
                type="text"
                placeholder="Search by name, code, model, or specification..."
                className="border p-2 w-full"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (search.trim()) setShowSuggestions(true);
                }}
                autoComplete="off"
              />

              {showSuggestions && search.trim() && filteredProducts.length > 0 && (
              <ul className="absolute z-20 bg-white border shadow-sm rounded mt-1 max-h-60 overflow-y-auto w-full text-xs">
                  {filteredProducts.slice(0, 10).map((p) => (
                    <li
                      key={p.id}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex flex-col"
                      onClick={() => {
                        toggleSelectProduct(p);
                        setSearch(
                          `${p.item_name || ""} ${p.item_code ? `(${p.item_code})` : ""
                          }`.trim(),
                        );
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="font-medium">
                        {p.item_name || "Unnamed product"}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {p.item_code && <span className="mr-2">Code: {p.item_code}</span>}
                        {p.product_number && (
                          <span className="mr-2">Model: {p.product_number}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border rounded mb-3">
              <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-center">Select</th>
                  <th className="p-2 text-left">Image</th>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Product No</th>
                  <th className="p-2 text-right">Min Qty</th>
                  <th className="p-2 text-right">Price</th>
                  <th className="p-2 text-right">Last Neg. Price</th>
                  <th className="p-2 text-left">Specification</th>
                </tr>
              </thead>
              <tbody>
                  {filteredProducts.map((product) => {
                    const imageUrl =
                      product.image_path ||
                      product.product_image ||
                      product.image ||
                      null;

                    const isSelected = selectedProducts.some(
                      (p) => p.id === product.id,
                    );

                    return (
                      <tr
                        key={product.id}
                        className={`border-t cursor-pointer ${
                          isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          toggleSelectProduct(product);
                        }}
                      >
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectProduct(product);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt={product.item_name || "Product"}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <span className="text-gray-400 text-[11px]">
                              No image
                            </span>
                          )}
                        </td>
                        <td className="p-2">{product.item_code}</td>
                        <td className="p-2">{product.item_name}</td>
                        <td className="p-2">{product.product_number}</td>
                        <td className="p-2 text-right">
                          {product.min_qty ?? 0}
                        </td>
                        <td className="p-2 text-right">
                          {product.price_per_unit ?? 0}
                        </td>
                        <td className="p-2 text-right">
                          {product.last_negotiation_price ?? 0}
                        </td>
                        <td className="p-2 max-w-xs">
                          <span className="line-clamp-2">
                            {product.specification}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-3 text-center text-gray-500 text-xs"
                    >
                      No products found.
                    </td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
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
      )}
    </>
  );
}
