"use client";

import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";

const emptyProductForm = () => ({
  price_per_unit: "",
  purchase_price: "",
  last_negotiation_price: "",
  gem_price: "",
  gem_last_negotiation_price: "",
  dealer_price: "",
  dp_no_warranty: "",
  dp: "",
});

const emptySpareForm = () => ({
  sale_price: "",
  purchase_price: "",
  last_negotiation_price: "",
});

function productFormFromRow(row) {
  return {
    price_per_unit: row.price_per_unit ?? row.price ?? "",
    purchase_price: row.purchase_price ?? "",
    last_negotiation_price: row.last_negotiation_price ?? "",
    gem_price: row.gem_price ?? "",
    gem_last_negotiation_price: row.gem_last_negotiation_price ?? "",
    dealer_price: row.dealer_price ?? "",
    dp_no_warranty: row.dp_no_warranty ?? "",
    dp: row.dp ?? "",
  };
}

function spareFormFromRow(row) {
  return {
    sale_price: row.sale_price ?? "",
    purchase_price: row.purchase_price ?? "",
    last_negotiation_price: row.last_negotiation_price ?? "",
  };
}

/**
 * 3-dot menu → edit pricing fields (products or spares).
 */
export default function InventoryPriceEditMenu({
  kind,
  row,
  onSaved,
  className = "",
  /** "menu" = 3-dot; "button" = Edit prices button on detail panel */
  trigger = "menu",
  purchasePriceHint,
  latestSalePriceHint,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(
    kind === "spare" ? emptySpareForm() : emptyProductForm(),
  );

  useEffect(() => {
    if (!modalOpen || !row) return;
    setForm(
      kind === "spare" ? spareFormFromRow(row) : productFormFromRow(row),
    );
  }, [modalOpen, row, kind]);

  const openEdit = () => {
    setMenuOpen(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!row || saving) return;
    setSaving(true);
    try {
      if (kind === "product") {
        const fd = new FormData();
        fd.append("item_code", row.item_code);
        fd.append("item_name", row.item_name || "");
        fd.append("product_number", row.product_number || "");
        fd.append("min_qty", row.min_qty ?? "");
        fd.append("price_per_unit", form.price_per_unit);
        fd.append("purchase_price", form.purchase_price);
        fd.append("gem_price", form.gem_price);
        fd.append("gem_last_negotiation_price", form.gem_last_negotiation_price);
        fd.append("dealer_price", form.dealer_price);
        fd.append("dp_no_warranty", form.dp_no_warranty);
        fd.append("dp", form.dp);
        fd.append("last_negotiation_price", form.last_negotiation_price);
        fd.append("gst_rate", row.gst_rate ?? "");
        fd.append("hsn_sac", row.hsn_sac ?? "");
        fd.append("specification", row.specification ?? "");

        const res = await fetch("/api/products/update", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Failed to update product");
          return;
        }
        onSaved?.({
          ...row,
          price_per_unit: form.price_per_unit,
          purchase_price: form.purchase_price,
          last_negotiation_price: form.last_negotiation_price,
          gem_price: form.gem_price,
          gem_last_negotiation_price: form.gem_last_negotiation_price,
          dealer_price: form.dealer_price,
          dp_no_warranty: form.dp_no_warranty,
          dp: form.dp,
        });
      } else {
        const fd = new FormData();
        fd.append("id", String(row.id));
        fd.append("spare_number", row.spare_number ?? "");
        fd.append("item_name", row.item_name || "");
        fd.append("type", row.type || "");
        fd.append("make", row.make || "");
        fd.append("model", row.model || "");
        fd.append("compatible_machine", row.compatible_machine || "");
        fd.append("min_qty", row.min_qty ?? "");
        fd.append("purchase_price", form.purchase_price);
        fd.append("sale_price", form.sale_price);
        fd.append("tax", row.tax ?? "");
        fd.append("hsn_sac", row.hsn_sac ?? "");
        fd.append("last_negotiation_price", form.last_negotiation_price);
        fd.append("specification", row.specification ?? "");
        fd.append(
          "covered_in_warranty",
          row.covered_in_warranty === 1 || row.covered_in_warranty === true
            ? "1"
            : "0",
        );

        const res = await fetch("/api/spare/update", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) {
          alert(data.error || "Failed to update spare");
          return;
        }
        onSaved?.({
          ...row,
          sale_price: form.sale_price,
          purchase_price: form.purchase_price,
          last_negotiation_price: form.last_negotiation_price,
        });
      }
      setModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("Error saving prices");
    } finally {
      setSaving(false);
    }
  };

  if (!row) return null;

  return (
    <>
      {trigger === "menu" ? (
        <div
          className={`relative flex-shrink-0 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-30 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                  onClick={openEdit}
                >
                  Edit prices
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openEdit}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors ${className}`}
        >
          Edit prices
        </button>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit prices
              </h3>
              <p className="text-sm text-gray-500 mt-1 truncate">
                {kind === "product" ? row.item_name : row.item_name}
              </p>
            </div>

            <div className="p-4 space-y-3">
              {kind === "product" ? (
                <>
                  {(purchasePriceHint != null || latestSalePriceHint != null) && (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1">
                      {purchasePriceHint != null && (
                        <p>
                          Latest purchase (records):{" "}
                          <span className="font-semibold text-gray-800">
                            ₹{purchasePriceHint}
                          </span>
                        </p>
                      )}
                      {latestSalePriceHint != null && (
                        <p>
                          Latest sale (records):{" "}
                          <span className="font-semibold text-gray-800">
                            ₹{latestSalePriceHint}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <Field
                    label="Sale Price (list / per unit)"
                    value={form.price_per_unit}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, price_per_unit: v }))
                    }
                  />
                  <Field
                    label="Purchase Price"
                    value={form.purchase_price}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, purchase_price: v }))
                    }
                  />
                  <Field
                    label="Last Neg. Price"
                    value={form.last_negotiation_price}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, last_negotiation_price: v }))
                    }
                  />
                  <Field
                    label="GEM Price"
                    value={form.gem_price}
                    onChange={(v) => setForm((f) => ({ ...f, gem_price: v }))}
                  />
                  <Field
                    label="GEM Last Neg. Price"
                    value={form.gem_last_negotiation_price}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, gem_last_negotiation_price: v }))
                    }
                  />
                  <Field
                    label="Dealer Price"
                    value={form.dealer_price}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, dealer_price: v }))
                    }
                  />
                  <Field
                    label="DP"
                    value={form.dp}
                    onChange={(v) => setForm((f) => ({ ...f, dp: v }))}
                    type="text"
                  />
                  <Field
                    label="DP No-Warranty"
                    value={form.dp_no_warranty}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, dp_no_warranty: v }))
                    }
                    type="text"
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Price (Sale)"
                    value={form.sale_price}
                    onChange={(v) => setForm((f) => ({ ...f, sale_price: v }))}
                  />
                  <Field
                    label="Purchase Price"
                    value={form.purchase_price}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, purchase_price: v }))
                    }
                  />
                  <Field
                    label="Last Neg. Price"
                    value={form.last_negotiation_price}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, last_negotiation_price: v }))
                    }
                  />
                </>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, type = "number" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
