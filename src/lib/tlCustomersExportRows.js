import {
  formatCrmDatetimeForISTDisplay,
  formatCrmDayjsForISTDisplay,
} from "@/lib/timezone";
import { pickEffectiveNextFollowup } from "@/utils/tlNextFollowupResolve";

export function tlCustomerToExportRow(customer, { showTLOnly }) {
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
  const nextFollowup = showTLOnly
    ? formatCrmDatetimeForISTDisplay(customer.tl_next_followup, "DD-MM-YYYY HH:mm")
    : formatCrmDayjsForISTDisplay(
        pickEffectiveNextFollowup(customer),
        "DD-MM-YYYY HH:mm",
      );

  return {
    customer_id: customer.customer_id ?? "",
    name,
    company: customer.company ?? "",
    phone: customer.phone ?? "",
    assigned_to: customer.lead_source || customer.assigned_to || "",
    status: customer.status ?? "",
    stage: customer.stage ?? "",
    followup_start: showTLOnly
      ? formatCrmDatetimeForISTDisplay(
          customer.followup_start_at,
          "DD-MM-YYYY HH:mm",
        ) || ""
      : "",
    tl_score: customer.lead_quality_score ?? "",
    multi_tag: customer.multi_tag ?? "",
    pre_booking: customer.has_pre_booking ? "Yes" : "No",
    next_followup: nextFollowup || "",
    estimated_order_date:
      formatCrmDatetimeForISTDisplay(
        customer.estimated_order_date,
        "DD-MM-YYYY HH:mm",
      ) || "",
    products_models: customer.tl_model ?? "",
    notes: customer.tl_notes ?? "",
    lead_campaign: customer.lead_campaign ?? "",
  };
}

export const TL_CUSTOMERS_EXPORT_COLUMNS = [
  { header: "Customer ID", key: "customer_id", width: 12 },
  { header: "Name", key: "name", width: 22 },
  { header: "Company", key: "company", width: 22 },
  { header: "Phone", key: "phone", width: 14 },
  { header: "Assigned To", key: "assigned_to", width: 16 },
  { header: "Status", key: "status", width: 12 },
  { header: "Stage", key: "stage", width: 20 },
  { header: "Follow-up Start", key: "followup_start", width: 18 },
  { header: "TL Score", key: "tl_score", width: 10 },
  { header: "Multi Tag", key: "multi_tag", width: 24 },
  { header: "Pre-Booking", key: "pre_booking", width: 12 },
  { header: "Next Followup", key: "next_followup", width: 18 },
  { header: "Estimated Order", key: "estimated_order_date", width: 18 },
  { header: "Products/Models", key: "products_models", width: 24 },
  { header: "Notes", key: "notes", width: 30 },
  { header: "Lead Campaign", key: "lead_campaign", width: 16 },
];
