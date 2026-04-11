/**
 * Used only on product-stock pages (`admin-dashboard/product-stock`, `user-dashboard/product-stock`).
 * Prefer http(s) (e.g. Cloudinary) in `product_image` over stale `product_images.image_path`.
 */
export function pickProductImageUrl(imagePath, productImage) {
  const a = (imagePath ?? "").toString().trim();
  const b = (productImage ?? "").toString().trim();
  if (a.startsWith("http://") || a.startsWith("https://")) return a;
  if (b.startsWith("http://") || b.startsWith("https://")) return b;
  return a || b || "";
}
