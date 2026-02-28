"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

export default function MapView({ products = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    loadGoogleMaps().then(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading || !mapRef.current || !window.google) return;

    // Initialize map only once
    if (!mapInstanceRef.current) {
      // Default center (India)
      const defaultCenter = { lat: 20.5937, lng: 78.9629 };
      
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 5,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
      });
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Filter products with valid coordinates
    const validProducts = products.filter(
      (p) =>
        p.lat &&
        p.longt &&
        !isNaN(parseFloat(p.lat)) &&
        !isNaN(parseFloat(p.longt))
    );

    if (validProducts.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const infoWindow = new window.google.maps.InfoWindow();

    // Add markers for each product
    validProducts.forEach((product) => {
      const lat = parseFloat(product.lat);
      const lng = parseFloat(product.longt);
      const position = { lat, lng };

      // Create marker
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: product.product_name || "Product",
        animation: window.google.maps.Animation.DROP,
      });

      // Create info window content
      const infoContent = `
        <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif; padding: 8px;">
          <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #1f2937;">
            ${product.product_name || "N/A"}
          </h3>
          <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
            <p style="margin: 4px 0;"><strong>Model:</strong> ${product.model || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Serial:</strong> ${product.serial_number || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Company:</strong> ${product.customer_name || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Address:</strong> ${product.installed_address || product.customer_address || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Installation Date:</strong> ${product.installation_date || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Warranty:</strong> ${product.warranty_period || "N/A"} months</p>
          </div>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
            <a href="/user-dashboard/warranty/products" 
               style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 500;">
              View Details →
            </a>
          </div>
        </div>
      `;

      // Add click listener to marker
      marker.addListener("click", () => {
        infoWindow.setContent(infoContent);
        infoWindow.open(mapInstanceRef.current, marker);
        setSelectedProduct(product);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (validProducts.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      
      // Adjust zoom if only one marker
      if (validProducts.length === 1) {
        const listener = window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'bounds_changed', () => {
          if (mapInstanceRef.current.getZoom() > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        });
      }
    }
  }, [products, isLoading]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  const validProductsCount = products.filter(
    (p) =>
      p.lat &&
      p.longt &&
      !isNaN(parseFloat(p.lat)) &&
      !isNaN(parseFloat(p.longt))
  ).length;

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg shadow-lg"
        style={{ minHeight: "400px", backgroundColor: "#e5e3df" }}
      />

      {/* Info overlay - Mobile Responsive */}
      <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-white rounded-lg shadow-lg p-3 md:p-4 z-[1000] w-auto md:max-w-xs">
        <h4 className="font-semibold text-gray-800 mb-2 text-sm md:text-base">Map Statistics</h4>
        <div className="space-y-1 text-xs md:text-sm">
          <p className="text-gray-600">
            <strong>Total Products:</strong> {products.length}
          </p>
          <p className="text-gray-600">
            <strong>On Map:</strong> {validProductsCount}
          </p>
          <p className="text-gray-600">
            <strong>Missing:</strong> {products.length - validProductsCount}
          </p>
        </div>
      </div>

      {/* Selected product details - Mobile Responsive */}
      {selectedProduct && (
        <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-auto bg-white rounded-lg shadow-lg p-3 md:p-4 z-[1000] max-w-md">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 text-sm md:text-base truncate">
                {selectedProduct.product_name}
              </h4>
              <p className="text-xs text-gray-500 truncate">{selectedProduct.serial_number}</p>
            </div>
            <button
              onClick={() => setSelectedProduct(null)}
              className="text-gray-400 hover:text-gray-600 text-lg ml-2 flex-shrink-0"
            >
              ✕
            </button>
          </div>
          <div className="text-xs md:text-sm text-gray-600 space-y-1">
            <p><strong>Serial:</strong> {selectedProduct.serial_number}</p>
            <p><strong>Company:</strong> {selectedProduct.customer_name}</p>
            <p><strong>Contact:</strong> {selectedProduct.contact}</p>
          </div>
        </div>
      )}
    </div>
  );
}


// "use client";
// import { useEffect, useRef, useState } from "react";

// export default function MapView({ products = [] }) {
//   const mapRef = useRef(null);
//   const mapInstanceRef = useRef(null);
//   const markersRef = useRef([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [selectedProduct, setSelectedProduct] = useState(null);

//   useEffect(() => {
//     // Dynamically load Leaflet CSS and JS
//     const loadLeaflet = async () => {
//       if (typeof window === "undefined") return;

//       // Load CSS
//       if (!document.getElementById("leaflet-css")) {
//         const link = document.createElement("link");
//         link.id = "leaflet-css";
//         link.rel = "stylesheet";
//         link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
//         link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
//         link.crossOrigin = "";
//         document.head.appendChild(link);
//       }

//       // Load JS
//       if (!window.L) {
//         await new Promise((resolve, reject) => {
//           const script = document.createElement("script");
//           script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
//           script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
//           script.crossOrigin = "";
//           script.onload = resolve;
//           script.onerror = reject;
//           document.body.appendChild(script);
//         });
//       }

//       setIsLoading(false);
//     };

//     loadLeaflet();
//   }, []);

//   useEffect(() => {
//     if (isLoading || !mapRef.current || !window.L) return;

//     // Initialize map only once
//     if (!mapInstanceRef.current) {
//       // Default center (India)
//       const defaultCenter = [20.5937, 78.9629];
//       const defaultZoom = 5;

//       mapInstanceRef.current = window.L.map(mapRef.current).setView(
//         defaultCenter,
//         defaultZoom
//       );

//       // Add tile layer
//       window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//         attribution:
//           '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
//         maxZoom: 19,
//       }).addTo(mapInstanceRef.current);
//     }

//     // Clear existing markers
//     markersRef.current.forEach((marker) => marker.remove());
//     markersRef.current = [];

//     // Filter products with valid coordinates
//     const validProducts = products.filter(
//       (p) =>
//         p.lat &&
//         p.longt &&
//         !isNaN(parseFloat(p.lat)) &&
//         !isNaN(parseFloat(p.longt))
//     );

//     if (validProducts.length === 0) return;

//     // Add markers for each product
//     validProducts.forEach((product) => {
//       const lat = parseFloat(product.lat);
//       const lng = parseFloat(product.longt);

//       // Create custom icon
//       const customIcon = window.L.divIcon({
//         className: "custom-marker",
//         html: `<div style="background-color: #3b82f6; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
//           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
//             <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
//             <circle cx="12" cy="10" r="3"/>
//           </svg>
//         </div>`,
//         iconSize: [30, 30],
//         iconAnchor: [15, 15],
//       });

//       const marker = window.L.marker([lat, lng], { icon: customIcon }).addTo(
//         mapInstanceRef.current
//       );

//       // Create popup content
//       const popupContent = `
//         <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
//           <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 8px 0; color: #1f2937;">
//             ${product.product_name || "N/A"}
//           </h3>
//           <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
//             <p style="margin: 4px 0;"><strong>Model:</strong> ${product.model || "N/A"}</p>
//             <p style="margin: 4px 0;"><strong>Serial:</strong> ${product.serial_number || "N/A"}</p>
//             <p style="margin: 4px 0;"><strong>Company:</strong> ${product.customer_name || "N/A"}</p>
//             <p style="margin: 4px 0;"><strong>Address:</strong> ${product.installed_address || product.customer_address || "N/A"}</p>
//             <p style="margin: 4px 0;"><strong>Installation Date:</strong> ${product.installation_date || "N/A"}</p>
//             <p style="margin: 4px 0;"><strong>Warranty:</strong> ${product.warranty_period || "N/A"} months</p>
//           </div>
//           <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
//             <a href="/user-dashboard/warranty/products" 
//                style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 500;">
//               View Details →
//             </a>
//           </div>
//         </div>
//       `;

//       marker.bindPopup(popupContent);

//       // Add click event
//       marker.on("click", () => {
//         setSelectedProduct(product);
//       });

//       markersRef.current.push(marker);
//     });

//     // Fit map to show all markers
//     if (validProducts.length > 0) {
//       const bounds = window.L.latLngBounds(
//         validProducts.map((p) => [parseFloat(p.lat), parseFloat(p.longt)])
//       );
//       mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
//     }

//     // Cleanup function
//     return () => {
//       // Don't destroy the map instance, just clear markers
//     };
//   }, [products, isLoading]);

//   if (isLoading) {
//     return (
//       <div className="w-full h-full flex items-center justify-center bg-gray-100">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading map...</p>
//         </div>
//       </div>
//     );
//   }

//   const validProductsCount = products.filter(
//     (p) =>
//       p.lat &&
//       p.longt &&
//       !isNaN(parseFloat(p.lat)) &&
//       !isNaN(parseFloat(p.longt))
//   ).length;

//   return (
//     <div className="relative w-full h-full">
//       <div
//         ref={mapRef}
//         className="w-full h-full rounded-lg shadow-lg"
//         style={{ minHeight: "500px" }}
//       />
      
//       {/* Info overlay */}
//       <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
//         <h4 className="font-semibold text-gray-800 mb-2">Map Statistics</h4>
//         <p className="text-sm text-gray-600">
//           <strong>Total Products:</strong> {products.length}
//         </p>
//         <p className="text-sm text-gray-600">
//           <strong>On Map:</strong> {validProductsCount}
//         </p>
//         <p className="text-sm text-gray-600">
//           <strong>Missing Coordinates:</strong> {products.length - validProductsCount}
//         </p>
//       </div>

//       {/* Selected product details */}
//       {selectedProduct && (
//         <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-md">
//           <div className="flex justify-between items-start mb-2">
//             <h4 className="font-semibold text-gray-800">
//               {selectedProduct.product_name}
//             </h4>
//             <button
//               onClick={() => setSelectedProduct(null)}
//               className="text-gray-400 hover:text-gray-600"
//             >
//               ✕
//             </button>
//           </div>
//           <div className="text-sm text-gray-600 space-y-1">
//             <p><strong>Serial:</strong> {selectedProduct.serial_number}</p>
//             <p><strong>Company:</strong> {selectedProduct.customer_name}</p>
//             <p><strong>Contact:</strong> {selectedProduct.contact}</p>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
