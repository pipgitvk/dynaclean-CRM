"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Copy, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

const inputClass =
  "h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200/90";

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const emptyForm = () => ({
  ship_from: "",
  ship_to: "",
  cbm: "",
  shipment_term: "FOB",
  mode: "Sea",
  material_ready_date: "",
  agent_delivery_deadline: "",
  remarks: "",
  crm_agent_ids: [],
  supplier_ids: [],
});

function agentOptionLabel(a) {
  const c = a.company_name && String(a.company_name).trim();
  return c || a.agent_name || `Agent #${a.id}`;
}

function supplierOptionLabel(s) {
  const n = s.supplier_name && String(s.supplier_name).trim();
  return n || (s.factory_name && String(s.factory_name).trim()) || `Supplier #${s.id}`;
}

export default function ShipmentsListClient() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [linkOrigin, setLinkOrigin] = useState("");
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [regeneratingLinkId, setRegeneratingLinkId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/import-crm/shipments");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load");
      setShipments(data.shipments || []);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLinkOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    let cancelled = false;
    (async () => {
      setAgentsLoading(true);
      setSuppliersLoading(true);
      try {
        const [agentsRes, suppliersRes] = await Promise.all([
          fetch("/api/import-crm/agents"),
          fetch("/api/import-crm/suppliers"),
        ]);
        const agentsData = await agentsRes.json();
        const suppliersData = await suppliersRes.json();
        if (cancelled) return;
        if (!agentsRes.ok) {
          throw new Error(agentsData.message || "Failed to load agents");
        }
        if (!suppliersRes.ok) {
          throw new Error(suppliersData.message || "Failed to load suppliers");
        }
        setAgents(agentsData.agents || []);
        setSuppliers(suppliersData.suppliers || []);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error(e.message || "Could not load agents or suppliers");
          setAgents([]);
          setSuppliers([]);
        }
      } finally {
        if (!cancelled) {
          setAgentsLoading(false);
          setSuppliersLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerOpen]);

  const shipmentPublicUrl = useCallback(
    (token) => {
      if (!token) return "";
      const path = `/import-shipment/${token}`;
      return linkOrigin ? `${linkOrigin}${path}` : path;
    },
    [linkOrigin],
  );

  const copyShipmentLink = useCallback(
    async (token) => {
      const text = shipmentPublicUrl(token);
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Link copied");
      } catch {
        toast.error("Could not copy link");
      }
    },
    [shipmentPublicUrl],
  );

  const regeneratePublicLink = useCallback(
    async (shipmentId) => {
      const ok = window.confirm(
        "Regenerate this share link?\n\n• The old URL will stop working.\n• Past quote submissions stay in Quote submissions (not deleted).\n• The same email can submit again using the new link.",
      );
      if (!ok) return;
      setRegeneratingLinkId(shipmentId);
      try {
        const res = await fetch(
          `/api/import-crm/shipments/${shipmentId}/regenerate-public-link`,
          { method: "POST" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to regenerate");
        const url =
          typeof window !== "undefined" && data.public_link_token
            ? `${window.location.origin}/import-shipment/${data.public_link_token}`
            : "";
        if (url) {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("New link ready — copied to clipboard");
          } catch {
            toast.success(data.message || "New link ready — use Copy full link");
          }
        } else {
          toast.success(data.message || "Link regenerated");
        }
        await load();
      } catch (e) {
        console.error(e);
        toast.error(e.message || "Could not regenerate link");
      } finally {
        setRegeneratingLinkId(null);
      }
    },
    [load],
  );

  const update = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleAgentId = (id) => {
    setForm((f) => {
      const set = new Set(f.crm_agent_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, crm_agent_ids: [...set].sort((a, b) => a - b) };
    });
  };

  const toggleSupplierId = (id) => {
    setForm((f) => {
      const set = new Set(f.supplier_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, supplier_ids: [...set].sort((a, b) => a - b) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ship_from: form.ship_from,
      ship_to: form.ship_to,
      cbm: form.cbm,
      shipment_term: form.shipment_term,
      mode: form.mode,
      material_ready_date: form.material_ready_date || null,
      agent_delivery_deadline: form.agent_delivery_deadline || null,
      remarks: form.remarks || null,
      crm_agent_ids: form.crm_agent_ids || [],
      supplier_ids: form.supplier_ids || [],
    };
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/import-crm/shipments/${editingId}` : "/api/import-crm/shipments",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      if (!isEdit && data.public_link_token && typeof window !== "undefined") {
        const url = `${window.location.origin}/import-shipment/${data.public_link_token}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Saved — share link copied to clipboard");
        } catch {
          toast.success(data.message || "Saved");
        }
      } else {
        toast.success(data.message || "Saved");
      }
      setForm(emptyForm());
      setEditingId(null);
      setDrawerOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this shipment record?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/import-crm/shipments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const openShipmentDrawer = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  };

  const openEditDrawer = (s) => {
    setEditingId(s.id);
    setForm({
      ship_from: s.ship_from || "",
      ship_to: s.ship_to || "",
      cbm: s.cbm != null ? String(s.cbm) : "",
      shipment_term: s.shipment_term || "FOB",
      mode: s.mode || "Sea",
      material_ready_date: s.material_ready_date
        ? String(s.material_ready_date).slice(0, 10)
        : "",
      agent_delivery_deadline: s.agent_delivery_deadline
        ? String(s.agent_delivery_deadline).slice(0, 10)
        : "",
      remarks: s.remarks || "",
      crm_agent_ids: (() => {
        try { return JSON.parse(s.shipment_crm_agent_ids_json || "[]").map(Number); }
        catch { return s.crm_agent_id ? [Number(s.crm_agent_id)] : []; }
      })(),
      supplier_ids: (() => {
        try { return JSON.parse(s.shipment_supplier_ids_json || "[]").map(Number); }
        catch { return s.supplier_id ? [Number(s.supplier_id)] : []; }
      })(),
    });
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openShipmentDrawer}
          className="h-11 w-full shrink-0 rounded-[10px] bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:w-auto sm:min-w-[11rem]"
        >
          Add New Shipment
        </button>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        transition
        className="relative z-[200]"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-slate-900/40 transition duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex justify-end overflow-hidden">
          <DialogPanel
            transition
            className="flex h-full w-full max-w-2xl transform flex-col border-l border-slate-200 bg-white shadow-2xl transition duration-300 ease-out data-[closed]:translate-x-full"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <DialogTitle className="text-base font-semibold text-slate-900">
                {editingId ? `Edit shipment #${editingId}` : "New shipment"}
              </DialogTitle>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm());
                    setEditingId(null);
                    setDrawerOpen(false);
                  }}
                  className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  {editingId ? "Discard & close" : "Clear & close"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setDrawerOpen(false); }}
                  className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>From (origin)</label>
                    <input
                      className={inputClass}
                      value={form.ship_from}
                      onChange={(e) => update("ship_from", e.target.value)}
                      placeholder="e.g. Shanghai, China"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>To (destination)</label>
                    <input
                      className={inputClass}
                      value={form.ship_to}
                      onChange={(e) => update("ship_to", e.target.value)}
                      placeholder="e.g. Nhava Sheva, India"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CBM (cubic metres)</label>
                    <input
                      className={inputClass}
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form.cbm}
                      onChange={(e) => update("cbm", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Shipment term (FOB / FCA / CIF)
                    </label>
                    <select
                      className={inputClass}
                      value={form.shipment_term}
                      onChange={(e) =>
                        update("shipment_term", e.target.value)
                      }
                    >
                      <option value="FOB">FOB</option>
                      <option value="FCA">FCA</option>
                      <option value="CIF">CIF</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Mode (Sea / Air)</label>
                    <select
                      className={inputClass}
                      value={form.mode}
                      onChange={(e) => update("mode", e.target.value)}
                    >
                      <option value="Sea">Sea</option>
                      <option value="Air">Air</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Assign import agents
                    </label>
                    <div
                      className="max-h-40 overflow-y-auto rounded-[10px] border border-slate-200 bg-slate-50/50 px-2 py-2"
                      aria-busy={agentsLoading}
                    >
                      {agentsLoading ? (
                        <p className="px-2 py-2 text-xs text-slate-500">
                          Loading agents…
                        </p>
                      ) : agents.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-500">
                          No agents yet. Add them under Import CRM → Agents.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {agents.map((a) => (
                            <li key={a.id}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                                  checked={form.crm_agent_ids.includes(a.id)}
                                  onChange={() => toggleAgentId(a.id)}
                                />
                                <span className="text-slate-800">
                                  {agentOptionLabel(a)}
                                  <span className="ml-1 font-mono text-[11px] text-slate-500">
                                    #{a.id}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Assign suppliers
                    </label>
                    <div
                      className="max-h-40 overflow-y-auto rounded-[10px] border border-slate-200 bg-slate-50/50 px-2 py-2"
                      aria-busy={suppliersLoading}
                    >
                      {suppliersLoading ? (
                        <p className="px-2 py-2 text-xs text-slate-500">
                          Loading suppliers…
                        </p>
                      ) : suppliers.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-slate-500">
                          No suppliers yet. Add them under Import CRM → Suppliers.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {suppliers.map((s) => (
                            <li key={s.id}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                                  checked={form.supplier_ids.includes(s.id)}
                                  onChange={() => toggleSupplierId(s.id)}
                                />
                                <span className="text-slate-800">
                                  {supplierOptionLabel(s)}
                                  <span className="ml-1 font-mono text-[11px] text-slate-500">
                                    #{s.id}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Material ready date</label>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.material_ready_date}
                      onChange={(e) =>
                        update("material_ready_date", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Agent delivery deadline
                    </label>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.agent_delivery_deadline}
                      onChange={(e) =>
                        update("agent_delivery_deadline", e.target.value)
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Extra remarks</label>
                    <textarea
                      className={`${inputClass} min-h-[88px] py-2`}
                      value={form.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                      rows={3}
                      placeholder="Optional notes…"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-[10px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "Saving…" : editingId ? "Update shipment" : "Save shipment"}
                </button>
              </form>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          Saved shipments
        </h2>
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-slate-600">
          Anyone with the link sees shipment details and the quote form. Submitters
          enter an email; the same email cannot submit twice on the same link
          until you click <span className="font-medium">Regenerate</span> next to
          Copy — that creates a new URL so the same email can submit again.
          Older submissions remain in Quote submissions.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm text-slate-800">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-3 sm:px-4">ID</th>
                <th className="px-3 py-3 sm:px-4">From</th>
                <th className="px-3 py-3 sm:px-4">To</th>
                <th className="px-3 py-3 sm:px-4">CBM</th>
                <th className="px-3 py-3 sm:px-4">Term</th>
                <th className="px-3 py-3 sm:px-4">Mode</th>
                <th className="px-3 py-3 sm:px-4">Agents / suppliers</th>
                <th className="px-3 py-3 sm:px-4">Ready</th>
                <th className="px-3 py-3 sm:px-4">Agent deadline</th>
                <th className="px-3 py-3 sm:px-4">Remarks</th>
                <th className="px-3 py-3 sm:px-4">Status</th>
                <th className="px-3 py-3 sm:px-4">Created</th>
                <th className="px-3 py-3 sm:px-4">Share link</th>
                <th className="px-3 py-3 sm:px-4 w-12" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Loading…
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No shipments yet. Click &quot;Add New Shipment&quot; to add
                    one.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium sm:px-4">
                      {s.id}
                    </td>
                    <td className="max-w-[10rem] px-3 py-2.5 sm:max-w-[14rem] sm:px-4">
                      <span className="line-clamp-2">{s.ship_from}</span>
                    </td>
                    <td className="max-w-[10rem] px-3 py-2.5 sm:max-w-[14rem] sm:px-4">
                      <span className="line-clamp-2">{s.ship_to}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      {s.cbm != null ? Number(s.cbm).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      {s.shipment_term}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      {s.mode}
                    </td>
                    <td className="max-w-[16rem] px-3 py-2.5 text-xs sm:px-4">
                      <div className="space-y-1">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Agents
                          </span>
                          <div
                            className="line-clamp-3 text-slate-800"
                            title={s.agents_display || ""}
                          >
                            {s.agents_display && s.agents_display !== "—"
                              ? s.agents_display
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Suppliers
                          </span>
                          <div
                            className="line-clamp-3 text-slate-800"
                            title={s.suppliers_display || ""}
                          >
                            {s.suppliers_display && s.suppliers_display !== "—"
                              ? s.suppliers_display
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4">
                      {formatDate(s.material_ready_date)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs sm:px-4">
                      {formatDate(s.agent_delivery_deadline)}
                    </td>
                    <td className="max-w-[8rem] px-3 py-2.5 text-xs text-slate-600 sm:px-4">
                      <span className="line-clamp-2" title={s.remarks || ""}>
                        {s.remarks || "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 sm:px-4">
                      <ShipmentStatusBadge status={s.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600 sm:px-4">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="max-w-[18rem] px-3 py-2.5 align-top sm:px-4">
                      <div className="flex flex-col gap-1.5">
                        {s.public_link_token ? (
                          <a
                            href={shipmentPublicUrl(s.public_link_token)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-xs font-medium text-blue-600 hover:underline"
                            title={shipmentPublicUrl(s.public_link_token)}
                          >
                            /import-shipment/
                            {s.public_link_token.slice(0, 10)}…
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No link yet</span>
                        )}
                        <div className="flex flex-wrap items-center gap-1">
                          {s.public_link_token ? (
                            <button
                              type="button"
                              onClick={() =>
                                copyShipmentLink(s.public_link_token)
                              }
                              disabled={regeneratingLinkId === s.id}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Copy className="h-3 w-3 shrink-0" />
                              Copy full link
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => regeneratePublicLink(s.id)}
                            disabled={regeneratingLinkId === s.id}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                            title="New URL; same email can submit again (old quotes stay in admin)"
                          >
                            <RefreshCw
                              className={`h-3 w-3 shrink-0 ${regeneratingLinkId === s.id ? "animate-spin" : ""}`}
                            />
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditDrawer(s)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Edit shipment"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const STATUS_STYLES = {
  PENDING:               "bg-slate-100 text-slate-700",
  AWARDED:               "bg-amber-100 text-amber-900",
  EXECUTION_APPROVED:    "bg-blue-100 text-blue-900",
  APPROVED_FOR_MOVEMENT: "bg-emerald-100 text-emerald-900",
  BILL_APPROVAL_PENDING: "bg-orange-100 text-orange-900",
  BILL_PAYMENT_PENDING:  "bg-violet-100 text-violet-900",
  COMPLETED:             "bg-green-100 text-green-900",
};

const STATUS_LABELS = {
  PENDING:               "Pending",
  AWARDED:               "Awarded",
  EXECUTION_APPROVED:    "Execution approved",
  APPROVED_FOR_MOVEMENT: "Approved for movement",
  BILL_APPROVAL_PENDING: "Bill approval pending",
  BILL_PAYMENT_PENDING:  "Bill payment pending",
  COMPLETED:             "Completed",
};

function ShipmentStatusBadge({ status }) {
  const key = String(status || "PENDING").toUpperCase();
  const cls = STATUS_STYLES[key] ?? "bg-slate-100 text-slate-600";
  const label = STATUS_LABELS[key] ?? key;
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}
