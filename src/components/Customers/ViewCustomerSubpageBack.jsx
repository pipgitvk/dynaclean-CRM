"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { withEmbedQuery } from "@/lib/dashboardEmbed";

/**
 * Back to the main view-customer profile (embed-aware for header / modal iframes).
 */
export default function ViewCustomerSubpageBack({
  customerId,
  dashboardBase = "admin-dashboard",
  label = "Back to customer",
  className = "",
}) {
  const searchParams = useSearchParams();
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setInIframe(window.self !== window.top);
  }, []);

  const href = useMemo(() => {
    const path = `/${dashboardBase}/view-customer/${encodeURIComponent(String(customerId))}`;
    const embed =
      searchParams.get("embed") === "1" || inIframe;
    return embed ? withEmbedQuery(path) : path;
  }, [customerId, dashboardBase, inIframe, searchParams]);

  return (
    <Link
      href={href}
      className={
        className ||
        "mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
      }
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
