"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatCrmDateOnly } from "@/lib/crmDateFormat";

function fmtDate(v) {
  if (!v) return "—";
  const s = formatCrmDateOnly(v);
  return s || String(v);
}

function Row({ label, value, className = "" }) {
  const text = value == null || String(value).trim() === "" ? null : String(value);
  if (!text) return null;
  return (
    <div className={`text-sm ${className}`}>
      <span className="font-semibold text-gray-700">{label}: </span>
      <span className="text-gray-900 break-words">{text}</span>
    </div>
  );
}

function Section({ title, children }) {
  const hasContent = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  if (!hasContent) return null;
  return (
    <section className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50/80 space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function warrantyStatus(installDate, warrantyMonths) {
  if (!installDate || !warrantyMonths) {
    return { label: "—", className: "text-gray-500" };
  }
  try {
    const install = new Date(installDate);
    const expiry = new Date(install);
    expiry.setMonth(expiry.getMonth() + parseInt(warrantyMonths, 10));
    return new Date() <= expiry
      ? { label: "In Warranty", className: "text-green-700 font-semibold" }
      : { label: "Out of Warranty", className: "text-red-700 font-semibold" };
  } catch {
    return { label: "—", className: "text-gray-500" };
  }
}

export default function MachineRegistrationModal({
  isOpen,
  onClose,
  serialNumber,
  dashboardPath = "admin-dashboard",
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);

  useEffect(() => {
    if (!isOpen || !serialNumber) {
      setProduct(null);
      setError("");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/warranty-products/${encodeURIComponent(serialNumber.trim())}`,
          { credentials: "include" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Machine registration not found.");
        }
        if (!cancelled) setProduct(data);
      } catch (e) {
        if (!cancelled) {
          setProduct(null);
          setError(e.message || "Failed to load registration.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, serialNumber]);

  if (typeof window === "undefined" || !isOpen) return null;

  const wStatus = product
    ? warrantyStatus(product.installation_date, product.warranty_period)
    : null;

  const reportFiles = product?.report_file
    ? String(product.report_file)
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
    : [];

  const canEdit =
    dashboardPath === "admin-dashboard" ||
    dashboardPath === "user-dashboard";

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Machine registration"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl max-h-[min(92vh,720px)] flex flex-col rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              Machine registration
            </h2>
            <p className="text-xs text-gray-500 truncate">
              Serial: {serialNumber || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-600">
              <Loader2 className="animate-spin" size={22} />
              Loading…
            </div>
          ) : null}

          {!loading && error ? (
            <p className="text-sm text-red-600 py-6 text-center">{error}</p>
          ) : null}

          {!loading && product ? (
            <>
              <Section title="Product">
                <Row label="Product" value={product.product_name} />
                <Row label="Model" value={product.model} />
                <Row label="Specification" value={product.specification} />
                <Row label="Serial number" value={product.serial_number} />
                <Row label="Service type" value={product.service_type} />
                <Row label="Quantity" value={product.quantity} />
                <Row label="Warranty (months)" value={product.warranty_period} />
                {wStatus ? (
                  <div className="text-sm">
                    <span className="font-semibold text-gray-700">Warranty status: </span>
                    <span className={wStatus.className}>{wStatus.label}</span>
                  </div>
                ) : null}
              </Section>

              <Section title="Company / customer">
                <Row label="Company" value={product.customer_name} />
                <Row label="Contact person" value={product.contact_person} />
                <Row label="Phone" value={product.contact} />
                <Row label="Email" value={product.email} />
                <Row label="Address" value={product.customer_address} />
                <Row label="State" value={product.state} />
                <Row label="GSTIN" value={product.gstin} />
              </Section>

              <Section title="Installation">
                <Row label="Installed address" value={product.installed_address} />
                <Row label="Installation date" value={fmtDate(product.installation_date)} />
              </Section>

              <Section title="Site contact">
                <Row label="Site person" value={product.site_person} />
                <Row label="Site phone" value={product.site_contact} />
                <Row label="Site email" value={product.site_email} />
              </Section>

              <Section title="Location">
                <Row label="Latitude" value={product.lat} />
                <Row label="Longitude" value={product.longt} />
                {product.lat && product.longt ? (
                  <a
                    href={`https://www.google.com/maps?q=${product.lat},${product.longt}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    Open in Maps
                    <ExternalLink size={14} />
                  </a>
                ) : null}
              </Section>

              <Section title="Invoice">
                <Row label="Invoice number" value={product.invoice_number} />
                <Row label="Invoice date" value={fmtDate(product.invoice_date)} />
                {product.invoice_file ? (
                  <a
                    href={`/uploads/${product.invoice_file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View invoice file
                  </a>
                ) : null}
              </Section>

              {reportFiles.length > 0 ? (
                <Section title="Service reports (registration)">
                  {reportFiles.map((f, idx) => (
                    <a
                      key={f}
                      href={`/uploads/${f}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:underline"
                    >
                      Report {idx + 1}
                    </a>
                  ))}
                </Section>
              ) : null}

              {(product.updated_at || product.updated_by) && (
                <Section title="Record">
                  <Row label="Last updated" value={fmtDate(product.updated_at)} />
                  <Row label="Updated by" value={product.updated_by} />
                </Section>
              )}
            </>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          {canEdit && product?.serial_number ? (
            <Link
              href={`/${dashboardPath}/warranty/edit/${encodeURIComponent(product.serial_number)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-2 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Edit registration
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
