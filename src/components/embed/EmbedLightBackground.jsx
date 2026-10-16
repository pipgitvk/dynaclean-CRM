"use client";

import { useEffect } from "react";

/** In iframe popups, force light page chrome (avoids dark-mode body showing black below short forms). */
export default function EmbedLightBackground() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("embed") !== "1") return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevColorScheme = html.style.colorScheme;

    html.style.colorScheme = "light";
    html.style.backgroundColor = "#f9fafb";
    body.style.backgroundColor = "#f9fafb";

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      html.style.colorScheme = prevColorScheme;
    };
  }, []);

  return null;
}
