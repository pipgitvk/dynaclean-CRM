import { warehouseInQtyFields } from "@/lib/warehouseInQuantities";

/** Group pending warehouse-in rows by supplier invoice (product requests). */
export function buildWarehouseInDisplayGroups(requests) {
  const list = Array.isArray(requests) ? requests : [];
  const byInvoice = new Map();
  const solo = [];

  for (const r of list) {
    const inv = String(r.invoice_number ?? "").trim();
    if (r.__source === "product" && inv) {
      const key = inv.toLowerCase();
      if (!byInvoice.has(key)) {
        byInvoice.set(key, {
          kind: "invoice",
          groupKey: `invoice|product|${key}`,
          invoice_number: inv,
          invoice_date: r.invoice_date ?? null,
          from_company: r.from_company ?? "",
          items: [],
          __sources: new Set(["product"]),
        });
      }
      const g = byInvoice.get(key);
      g.items.push(r);
      if (r.invoice_date && !g.invoice_date) g.invoice_date = r.invoice_date;
      if (r.created_at) {
        const t = new Date(r.created_at).getTime();
        if (!g._newest || t > g._newest) g._newest = t;
        if (!g._oldest || t < g._oldest) g._oldest = t;
      }
    } else {
      solo.push({
        kind: "solo",
        groupKey: `solo|${r.__source}|${r.id}`,
        invoice_number: inv || null,
        invoice_date: r.invoice_date ?? null,
        from_company: r.from_company ?? "",
        items: [r],
        __sources: new Set([r.__source]),
      });
    }
  }

  const invoiceGroups = [...byInvoice.values()].map((g) => {
    const totalQty = g.items.reduce(
      (s, i) => s + warehouseInQtyFields(i).remaining,
      0,
    );
    return {
      kind: "invoice",
      groupKey: g.groupKey,
      invoice_number: g.invoice_number,
      invoice_date: g.invoice_date,
      from_company: g.from_company,
      items: g.items,
      itemCount: g.items.length,
      totalQty,
      created_at: g._newest ? new Date(g._newest).toISOString() : null,
      label: g.invoice_number,
    };
  });

  const soloGroups = solo.map((g) => ({
    ...g,
    itemCount: 1,
    totalQty: warehouseInQtyFields(g.items[0]).remaining,
    created_at: g.items[0]?.created_at ?? null,
    label:
      g.invoice_number ||
      `Req #${g.items[0]?.id} · ${g.items[0]?.product_name || "Item"}`,
  }));

  return [...invoiceGroups, ...soloGroups].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

/** Parse supporting_doc DB value (single path or JSON array). */
export function parseSupportingDocPaths(value) {
  if (value == null || value === "") return [];
  const s = String(value).trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {
      return [s];
    }
  }
  return [s];
}
