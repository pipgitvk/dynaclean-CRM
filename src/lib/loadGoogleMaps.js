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

  // Already fully loaded — window.google.maps.Map is a constructor
  if (window.google?.maps?.Map) {
    return Promise.resolve();
  }

  // Return existing in-flight promise
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Script tag already in DOM (maybe injected by something else) — poll until ready
    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      const poll = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(poll);
          resolve();
        }
      }, 50);
      existingScript.addEventListener("error", () => {
        clearInterval(poll);
        reject(new Error("Google Maps script failed to load"));
      });
      return;
    }

    // First load — inject the script tag (classic loader, no loading=async)
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Sanity-check that the constructor is actually available
      if (window.google?.maps?.Map) {
        resolve();
      } else {
        // Rare edge case: poll a bit more
        const poll = setInterval(() => {
          if (window.google?.maps?.Map) {
            clearInterval(poll);
            resolve();
          }
        }, 50);
        setTimeout(() => {
          clearInterval(poll);
          reject(new Error("Google Maps loaded but Map constructor not available"));
        }, 5000);
      }
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
