"use client";

import { useCallback, useState } from "react";

export default function ServiceAttachmentLink({ filePath, fileName, className = "" }) {
  const [resolving, setResolving] = useState(false);
  const [instanceId] = useState(() => Math.random().toString(36).substr(2, 9));
  
  console.log(`[ServiceAttachmentLink:${instanceId}] Created for:`, filePath, fileName);
  
  // Normalize the path - similar to FallbackLink
  const normalizePath = (path) => {
    if (!path) return "";
    
    console.log(`[ServiceAttachmentLink:${instanceId}] Original path:`, path);
    
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
    
    console.log(`[ServiceAttachmentLink:${instanceId}] After cleanup:`, path);
    
    // If path doesn't contain completion_files or attachments, prepend completion_files
    if (!path.includes('/completion_files/') && !path.includes('/attachments/')) {
      // Remove leading slash temporarily
      const cleanPath = path.replace(/^\/+/, '');
      path = `/completion_files/${cleanPath}`;
      console.log(`[ServiceAttachmentLink:${instanceId}] Added completion_files:`, path);
    }
    
    console.log(`[ServiceAttachmentLink:${instanceId}] Final path:`, path);
    return path;
  };
  
  const pathOnly = normalizePath(filePath);
  const primaryHref = `https://service.dynacleanindustries.com${pathOnly}`;
  const displayName = fileName || filePath?.split('/').pop() || 'Download';
  
  console.log(`[ServiceAttachmentLink:${instanceId}] Render:`, { filePath, fileName, pathOnly, primaryHref, displayName });

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
        
        // Log if file wasn't found
        if (data?.found === false) {
          console.warn(`[ServiceAttachmentLink:${instanceId}] File not found, trying fallback URL:`, url, 'for path:', pathOnly);
        } else {
          console.log(`[ServiceAttachmentLink:${instanceId}] Opening resolved URL:`, url, 'for path:', pathOnly);
        }
        
        window.open(url, "_blank", "noopener");
      } catch (err) {
        console.error(`[ServiceAttachmentLink:${instanceId}] Error resolving attachment:`, err, 'for path:', pathOnly);
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
