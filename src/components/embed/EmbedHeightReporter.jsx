"use client";

import { useEffect } from "react";

const MESSAGE_TYPE = "employee-embed-height";

export function EmbedHeightReporter({ enabled = true }) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("embed") !== "1") return;

    const report = () => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      window.parent.postMessage(
        { type: MESSAGE_TYPE, height },
        window.location.origin,
      );
    };

    report();
    const ro = new ResizeObserver(() => report());
    ro.observe(document.documentElement);
    window.addEventListener("load", report);

    return () => {
      ro.disconnect();
      window.removeEventListener("load", report);
    };
  }, [enabled]);

  return null;
}

export { MESSAGE_TYPE as EMBED_HEIGHT_MESSAGE_TYPE };
