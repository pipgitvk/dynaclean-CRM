/**
 * Shared Google Maps loader - prevents duplicate script inclusion.
 * Multiple components can call loadGoogleMaps() and they will all
 * receive the same promise; the script is loaded only once.
 */

const SCRIPT_ID = "google-maps-api-script";
const API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "AIzaSyBtEwXb_p-wIXl4Ts3GPIBWJb42zUIYuZ0";

let loadPromise = null;

/**
 * Loads the Google Maps JavaScript API exactly once.
 * Safe to call from multiple components - returns the same promise.
 * @returns {Promise<void>}
 */
export function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  // Already loaded
  if (window.google?.maps) {
    return Promise.resolve();
  }

  // Script already in DOM (loading or loaded) - wait for it
  const existingScript = document.getElementById(SCRIPT_ID);
  if (existingScript) {
    if (!loadPromise) {
      loadPromise = new Promise((resolve, reject) => {
        const resolveWhenReady = () => {
          if (window.google?.maps) {
            resolve();
            return;
          }
          if (existingScript.readyState === "complete" || existingScript.readyState === "loaded") {
            resolve();
            return;
          }
          existingScript.addEventListener("load", resolve);
          existingScript.addEventListener("error", reject);
        };
        resolveWhenReady();
      });
    }
    return loadPromise;
  }

  // First load - create script and promise
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return loadPromise;
}
