/**
 * Maps module keys to their admin dashboard URLs
 * Based on getAdminSidebarMenuItems.js
 */

export const MODULE_KEY_TO_URL = {
  // Dashboard
  "dashboard-home": "/admin-dashboard",
  "daily-report": "/admin-dashboard/today-reports",
  "lead-reports": "/admin-dashboard/lead-reports",
  "quotations-report": "/admin-dashboard/quot-report",
  "order-report": "/admin-dashboard/order-followups",
  "item-wise-sales": "/admin-dashboard/reports/item-wise-sales",
  "customer-payment-behavior": "/admin-dashboard/reports/customer-payment-behavior",
  "demo-followups": "/admin-dashboard/demo-registrations",
  "schedule-visits": "/admin-dashboard/schedule-visits",
  "fast-card": "/admin-dashboard/fast-card",
  "task-manager": "/admin-dashboard/task-manager",
  "attendance-details": "/empcrm/admin-dashboard/attendance",
  "regularization-approvals": "/admin-dashboard/regularization-approvals",

  // TL Management
  "tl-management": "/admin-dashboard/tl-customers",
  "tl-customers": "/admin-dashboard/tl-customers",
  "add-customer": "/admin-dashboard/add-customer",
  "view-customers": "/admin-dashboard/customers",
  "my-leads": "/admin-dashboard/my-leads",
  "dm-fresh-leads": "/user-dashboard/digital-marketer-leads",
  "lead-distribution": "/admin-dashboard/lead-distribution",
  "bulk-reassign": "/admin-dashboard/bulk-reassign",
  "ads-management": "/admin-dashboard/ads-management",
  "leads-upload": "/admin-dashboard/bulk-upload",
  "denied-leads": "/admin-dashboard/denied-leads",

  // Sales
  "quotations": "/admin-dashboard/quotations",
  "invoices": "/admin-dashboard/invoices/list",
  "orders-process": "/admin-dashboard/order",
  "orders-delay": "/admin-dashboard/order/delivery-status",
  "estimate-delivery": "/admin-dashboard/estimate-delivery",
  "demo-details": "/admin-dashboard/demo_details",

  // Products & Inventory
  "parties": "/admin-dashboard/parties",
  "purchase-products": "/admin-dashboard/purchase-products",
  "product-stock": "/admin-dashboard/product-stock",
  "product-accessories": "/admin-dashboard/product-accessories",
  "purchase-direct-in": "/admin-dashboard/purchase/direct-in",
  "purchase-request": "/admin-dashboard/purchase/generate-request",
  "purchase-warehouse-in": "/admin-dashboard/purchase/warehouse-in",
  "purchases": "/admin-dashboard/purchase/purchases",
  "purchase-ledger": "/admin-dashboard/purchase/ledger",
  "spare-parts": "/admin-dashboard/spare",
  "spare-direct-in": "/admin-dashboard/spare/purchase/direct-in",
  "spare-request": "/admin-dashboard/spare/purchase/generate-request",
  "spare-warehouse-in": "/admin-dashboard/spare/purchase/warehouse-in",
  "spare-purchases": "/admin-dashboard/spare/purchase/purchases",
  "production-status": "/admin-dashboard/productions/status",
  "bom-list": "/admin-dashboard/productions/bom-list",

  // Service & After-Sales
  "warranty-console": "/admin-dashboard/warranty",
  "registered-products": "/admin-dashboard/warranty/products",
  "service-followups": "/admin-dashboard/service-followups",
  "warranty-map": "/admin-dashboard/warranty/map",
  "service-records": "/admin-dashboard/view_service_reports",
  "upcoming-installations": "/admin-dashboard/view_service_reports/upcoming-installation",
  "service-map": "/admin-dashboard/view_service_reports/map",
  "amc-cmc": "/admin-dashboard/amc-cmc",
  "return-products": "/admin-dashboard/return-products",

  // Accounting
  "payment-pending": "/admin-dashboard/reports/payment-pending",
  "manual-payments": "/admin-dashboard/manual-payments",
  "expenses": "/admin-dashboard/expenses",
  "view-expenses": "/admin-dashboard/all-expenses",
  "dd-management": "/admin-dashboard/dd-management",
  "other-income": "/admin-dashboard/other-income",
  "delivery-challan": "/admin-dashboard/delivery-challan",
  "statements": "/admin-dashboard/statements",
  "salary-slips": "/empcrm/admin-dashboard/salary-slips",
  "ledger": "/admin-dashboard/ledger",

  // Resource Center
  "company-documents": "/admin-dashboard/company-documents",
  "blog": "/admin-dashboard/blog",
  "qa-approval": "/admin-dashboard/qa-approval",
  "qa": "/admin-dashboard/qa",
  "email-templates": "/admin-dashboard/email-templates",
  "holidays": "/admin-dashboard/holidays",
  "installation-videos": "/admin-dashboard/installation-videos",
  "installation-videos-manage": "/admin-dashboard/installation-videos-manage",
  "assets": "/admin-dashboard/assets-management",

  // Employees
  "employee-list": "/admin-dashboard/employees",
  "employee-crm": "/empcrm",
  "attendance-log": "/empcrm/admin-dashboard/attendance ",

  // HR Operations
  "hiring-process": "/admin-dashboard/hiring-process",
  "final-profile-approval": "/empcrm/admin-dashboard/profile/approvals-admin",
  "hr-daily-report": "/empcrm/admin-dashboard/salary",
  "attendance-rules": "/admin-dashboard/attendance-rules",
  "all-hr-report": "/admin-dashboard/all-hr-report",

  // Digital Marketing
  "keywords-management": "/admin-dashboard/keywords",
  "backlinks-management": "/admin-dashboard/backlinks",
  "backlinks-excel-data": "/admin-dashboard/backlinks-excel",
  "meta-credentials-add": "/digital-marketing-dashboard/meta-credentials/add",

  // Import CRM
  "import-agents": "/admin-dashboard/import-crm/agents",
  "import-suppliers": "/admin-dashboard/import-crm/suppliers",
  "import-shipments": "/admin-dashboard/import-crm/shipments",
  "import-quote-submissions": "/admin-dashboard/import-crm/quote-submissions",
  "import-award-followups": "/admin-dashboard/import-crm/award-followups",

  // GEM CRM
  "gem-crm-dashboard": "/admin-dashboard/gem-crm/dashboard",
  "gem-crm-bids": "/admin-dashboard/gem-crm/bids",
  "gem-crm-reports": "/admin-dashboard/gem-crm/reports",

  // Targets
  "prospects-view": "/admin-dashboard/prospects",
  "prospects-add": "/admin-dashboard/add-prospect",
  "prospects-new": "/admin-dashboard/new-prospect",
  "hr-designation-targets": "/admin-dashboard/hr-designation-targets",
  "sales-target": "/admin-dashboard/monitor-targets",
};

/**
 * Gets the admin dashboard URL for a given module key
 * @param {string} moduleKey - The module key (e.g., "dashboard-home", "daily-report")
 * @returns {string|null} - The URL for the module, or null if not found
 */
export function getModuleUrl(moduleKey) {
  if (!moduleKey) return null;
  const url = MODULE_KEY_TO_URL[moduleKey];
  return url || null;
}

/**
 * Opens a module in a new tab by its module key
 * @param {string} moduleKey - The module key to open
 */
export function openModuleInNewTab(moduleKey) {
  const url = getModuleUrl(moduleKey);
  if (url) {
    window.open(url, "_blank");
  }
}
