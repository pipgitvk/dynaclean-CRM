// app/complete-service/[service_id]/page.jsx
import { getDbConnection } from "@/lib/db";
import Image from "next/image";
import dayjs from "dayjs";
import ServiceForm from "./ServiceForm";
import UpdateReportButton from "@/components/UpdateReportButton";

export const dynamic = "force-dynamic";

export default async function CompleteServicePage({ params }) {
  const serviceId = params.service_id;
  const conn = await getDbConnection();

  const [[service]] = await conn.execute(
    "SELECT * FROM service_records WHERE service_id = ?",
    [serviceId]
  );

  const [[product]] = await conn.execute(
    "SELECT * FROM warranty_products WHERE serial_number = ?",
    [service?.serial_number]
  );

  const [[report]] = await conn.execute(
    "SELECT * FROM service_reports WHERE service_id = ?",
    [serviceId]
  );

  const warrantyExpiry = product?.installation_date
    ? dayjs(product.installation_date)
      .add(product.warranty_period, "month")
      .format("DD-MM-YYYY")
    : "N/A";

  const attachments = service?.attachments
    ? service.attachments.split(",")
    : [];

  const combinedServiceData = {
    ...service,
    ...report,
    product,
    warrantyExpiry,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8  border">
      <div className="mt-8">
        <UpdateReportButton serviceId={serviceId} />
      </div>
      <div id="service-page-content">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 pb-4  ">
          <div className="mb-4 sm:mb-0 sm:w-1/4 flex-shrink-0 ">
            <img
              src="/images/logo.png"
              alt="Dynaclean Industries Logo"
              width={120}
              height={120}
              className="mx-auto sm:mx-0"
            />
          </div>
          <div className="sm:w-3/4 text-center sm:text-right">
            <h1
              className="text-l md:text-2xl sm:text-3xl font-bold"
              style={{ color: "#B91C1C" }} // ✅ red in HEX
            >
              DYNACLEAN INDUSTRIES
            </h1>

            <address
              className="not-italic text-sm text-gray-600 mt-2"
              style={{ color: "#4B5563" }}
            >
              1ST Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,
              Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, Pin: 641006.
            </address>
            <div
              className="text-sm text-gray-600 mt-2"
              style={{ color: "#4B5563" }}
            >
              <p>
                Email:{" "}
                <a
                  href="mailto:service@dynacleanindustries.com"
                  className="hover:underline"
                  style={{ color: "#2563EB" }} // ✅ blue in HEX
                >
                  service@dynacleanindustries.com
                </a>
                ,{" "}
                <a
                  href="mailto:sales@dynacleanindustries.com"
                  className="hover:underline"
                  style={{ color: "#2563EB" }}
                >
                  sales@dynacleanindustries.com
                </a>
              </p>
              <p>Phone: 011-45143666, +91-9205551085, +91-7982456944</p>
            </div>
          </div>
        </header>
        <div
          className="grid md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded shadow border w-full"
          style={{ backgroundColor: "#F9FAFB" }}
        >
          <div>
            <p>
              <strong>Service ID:</strong> {combinedServiceData.service_id}
            </p>
            <p>
              <strong>Customer Name:</strong>{" "}
              {combinedServiceData.product?.customer_name}
            </p>
            <p>
              <strong>Email:</strong> {combinedServiceData.product?.email}
            </p>
            <p>
              <strong>Contact:</strong> {combinedServiceData.product?.contact}
            </p>
            <p>
              <strong>Address:</strong>{" "}
              {combinedServiceData.product?.customer_address}
            </p>
            <p>
              <strong>Installed Address:</strong>{" "}
              {combinedServiceData.product?.installed_address}
            </p>
          </div>
          <div>
            <p>
              <strong>Product:</strong>{" "}
              {combinedServiceData.product?.product_name}
            </p>
            <p>
              <strong>Specification:</strong>{" "}
              {combinedServiceData.product?.specification}
            </p>
            <p>
              <strong>Model:</strong> {combinedServiceData.product?.model}
            </p>
            <p>
              <strong>Serial Number:</strong>{" "}
              {combinedServiceData.product?.serial_number}
            </p>
            <p>
              <strong>Invoice No:</strong>{" "}
              {combinedServiceData.product?.invoice_number}
            </p>
            <p>
              <strong>Invoice Date:</strong>{" "}
              {combinedServiceData.product?.invoice_date
                ? dayjs(combinedServiceData.product.invoice_date).format(
                  "DD-MM-YYYY"
                )
                : "N/A"}
            </p>
            <p>
              <strong>Warranty Expiry:</strong>{" "}
              {combinedServiceData.warrantyExpiry}
            </p>
          </div>
        </div>
        <div
          className="bg-gray-100 p-4 rounded shadow"
          style={{ backgroundColor: "#F3F4F6" }}
        >
          <p>
            <strong>Complaint Summary:</strong>{" "}
            {combinedServiceData.complaint_summary}
          </p>
        </div>
        {attachments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold">Attached Images</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              {attachments.map((img, index) => (
                <img
                  key={index}
                  src={`/completion_files/${img}`}
                  alt="Attached"
                  width={300}
                  height={200}
                  className="rounded border"
                />
              ))}
            </div>
          </div>
        )}
        <ServiceForm service={combinedServiceData} />
      </div>

      {/* <PdfDownloadButton
        elementId="service-page-content"
        fileName={`service-report-${serviceId}.pdf`}
      /> */}
    </div>
  );
}
