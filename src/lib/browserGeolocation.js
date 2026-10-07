/**
 * Browser geolocation for HR manual attendance edits (check-in / check-out).
 */
export function getBrowserGeolocation(options = {}) {
  const { timeout = 15000, enableHighAccuracy = true } = options;
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => {
        reject(
          new Error(
            err?.message || "Could not get your location. Allow location access and try again."
          )
        );
      },
      { enableHighAccuracy, timeout, maximumAge: 0 }
    );
  });
}
