"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import "@/app/user-dashboard/view-service-report/[service_id]/print.css";
import {
  getInstallationReportLink,
  productAttachmentSrc,
} from "@/lib/serviceInstallationReport";

export default function WarrantyCompletionReportPage() {
  const { service_id } = useParams();
  const pathname = usePathname();
  const dashboardBase =
    pathname?.match(/^(\/[^/]+-dashboard)/)?.[1] || "/admin-dashboard";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!service_id) return;
    fetch(`/api/completion-report?service_id=${service_id}`)
      .then((res) => res.json().then((js) => ({ ok: res.ok, body: js })))
      .then(({ ok, body }) => {
        if (!ok) {
          setError(body.error || "Unable to fetch data");
        } else {
          setData(body);
        }
      })
      .catch(() => setError("Fetch failed"))
      .finally(() => setLoading(false));
  }, [service_id]);

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;
  if (!data?.service) {
    return (
      <p className="text-center mt-10 text-red-600">Service data not found.</p>
    );
  }

  const service = data.service;
  const product = data.product || {};
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  const completion_images = Array.isArray(data.completion_images)
    ? data.completion_images
    : [];
  const installation_report = data.installation_report;

  const reportLink = getInstallationReportLink(
    installation_report,
    service.service_id,
    dashboardBase,
  );

  const warrantyExpiry = product?.installation_date
    ? new Date(
        new Date(product.installation_date).setMonth(
          new Date(product.installation_date).getMonth() +
            product.warranty_period,
        ),
      )
    : null;

  return (
    <div className="print-page-wrapper">
    <div className="print-card max-w-4xl mx-auto p-6 bg-white rounded shadow mt-6 print:mt-0 print:shadow-none">
      <h1 className="text-2xl font-bold mb-4 text-blue-600 text-center">
        Service Report
      </h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border rounded bg-gray-50 space-y-2">
          <p>
            <strong>Service ID:</strong> {service.service_id}
          </p>
          <p>
            <strong>Customer:</strong> {product?.customer_name}
          </p>
          <p>
            <strong>Email:</strong> {product?.email}
          </p>
          <p>
            <strong>Contact:</strong> {product?.contact}
          </p>
          <p>
            <strong>Address:</strong> {product?.customer_address}
          </p>
          <p>
            <strong>Installed Address:</strong> {product?.installed_address}
          </p>
        </div>
        <div className="p-4 border rounded bg-gray-50 space-y-2">
          <p>
            <strong>Product:</strong> {product?.product_name}
          </p>
          <p>
            <strong>Serial No:</strong> {product?.serial_number}
          </p>
          <p>
            <strong>Model:</strong> {product?.model}
          </p>
          <p>
            <strong>Invoice #:</strong> {product?.invoice_number}
          </p>
          <p>
            <strong>Invoice Date:</strong> {product?.invoice_date}
          </p>
          <p>
            <strong>Installed on:</strong> {product?.installation_date}
          </p>
          <p>
            <strong>Warranty:</strong> {product?.warranty_period} months
          </p>
          <p>
            <strong>Expiry:</strong> {warrantyExpiry?.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-4 p-4 bg-red-100 border rounded">
        <p>
          <strong>Complaint Summary:</strong> {service.complaint_summary}
        </p>
      </div>

      {attachments.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Product Images</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-2">
            {attachments.map((img, i) => {
              const src = productAttachmentSrc(img);
              if (!src) return null;
              return (
                <img
                  key={i}
                  src={src}
                  alt={`Att ${i + 1}`}
                  className="w-full rounded border"
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-green-50 border rounded">
        <p>
          <strong>Status:</strong> {service.status}
        </p>
        <p>
          <strong>Completed Date:</strong> {service.completed_date}
        </p>
        <p>
          <strong>Action Taken:</strong> {service.completion_remark}
        </p>
        <p>
          <strong>Handled By:</strong> {service.assigned_to}
        </p>
      </div>

      {reportLink && (
        <div className="mt-4 no-print">
          <a
            href={reportLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {reportLink.label}
          </a>
        </div>
      )}

      {completion_images?.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Completion Images</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-2">
            {completion_images.map((img, i) => (
              <img
                key={i}
                src={`/completion_files/${img}`}
                alt={`Comp ${i + 1}`}
                className="w-full rounded border"
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-center no-print">
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-gray-700 text-white px-6 py-2 rounded hover:bg-gray-900"
        >
          Print Report
        </button>
      </div>
    </div>
    </div>
  );
}
