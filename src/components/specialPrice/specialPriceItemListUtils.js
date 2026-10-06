export function filterSpecialPriceItems(items, { search = "", typeFilter = "all" }) {
  let list = Array.isArray(items) ? items : [];
  if (typeFilter === "product") {
    list = list.filter((i) => i._type === "product");
  } else if (typeFilter === "spare") {
    list = list.filter((i) => i._type === "spare");
  }

  const q = String(search || "").trim().toLowerCase();
  if (!q) return list;

  return list.filter((p) => {
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
}

export function getSpecialPriceItemKey(item) {
  return `${item._type}-${item.id}`;
}
