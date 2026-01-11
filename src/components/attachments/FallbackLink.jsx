"use client";

import { useCallback, useState } from "react";

export default function FallbackLink({ pathOnly, fileName }) {
  const [resolving, setResolving] = useState(false);
  const primaryHref = `https://service.dynacleanindustries.com${pathOnly}`;

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


