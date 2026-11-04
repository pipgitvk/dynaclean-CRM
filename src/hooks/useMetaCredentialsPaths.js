"use client";

import { usePathname } from "next/navigation";
import {
  metaCredentialsBase,
  metaLeadsToolBase,
} from "@/lib/metaCredentialsPaths";

export function useMetaCredentialsPaths() {
  const pathname = usePathname() || "";
  const base = metaCredentialsBase(pathname);
  const dash = metaLeadsToolBase(pathname);

  return {
    list: base,
    add: `${base}/add`,
    duplicateLeads: `${base}/duplicate-leads`,
    view: (id) => `${base}/${encodeURIComponent(String(id))}/view`,
    edit: (id) => `${base}/${encodeURIComponent(String(id))}/edit`,
    skippedLeads: `${dash}/skipped-leads`,
    importedLeads: `${dash}/imported-leads`,
    metaLogs: `${dash}/meta-logs`,
    viewCustomer: (customerId) =>
      `/admin-dashboard/view-customer/${encodeURIComponent(String(customerId))}`,
  };
}
