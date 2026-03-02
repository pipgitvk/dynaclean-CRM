"use client";

import { useCallback, useState } from "react";

export default function ServiceAttachmentLink({ filePath, fileName, className = "" }) {
  const [resolving, setResolving] = useState(false);
  
  // Normalize the path - similar to FallbackLink
  const normalizePath = (path) => {
    if (!path) return "";
    
    
    // If path starts with http, extract pathname
    if (path.startsWith('http')) {
      try {
        const url = new URL(path);
        path = url.pathname;
      } catch {
        // Invalid URL, continue processing
      }
    }
    
    // Remove public/ prefix if present
    path = path.replace(/^\/public\//, '/').replace(/^public\//, '');
    
    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    
    // If path doesn't contain completion_files or attachments, prepend completion_files
    if (!path.includes('/completion_files/') && !path.includes('/attachments/')) {
      // Remove leading slash temporarily
      const cleanPath = path.replace(/^\/+/, '');
      path = `/completion_files/${cleanPath}`;
    }
    
    return path;
  };
  
  const pathOnly = normalizePath(filePath);
  const primaryHref = `https://service.dynacleanindustries.com${pathOnly}`;
  const displayName = fileName || filePath?.split('/').pop() || 'Download';
  

  const onClick = useCallback(
    async (e) => {
      e.preventDefault();
      if (resolving) return;
      setResolving(true);
      console.log("[ServiceAttachmentLink] Click pathOnly=", pathOnly, "fileName=", displayName);
      try {
        const res = await fetch(`/api/resolve-attachment?path=${encodeURIComponent(pathOnly)}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        const url = data?.url || primaryHref;
        
        if (data?.found === false) {
          console.warn("[ServiceAttachmentLink] File NOT FOUND pathOnly=", pathOnly, "fallbackUrl=", url);
        }
        
        window.open(url, "_blank", "noopener");
      } catch (err) {
        console.error("[ServiceAttachmentLink] ERROR:", err?.message || err, "pathOnly=", pathOnly);
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
      className={className || "text-blue-600 hover:underline"}
      title={resolving ? "Resolving best URL..." : primaryHref}
    >
      {displayName}
      {resolving && " (resolving...)"}
    </a>
  );
}
