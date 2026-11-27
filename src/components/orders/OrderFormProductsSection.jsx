function quotationItemImageSrc(imgUrl) {
  const src = String(imgUrl ?? "").trim();
  return src || null;
}

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "—";
}

export function orderFormQuotationHideGst(quotation) {
  const raw =
    quotation?.hide_gst_breakdown ?? quotation?.header?.hide_gst_breakdown;
  return raw === 1 || raw === true || raw === "1";
}

export default function OrderFormProductsSection({ items, hideTaxColumns }) {
  if (!items?.length) {
    return <p className="text-sm text-gray-500">No products on quotation.</p>;
  }

  return (
    <>
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full text-sm table-auto border">
        <thead className="bg-gray-100">
          <tr className="divide-x">
            {[
              "Image",
              "Name",
              "Code",
              "Spec",
              "Qty",
              "Unit",
              "Price/Unit",
              ...(hideTaxColumns ? [] : ["Taxable", "GST"]),
              "Total",
            ].map((h) => (
              <th key={h} className="px-2 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => {
            const itemImg = quotationItemImageSrc(i.img_url);
            return (
              <tr key={idx} className="divide-x text-center border-t">
                <td className="p-2">
                  {itemImg ? (
                    <img
                      src={itemImg}
                      alt=""
                      className="h-12 mx-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td>{i.item_name}</td>
                <td>{i.item_code}</td>
                <td>{i.specification}</td>
                <td>{i.quantity}</td>
                <td>{i.unit}</td>
                <td>₹{i.price_per_unit}</td>
                {!hideTaxColumns ? (
                  <>
                    <td>{formatMoney(i.taxable_price ?? i.total_taxable_amt)}</td>
                    <td>
                      {i.gst != null && i.gst !== ""
                        ? `${Number(i.gst)}%`
                        : "—"}
                    </td>
                  </>
                ) : null}
                <td>{formatMoney(i.total_price)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    <div className="md:hidden space-y-4">
      {items.map((i, idx) => {
        const itemImg = quotationItemImageSrc(i.img_url);
        return (
          <div
            key={idx}
            className="border rounded p-3 shadow-sm bg-white text-sm"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{i.item_name}</span>
              {itemImg ? (
                <img
                  src={itemImg}
                  alt=""
                  className="h-10 w-10 object-contain"
                />
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-gray-700">
              <div>
                <strong>Code:</strong> {i.item_code}
              </div>
              <div>
                <strong>Spec:</strong> {i.specification}
              </div>
              <div>
                <strong>Qty:</strong> {i.quantity}
              </div>
              <div>
                <strong>Unit:</strong> {i.unit}
              </div>
              <div>
                <strong>Price:</strong> ₹{i.price_per_unit}
              </div>
              {!hideTaxColumns ? (
                <>
                  <div>
                    <strong>Taxable:</strong>{" "}
                    {formatMoney(i.taxable_price ?? i.total_taxable_amt)}
                  </div>
                  <div>
                    <strong>GST:</strong>{" "}
                    {i.gst != null && i.gst !== "" ? `${Number(i.gst)}%` : "—"}
                  </div>
                </>
              ) : null}
              <div>
                <strong>Total:</strong> {formatMoney(i.total_price)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </>
  );
}