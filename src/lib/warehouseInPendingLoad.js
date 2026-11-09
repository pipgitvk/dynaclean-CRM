/** Load pending product + spare warehouse-in requests with normalized fields. */
export async function fetchPendingWarehouseInRequests() {
  const [productRes, spareRes] = await Promise.all([
    fetch("/api/warehouse-in"),
    fetch("/api/spare/warehouse-in"),
  ]);

  let productRequests = [];
  let spareRequests = [];

  if (productRes.ok) {
    const data = await productRes.json();
    productRequests = (Array.isArray(data) ? data : []).map((r) => ({
      ...r,
      __source: "product",
      category: r.category || "Product",
      product_code: r.product_code,
      product_name: r.product_name,
      product_image: r.product_image,
    }));
  }
  if (spareRes.ok) {
    const data = await spareRes.json();
    spareRequests = (Array.isArray(data) ? data : []).map((r) => ({
      ...r,
      __source: "spare",
      category: "Spare",
      product_code: r.spare_id ?? r.product_code ?? `SP${r.id}`,
      product_name: r.spare_name ?? r.product_name ?? `Spare #${r.id}`,
      product_image: r.spare_image ?? r.product_image ?? null,
    }));
  }

  return [...productRequests, ...spareRequests].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
}
