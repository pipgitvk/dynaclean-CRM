"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEALER_PRICE_TERM_OPTIONS } from "@/lib/specialPriceDefaults";

export default function RequestDealerPriceModal({
  customerId,
  buttonLabel = "Request Dealer Price",
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("term");
  const [priceTerm, setPriceTerm] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const resetModal = () => {
    setStep("term");
    setPriceTerm("");
    setSearch("");
    setSelectedItems([]);
    setAllItems([]);
  };

  const closeModal = () => {
    setOpen(false);
    resetModal();
  };

  useEffect(() => {
    if (!open || step !== "models") return;

    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const [productsRes, sparesRes] = await Promise.all([
          fetch("/api/products/list"),
          fetch("/api/spare/list"),
        ]);
        const productsData = await productsRes.json();
        const sparesData = await sparesRes.json();

        const products = (Array.isArray(productsData) ? productsData : []).map(
          (p) => ({
            ...p,
            _type: "product",
            _code: p.item_code,
            _model: p.product_number,
          }),
        );
        const spares = (Array.isArray(sparesData) ? sparesData : []).map(
          (s) => ({
            ...s,
            _type: "spare",
            _code: s.spare_number,
            _model: s.model,
          }),
        );

        setAllItems([...products, ...spares]);
      } catch (err) {
        console.error("Failed to fetch items:", err);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [open, step]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((p) => {
      const name = String(p.item_name ?? "").toLowerCase();
      const spec = String(p.specification ?? "").toLowerCase();
      const model = String(p._model ?? "").toLowerCase();
      const code = String(p._code ?? "").toLowerCase();
      return (
        name.includes(q) ||
        spec.includes(q) ||
        model.includes(q) ||
        code.includes(q)
      );
    });
  }, [allItems, search]);

  const getKey = (item) => `${item._type}-${item.id}`;

  const toggleSelect = (item) => {
    const key = getKey(item);
    setSelectedItems((prev) => {
      const exists = prev.some((p) => getKey(p) === key);
      return exists ? prev.filter((p) => getKey(p) !== key) : [...prev, item];
    });
  };

  const selectAllFiltered = () => {
    setSelectedItems((prev) => {
      const map = new Map(prev.map((item) => [getKey(item), item]));
      filteredItems.forEach((item) => map.set(getKey(item), item));
      return Array.from(map.values());
    });
  };

  const handleContinueToModels = () => {
    if (!priceTerm) {
      alert("Please select a price term.");
      return;
    }
    setStep("models");
  };

  const handleSubmit = async () => {
    if (!selectedItems.length) {
      alert("Please select at least one model.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/dealer-price-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          price_term: priceTerm,
          items: selectedItems.map((item) => ({
            item_type: item._type,
            product_id: item.id,
            product_code: item._code || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      alert("Dealer price request submitted.");
      closeModal();
      router.refresh();
    } catch (error) {
      alert(error.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-emerald-600 text-white px-4 py-2 rounded text-center whitespace-nowrap hover:bg-emerald-700"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center px-2 z-50">
          <div
            className={`bg-white p-6 rounded w-full flex flex-col ${
              step === "term" ? "max-w-md" : "max-w-4xl max-h-[90vh]"
            }`}
          >
            {step === "term" ? (
              <>
                <h2 className="text-lg font-bold mb-2">Request Dealer Price</h2>
                <p className="text-sm text-gray-600 mb-5">
                  Select price term to continue
                </p>

                <div className="space-y-3">
                  {DEALER_PRICE_TERM_OPTIONS.map((term) => {
                    const selected = priceTerm === term;
                    return (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setPriceTerm(term)}
                        className={`w-full text-left rounded-lg border px-4 py-4 transition ${
                          selected
                            ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200"
                            : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className="font-medium text-gray-900">{term}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="bg-gray-300 px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueToModels}
                    disabled={!priceTerm}
                    className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("term");
                      setSelectedItems([]);
                      setSearch("");
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-lg font-bold">Select Models</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Term: <span className="font-medium">{priceTerm}</span>
                  </p>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Search models..."
                    className="border p-2 rounded flex-1 min-w-[200px]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedItems([])}
                    className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto border rounded mb-3 min-h-[240px]">
                  {loadingItems ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      Loading models...
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="p-2 text-center">Select</th>
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-left">Code</th>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Model</th>
                          <th className="p-2 text-left">Specification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item) => {
                          const isSelected = selectedItems.some(
                            (p) => getKey(p) === getKey(item),
                          );
                          return (
                            <tr
                              key={getKey(item)}
                              className={`border-t cursor-pointer ${
                                isSelected ? "bg-emerald-50" : "hover:bg-gray-50"
                              }`}
                              onClick={() => toggleSelect(item)}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(item);
                                  }}
                                />
                              </td>
                              <td className="p-2 capitalize">{item._type}</td>
                              <td className="p-2">{item._code || "-"}</td>
                              <td className="p-2">{item.item_name}</td>
                              <td className="p-2">{item._model || "-"}</td>
                              <td className="p-2 max-w-xs">
                                <span className="line-clamp-2">
                                  {item.specification || "-"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {!loadingItems && filteredItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-3 text-center text-gray-500"
                            >
                              No models found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {selectedItems.length} model
                    {selectedItems.length !== 1 ? "s" : ""} selected
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
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
