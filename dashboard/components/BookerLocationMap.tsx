import React, { useEffect, useRef } from 'react';

interface BookerLocation {
  bookerId: string;
  bookerName: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  isOnline: boolean;
}

interface BookerLocationMapProps {
  locations: BookerLocation[];
  selectedBookerId?: string | null;
  onMarkerClick?: (bookerId: string) => void;
}

const BookerLocationMap: React.FC<BookerLocationMapProps> = ({ 
  locations, 
  selectedBookerId,
  onMarkerClick 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Filter to only online bookers
  const onlineLocations = locations.filter(loc => loc.isOnline);

  useEffect(() => {
    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
      if (!apiKey) {
        console.warn('Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY in environment variables.');
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }

    function initializeMap() {
      if (!mapContainerRef.current || !window.google) return;

      // Initialize map
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapContainerRef.current, {
          zoom: 12,
          center: onlineLocations.length > 0 
            ? { lat: onlineLocations[0].latitude, lng: onlineLocations[0].longitude }
            : { lat: 31.5497, lng: 74.3436 }, // Default to Lahore
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        infoWindowRef.current = new google.maps.InfoWindow();
      }

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current.clear();

      // Create markers for each online booker
      if (onlineLocations.length > 0) {
        const bounds = new google.maps.LatLngBounds();

        onlineLocations.forEach(location => {
          const marker = new google.maps.Marker({
            position: { lat: location.latitude, lng: location.longitude },
            map: mapRef.current!,
            title: location.bookerName,
            icon: {
              url: selectedBookerId === location.bookerId 
                ? 'data:image/svg+xml;base64,' + btoa(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#D71920" stroke="white" stroke-width="2"/>
                    <text x="16" y="20" font-size="12" fill="white" text-anchor="middle" font-weight="bold">${location.bookerName.charAt(0).toUpperCase()}</text>
                  </svg>
                `)
                : 'data:image/svg+xml;base64,' + btoa(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                `),
              scaledSize: new google.maps.Size(selectedBookerId === location.bookerId ? 32 : 24, selectedBookerId === location.bookerId ? 32 : 24),
              anchor: new google.maps.Point(selectedBookerId === location.bookerId ? 16 : 12, selectedBookerId === location.bookerId ? 16 : 12)
            }
          });

          // Add click listener
          marker.addListener('click', () => {
            if (onMarkerClick) {
              onMarkerClick(location.bookerId);
            }

            // Show info window
            const lastUpdated = new Date(location.lastUpdated);
            const timeAgo = Math.floor((Date.now() - lastUpdated.getTime()) / 1000 / 60);
            
            infoWindowRef.current!.setContent(`
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${location.bookerName}</h3>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                  <strong>Status:</strong> <span style="color: #10b981;">Online</span>
                </p>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                  <strong>Last Updated:</strong> ${timeAgo < 1 ? 'Just now' : `${timeAgo} min ago`}
                </p>
                <p style="margin: 4px 0; font-size: 11px; color: #999;">
                  ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
                </p>
              </div>
            `);
            infoWindowRef.current!.open(mapRef.current!, marker);
          });

          markersRef.current.set(location.bookerId, marker);
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        });

        // Fit bounds to show all markers
        if (onlineLocations.length > 1) {
          mapRef.current.fitBounds(bounds);
        } else if (onlineLocations.length === 1) {
          mapRef.current.setCenter({ lat: onlineLocations[0].latitude, lng: onlineLocations[0].longitude });
          mapRef.current.setZoom(14);
        }
      }
    }

    return () => {
      // Cleanup markers on unmount
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current.clear();
    };
  }, [onlineLocations, selectedBookerId, onMarkerClick]);

  if (onlineLocations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">location_off</span>
          <p className="text-sm text-slate-500">No bookers online</p>
          <p className="text-xs text-slate-400 mt-1">Bookers will appear here when they are active</p>
        </div>
      </div>
    );
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="text-center p-4">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">map</span>
          <p className="text-sm text-slate-500 font-medium">Google Maps API Key Required</p>
          <p className="text-xs text-slate-400 mt-1">
            Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables to enable map view.
          </p>
          <div className="mt-4 space-y-2">
            {onlineLocations.map(location => (
              <div key={location.bookerId} className="text-xs text-slate-600 p-2 bg-white rounded border">
                <p className="font-semibold">{location.bookerName}</p>
                <p className="text-slate-500">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-[10px] underline mt-1 inline-block"
                >
                  Open in Google Maps
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className="w-full h-full rounded-lg overflow-hidden" style={{ minHeight: '500px' }} />
  );
};

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google: typeof google;
  }
}

export default BookerLocationMap;

