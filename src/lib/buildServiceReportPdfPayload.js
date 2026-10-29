import dayjs from "dayjs";
import { isInstallationReportLayout } from "@/utils/reportLayout";

const DEFAULT_TRAINEE_ROW = { name: "", designation: "", contact: "" };

/** Minimum empty trainee rows on installation PDF (on-site handwriting). */
export const INSTALLATION_TRAINEE_PDF_MIN_ROWS = 3;

export function padTraineesForInstallationPdf(
  trainees,
  minRows = INSTALLATION_TRAINEE_PDF_MIN_ROWS,
) {
  const list = (trainees || []).map((t) => ({
    name: t?.name ?? "",
    designation: t?.designation ?? "",
    contact: t?.contact ?? "",
  }));
  while (list.length < minRows) {
    list.push({ ...DEFAULT_TRAINEE_ROW });
  }
  return list;
}

/**
 * Build PDF inputs matching complete-service ServiceForm submit (installation layout).
 */
export function buildServiceReportPdfPayload(service, options = {}) {
  const product = options.product ?? service?.product ?? null;
  const form = options.form || {};
  const spareParts = options.spareParts || [{ replaced: "", tobereplaced: "" }];
  const trainees =
    options.trainees && options.trainees.length > 0
      ? options.trainees
      : [DEFAULT_TRAINEE_ROW];

  const status =
    form.status ??
    (options.prefillNewReport ? "" : service?.status || "");
  const reportServiceDate =
    status === "COMPLETED"
      ? form.completed_date ||
        service?.completed_date ||
        dayjs().format("YYYY-MM-DD")
      : dayjs().format("YYYY-MM-DD");

  const complaintSummary =
    service?.complaint_summary || form.complaint_summary || "";

  const pdfInstallationLayout =
    options.isInstallationLayout ??
    (isInstallationReportLayout(complaintSummary) ||
      String(service?.service_type || "").toUpperCase() === "INSTALLATION");

  const useCompletionFields = status === "COMPLETED";

  const engineerSignatureData = form.engineerSignatureData ?? null;
  const customerSignatureData = form.customerSignatureData ?? null;

  const pdfData = {
    service_id: service?.service_id ?? form.service_id,
    serial_number: service?.serial_number ?? form.serial_number,
    status,
    complaint_date: reportServiceDate,
    complaint_number: service?.complaint_number,
    service_type: service?.service_type,
    reg_date: service?.reg_date,
    completed_date: form.completed_date || service?.completed_date,
    checklist: (form.checklist || []).join(","),
    nature_of_complaints:
      form.nature_of_complaint ??
      service?.nature_of_complaint ??
      service?.nature_of_complaints ??
      "",
    observation: form.observation ?? service?.observation ?? "",
    action_taken: form.action_taken ?? service?.action_taken ?? "",
    complaint_summary: complaintSummary,
    completion_remark: form.completion_remark ?? service?.completion_remark ?? "",
    replaced: spareParts.map((p) => p.replaced).join(","),
    to_be_replaced: spareParts.map((p) => p.tobereplaced).join(","),
    service_rate: form.service_rating ?? service?.service_rating ?? "",
    feedback: form.customer_feedback ?? service?.customer_feedback ?? "",
    authorised_person_name: useCompletionFields
      ? form.completion_engineer_name ?? ""
      : form.authorized_person_name ?? service?.authorized_person_name ?? "",
    authorised_person_designation: useCompletionFields
      ? form.completion_engineer_designation ?? ""
      : form.authorized_person_designation ??
        service?.authorized_person_designation ??
        "",
    authorised_person_mobile: useCompletionFields
      ? form.completion_engineer_mobile ?? ""
      : form.authorized_person_mobile ?? service?.authorized_person_mobile ?? "",
    customer_name: useCompletionFields
      ? form.completion_customer_name ?? ""
      : form.customer_name ?? service?.customer_name ?? "",
    customer_designation: useCompletionFields
      ? form.completion_customer_designation ?? ""
      : form.customer_designation ?? service?.customer_designation ?? "",
    customer_mobile: useCompletionFields
      ? form.completion_customer_mobile ?? ""
      : form.customer_mobile ?? service?.customer_mobile ?? "",
    authorised_person_sign_data: engineerSignatureData,
    customer_sign_data: customerSignatureData,
  };

  const productData = {
    product_name: product?.product_name || "",
    model: product?.model || "",
    customer_name: product?.customer_name || "",
    email: product?.email || "",
    contact: product?.contact || "",
    customer_address: product?.customer_address || "",
    installed_address: product?.installed_address || "",
    installation_date: product?.installation_date || "",
    invoice_number: product?.invoice_number || "",
    invoice_date: product?.invoice_date || "",
    contact_person:
      product?.contact_person || product?.site_person || "",
    site_person: product?.site_person || "",
  };

  let installData = null;
  if (pdfInstallationLayout) {
    installData = {
      installation_date: reportServiceDate,
      defects_on_inspection:
        form.defects_found ?? service?.defects_on_inspection ?? "",
      engineer_remarks:
        form.engineers_remark ?? service?.engineer_remarks ?? "",
      service_rating: form.service_rating ?? service?.service_rating ?? "",
      customer_feedback: form.customer_feedback ?? service?.customer_feedback ?? "",
    };
  } else if (String(service?.service_type || "").toUpperCase() === "INSTALLATION") {
    installData = {
      defects_on_inspection:
        form.defects_found ?? service?.defects_on_inspection ?? "",
      engineer_remarks:
        form.engineers_remark ?? service?.engineer_remarks ?? "",
    };
  }

  return {
    pdfData,
    productData,
    installData,
    trainees: pdfInstallationLayout
      ? padTraineesForInstallationPdf(trainees)
      : trainees,
    isInstallationLayout: pdfInstallationLayout,
    reportServiceDate,
  };
}

export function installationReportPdfFilename(serviceId, isInstallationLayout) {
  const date = dayjs().format("YYYY-MM-DD");
  return isInstallationLayout
    ? `Installation_Report_${serviceId}_${date}.pdf`
    : `Service_Report_${serviceId}_${date}.pdf`;
}

/** Prefilled printable PDF (same as opening complete-service before filling the form). */
export function buildPrefilledInstallationReportPdfPayload(service, product) {
  return buildServiceReportPdfPayload(
    { ...service, product },
    {
      product,
      prefillNewReport: true,
      form: {
        checklist: [],
        defects_found: "",
        engineers_remark: "",
        service_rating: "",
        customer_feedback: "",
      },
      spareParts: [{ replaced: "", tobereplaced: "" }],
      trainees: padTraineesForInstallationPdf([]),
    },
  );
}
