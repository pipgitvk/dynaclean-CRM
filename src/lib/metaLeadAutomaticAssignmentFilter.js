import { customerManualAssignedToSql } from "@/lib/customerManualAssignment";

/**
 * Meta → CRM row is auto-routed (Automatic) or not linked yet.
 * Manual manager assignment is detected only via meta_leads.crm_customer_id,
 * not phone match (re-enquiries stay on Social Media automatic list).
 */
export function metaLeadAutomaticDistributionSql(mlAlias = "ml0") {
  return `(
    ${mlAlias}.crm_customer_id IS NULL OR ${mlAlias}.crm_customer_id = 0
    OR NOT EXISTS (
      SELECT 1 FROM customers c_man
      WHERE c_man.customer_id = ${mlAlias}.crm_customer_id
        AND ${customerManualAssignedToSql("c_man")}
    )
  )`;
}