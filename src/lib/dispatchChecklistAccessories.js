export function buildChecklistAccessoriesUrl(itemCode, godown = null) {
  const params = new URLSearchParams({
    product_code: itemCode,
    package_status: "available",
    resolve_product: "1",
  });
  if (godown) params.set("godown", godown);
  return `/api/product-accessories?${params.toString()}`;
}
