"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

export default function ServiceMapView({ services = [] }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  
  // Filter states
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    loadGoogleMaps().then(() => setIsLoading(false));
  }, []);

  // Get unique service types and statuses for filters
  const uniqueServiceTypes = useMemo(() => {
    const types = [...new Set(services.map(s => s.service_type).filter(Boolean))];
    return types.sort();
  }, [services]);

  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(services.map(s => s.status).filter(Boolean))];
    return statuses.sort();
  }, [services]);

  // Filter services based on selected filters
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesType = !serviceTypeFilter || service.service_type === serviceTypeFilter;
      const matchesStatus = !statusFilter || service.status === statusFilter;
      return matchesType && matchesStatus;
    });
  }, [services, serviceTypeFilter, statusFilter]);

  // Helper function to get marker color and shape based on service type and status
  const getMarkerStyle = (service) => {
    let color = "#3b82f6"; // Default blue
    let symbol = window.google.maps.SymbolPath.CIRCLE;
    
    // Color based on status
    if (service.status === "COMPLETED") {
      color = "#10b981"; // Green
    } else if (service.status === "PENDING") {
      color = "#f59e0b"; // Orange
    } else if (service.status === "PENDING FOR SPARES") {
      color = "#ef4444"; // Red
    } else if (service.status === "IN PROGRESS") {
      color = "#6366f1"; // Indigo
    }
    
    // Shape based on service type
    if (service.service_type === "INSTALLATION") {
      symbol = window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW; // Triangle
    } else if (service.service_type === "COMPLAINT") {
      symbol = window.google.maps.SymbolPath.CIRCLE; // Circle
    }
    
    return { color, symbol };
  };

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

    // Filter services with valid coordinates (using filtered services)
    const validServices = filteredServices.filter(
      (s) =>
        s.lat &&
        s.longt &&
        !isNaN(parseFloat(s.lat)) &&
        !isNaN(parseFloat(s.longt))
    );

    if (validServices.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const infoWindow = new window.google.maps.InfoWindow();

    // Add markers for each service
    validServices.forEach((service) => {
      const lat = parseFloat(service.lat);
      const lng = parseFloat(service.longt);
      const position = { lat, lng };

      // Get marker style based on service type and status
      const { color: markerColor, symbol: markerSymbol } = getMarkerStyle(service);

      // Create marker with custom color and shape
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: `Service #${service.service_id} - ${service.product_name || "Service"}`,
        animation: window.google.maps.Animation.DROP,
        icon: {
          path: markerSymbol,
          scale: markerSymbol === window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW ? 6 : 10,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          rotation: markerSymbol === window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW ? 180 : 0,
        },
      });

      // Create info window content
      const infoContent = `
        <div style="min-width: 280px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <h3 style="font-size: 16px; font-weight: 600; margin: 0; color: #1f2937;">
              ${service.product_name || "Service Record"}
            </h3>
            <span style="background-color: ${markerColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
              ${service.status || "N/A"}
            </span>
          </div>
          <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
            <p style="margin: 4px 0;"><strong>Service ID:</strong> ${service.service_id || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Serial:</strong> ${service.serial_number || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${service.service_type || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Company:</strong> ${service.customer_name || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Address:</strong> ${service.installed_address || service.customer_address || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Complaint Date:</strong> ${service.complaint_date || "N/A"}</p>
            <p style="margin: 4px 0;"><strong>Assigned To:</strong> ${service.assigned_to || "N/A"}</p>
            ${service.completed_date ? `<p style="margin: 4px 0;"><strong>Completed:</strong> ${service.completed_date}</p>` : ''}
          </div>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
            <a href="/user-dashboard/view_service_reports" 
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
        setSelectedService(service);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (validServices.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      
      // Adjust zoom if only one marker
      if (validServices.length === 1) {
        const listener = window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'bounds_changed', () => {
          if (mapInstanceRef.current.getZoom() > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        });
      }
    }
  }, [filteredServices, isLoading]);

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

  const validServicesCount = filteredServices.filter(
    (s) =>
      s.lat &&
      s.longt &&
      !isNaN(parseFloat(s.lat)) &&
      !isNaN(parseFloat(s.longt))
  ).length;

  // Count by status (from filtered services)
  const statusCounts = filteredServices.reduce((acc, service) => {
    const status = service.status || "UNKNOWN";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // Count by service type (from filtered services)
  const typeCounts = filteredServices.reduce((acc, service) => {
    const type = service.service_type || "UNKNOWN";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg shadow-lg"
        style={{ minHeight: "500px", backgroundColor: "#e5e3df" }}
      />
      
      {/* Filter Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-sm">
        <h4 className="font-semibold text-gray-800 mb-3">Filters</h4>
        
        {/* Service Type Filter */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Service Type</label>
          <select
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {uniqueServiceTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        
        {/* Status Filter */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
          <select
            className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        
        {/* Reset Button */}
        <button
          onClick={() => {
            setServiceTypeFilter("");
            setStatusFilter("");
          }}
          className="w-full px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
        >
          Reset Filters
        </button>
        
        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">Legend</p>
          <div className="space-y-1">
            <div className="flex items-center text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              Completed
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
              Pending
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
              Pending for Spares
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-full bg-indigo-500 mr-2"></span>
              In Progress
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center text-xs text-gray-600 mb-1">
              <span className="inline-block mr-2">▼</span>
              Installation
            </div>
            <div className="flex items-center text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
              Complaint
            </div>
          </div>
        </div>
      </div>
      
      {/* Info overlay */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
        <h4 className="font-semibold text-gray-800 mb-2">Statistics</h4>
        <p className="text-sm text-gray-600">
          <strong>Filtered:</strong> {filteredServices.length} / {services.length}
        </p>
        <p className="text-sm text-gray-600">
          <strong>On Map:</strong> {validServicesCount}
        </p>
        <p className="text-sm text-gray-600">
          <strong>Missing Coords:</strong> {filteredServices.length - validServicesCount}
        </p>
        
        {/* Service Type Breakdown */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-1">Service Types:</p>
          {Object.entries(typeCounts).map(([type, count]) => (
            <p key={type} className="text-xs text-gray-600">
              {type}: {count}
            </p>
          ))}
        </div>
        
        {/* Status Breakdown */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-1">Status Breakdown:</p>
          {Object.entries(statusCounts).map(([status, count]) => (
            <p key={status} className="text-xs text-gray-600">
              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                status === "COMPLETED" ? "bg-green-500" :
                status === "PENDING" ? "bg-orange-500" :
                status === "PENDING FOR SPARES" ? "bg-red-500" :
                status === "IN PROGRESS" ? "bg-indigo-500" :
                "bg-blue-500"
              }`}></span>
              {status}: {count}
            </p>
          ))}
        </div>
      </div>

      {/* Selected service details */}
      {selectedService && (
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-md">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-semibold text-gray-800">
                Service #{selectedService.service_id}
              </h4>
              <p className="text-xs text-gray-500">{selectedService.product_name}</p>
            </div>
            <button
              onClick={() => setSelectedService(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Serial:</strong> {selectedService.serial_number}</p>
            <p><strong>Company:</strong> {selectedService.customer_name}</p>
            <p><strong>Status:</strong> <span className={`font-semibold ${
              selectedService.status === "COMPLETED" ? "text-green-600" :
              selectedService.status === "PENDING" ? "text-orange-600" :
              "text-blue-600"
            }`}>{selectedService.status}</span></p>
            <p><strong>Assigned:</strong> {selectedService.assigned_to || "N/A"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
