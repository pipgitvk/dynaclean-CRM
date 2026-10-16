"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  buildEmployeeSubPagePath,
  shouldUseEmployeeIframePopup,
  withEmbedQuery,
} from "@/lib/employeeEmbedPages";

export function useEmployeeSubPageNavigation(dashboardPrefix) {
  const router = useRouter();
  const [iframePopup, setIframePopup] = useState({
    open: false,
    url: "",
    title: "",
    pageKey: "",
  });

  const openSubPage = useCallback(
    (pageKey, username, title) => {
      const path = buildEmployeeSubPagePath(dashboardPrefix, pageKey, username);
      if (shouldUseEmployeeIframePopup(pageKey)) {
        setIframePopup({
          open: true,
          url: withEmbedQuery(path),
          title,
          pageKey,
        });
      } else {
        router.push(path);
      }
    },
    [dashboardPrefix, router],
  );

  const closeIframe = useCallback(() => {
    setIframePopup({ open: false, url: "", title: "", pageKey: "" });
  }, []);

  return { iframePopup, openSubPage, closeIframe };
}
