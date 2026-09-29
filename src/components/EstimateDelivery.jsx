"use client";
import { useState, useEffect } from "react";

export default function EstimateDelivery() {
  const [products, setProducts] = useState([]);
  const [spares, setSpares] = useState([]);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Load product and spare list once
  useEffect(() => {
    (async () => {
      try {
        const resProducts = await fetch("/api/products/list");
        const dataProducts = await resProducts.json();
        setProducts(Array.isArray(dataProducts) ? dataProducts : []);

        const resSpares = await fetch("/api/spare/list");
        const dataSpares = await resSpares.json();
        setSpares(Array.isArray(dataSpares) ? dataSpares : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Search filter
  useEffect(() => {
    const term = (search || "").toString().toLowerCase();
    if (!term) return setFiltered([]);

    const allItems = [
      ...products.map((p) => ({ ...p, type: "product" })),
      ...spares.map((s) => ({ ...s, type: "spare" })),
    ];

    const results = allItems.filter((item) => {
      const code = item.item_code || "";
      const spare = item.spare_number || "";
      const name = item.item_name || "";

      return (
        code.toString().toLowerCase().includes(term) ||
        spare.toString().toLowerCase().includes(term) ||
        name.toString().toLowerCase().includes(term)
      );
    });

    setFiltered(results.slice(0, 20));
  }, [search, products, spares]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setSearch(item.item_code || item.spare_number);
    setFiltered([]);
    setResult(null);
    setError(null);
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!selectedItem) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/estimate-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code: selectedItem.item_code || selectedItem.spare_number,
          type: selectedItem.type,
          pincode,
        }),
      });

      const data = await res.json();
      if (!res.ok) setError(data.error || "Unknown error");
      else setResult(data);
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold mb-4">Estimate Delivery</h3>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Product or Spare..."
          className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300 mb-3"
        />

        {/* Dropdown */}
        {filtered.length > 0 && (
          <div className="border rounded-lg bg-white shadow-md max-h-56 overflow-y-auto mb-3">
            {filtered.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(item)}
                className="px-4 py-2 border-b hover:bg-gray-100 cursor-pointer flex justify-between"
              >
                <div>
                  <b>{item.item_code || item.spare_number}</b> —{" "}
                  {item.item_name}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded text-white ${
                    item.type === "product" ? "bg-green-600" : "bg-blue-600"
                  }`}
                >
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Selected Item */}
        {selectedItem && (
          <div className="bg-gray-50 p-4 rounded-lg mb-3">
            <p>
              <b>Item Code:</b>{" "}
              {selectedItem.item_code || selectedItem.spare_number}
            </p>
            <p>
              <b>Name:</b> {selectedItem.item_name}
            </p>

            {(selectedItem.product_image || selectedItem.image) && (
              <img
                src={selectedItem.product_image || selectedItem.image}
                className="w-28 rounded-lg mt-2 shadow"
              />
            )}
          </div>
        )}

        {/* Pincode */}
        <input
          type="text"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          placeholder="Enter Pincode"
          className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-purple-300 mb-4"
        />

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={loading || !selectedItem}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Checking..." : "Check Delivery"}
          </button>

          <button
            onClick={() => {
              setSearch("");
              setSelectedItem(null);
              setPincode("");
              setResult(null);
              setError(null);
            }}
            className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition"
          >
            Clear
          </button>
        </div>

        {/* Result */}
        {error && (
          <div className="mt-4 text-red-600 font-semibold">{error}</div>
        )}

        {result && (
          <div className="mt-4 bg-green-50 border border-green-300 p-4 rounded-lg">
            <p>
              <b>Available:</b>{" "}
              <span className="text-green-700">
                {result.available ? "Yes" : "No"}
              </span>
            </p>

            {result.available ? (
              <>
                <p>
                  <b>Godown:</b> {result.godown}
                </p>
                <p>
                  <b>Estimated Delivery:</b> {result.delivery_days} day(s)
                </p>
              </>
            ) : (
              <p className="text-red-600">
                {result.note || "Stock not available"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
