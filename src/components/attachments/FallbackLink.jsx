"use client";

import { useCallback, useState } from "react";

export default function FallbackLink({ pathOnly, fileName }) {
  const [resolving, setResolving] = useState(false);
    // expense_attachments live on app server; others on service
  const base =
    pathOnly?.startsWith("/expense_attachments") ||
    pathOnly?.includes("/expense_attachments/")
      ? "https://app.dynacleanindustries.com"
      : "https://service.dynacleanindustries.com";
  const primaryHref = `${base}${pathOnly}`;

  const onClick = useCallback(
    async (e) => {
      e.preventDefault();
      if (resolving) return;
      setResolving(true);
      try {
        const res = await fetch(`/api/resolve-attachment?path=${encodeURIComponent(pathOnly)}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        const url = data?.url || primaryHref;
        window.open(url, "_blank", "noopener");
      } catch {
        window.open(primaryHref, "_blank", "noopener");
      } finally {
        setResolving(false);
      }
    },
    [pathOnly, primaryHref, resolving]
  );

  return (
    <a
      href={primaryHref}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline"
    >
      {fileName}
      {resolving ? " (resolving...)" : ""}
    </a>
  );
}


