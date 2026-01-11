// /app/service-report/[service_id]/page.jsx

import ServiceReportForm from "@/components/services/ServiceReportForm";
import InstallationUploadModal from "@/components/models/uploadModel";

async function getServiceReportData(serviceId) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/generate-report/service/${serviceId}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to fetch service report data");
  }
  return res.json();
}

export default async function ServiceReportPage({ params }) {
  const { service_id } = params;

  let reportData = null;
  let error = null;

  try {
    reportData = await getServiceReportData(service_id);
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500 text-lg">Error: {error}</p>
      </div>
    );
  }

  console.log("****************************************");
  console.log("this is the data we have: ", reportData);

  return (
    <div className="container mx-auto md:p-4">
      <InstallationUploadModal serviceId={service_id} />

      <ServiceReportForm initialData={reportData} />
    </div>
  );
}
