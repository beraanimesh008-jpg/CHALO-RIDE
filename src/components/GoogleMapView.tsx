/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker as GoogleMarker,
  Polyline as GooglePolyline,
  Polygon as GooglePolygon,
  Circle as GoogleCircle,
  InfoWindow as GoogleInfoWindow
} from '@react-google-maps/api';
import {
  MapContainer,
  TileLayer,
  Marker as LeafletMarker,
  CircleMarker as LeafletCircleMarker,
  Polyline as LeafletPolyline,
  Polygon as LeafletPolygon,
  useMap,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import { Locate, Layers, Navigation, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { GOOGLE_MAPS_LIBRARIES, DEFAULT_CENTER } from '../constants';

export interface MapCoords {
  lat: number;
  lng: number;
}

interface GoogleMapViewProps {
  center?: MapCoords;
  zoom?: number;
  pickup?: MapCoords | null;
  drop?: MapCoords | null;
  userLocation?: MapCoords | null;
  userLocationAccuracy?: number;
  userLocationLabel?: string;
  disableProviderToggle?: boolean;
  onRecenter?: (coords: MapCoords) => void;
  showLegend?: boolean;
  drivers?: Array<{
    id: string;
    lat: number;
    lng: number;
    name?: string;
    model?: string;
    isOnline?: boolean;
    isInsideServiceArea?: boolean;
  }>;
  routePolyline?: Array<MapCoords>;
  onMapClick?: (coords: MapCoords) => void;
  interactive?: boolean;
  className?: string;

  // Polygon Geofencing Extensions
  servicePolygon?: Array<MapCoords>;
  isServiceAreaEnabled?: boolean;
  drawingMode?: 'none' | 'draw' | 'edit' | 'test';
  drawnPoints?: Array<MapCoords>;
  onAddDrawnPoint?: (point: MapCoords) => void;
  onVertexDragEnd?: (index: number, newCoords: MapCoords) => void;
  onVertexClick?: (index: number) => void;
  testMarker?: { lat: number; lng: number; isInside: boolean } | null;
}

function getDistanceMeters(c1: MapCoords, c2: MapCoords): number {
  const R = 6371000;
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Leaflet click handler helper
function LeafletMapEvents({
  onMapClick,
  userLocation
}: {
  onMapClick: (coords: MapCoords) => void;
  userLocation?: MapCoords | null;
}) {
  useMapEvents({
    click(e) {
      const clicked = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (userLocation) {
        const d = getDistanceMeters(clicked, userLocation);
        if (d <= 65) {
          onMapClick(userLocation);
          return;
        }
      }
      onMapClick(clicked);
    }
  });
  return null;
}

function LeafletMapCenterUpdater({ center }: { center: MapCoords }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);
  return null;
}

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const bikeIcon = new L.DivIcon({
  className: 'custom-bike-marker',
  html: `<div style="background-color:#F27D26; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 4px 8px rgba(0,0,0,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
        </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

export default function GoogleMapView({
  center = DEFAULT_CENTER,
  zoom = 12,
  pickup,
  drop,
  userLocation,
  userLocationAccuracy,
  userLocationLabel,
  disableProviderToggle = false,
  onRecenter,
  showLegend = true,
  drivers = [],
  routePolyline = [],
  onMapClick,
  interactive = true,
  className = "w-full h-full",
  servicePolygon = [],
  isServiceAreaEnabled = true,
  drawingMode = 'none',
  drawnPoints = [],
  onAddDrawnPoint,
  onVertexDragEnd,
  onVertexClick,
  testMarker
}: GoogleMapViewProps) {
  const apiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || 'AIzaSyC0-_L4OGoKAnaNd2hRLJftlSFiP4CxqSk';
  const [mapProvider, setMapProvider] = useState<'google' | 'leaflet'>('google');
  const [currentCenter, setCurrentCenter] = useState<MapCoords>(center);
  const mapRef = useRef<any>(null);
  const activePolylineRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES as any
  });

  // Explicit lifecycle manager for route polyline overlay
  // Ensures that on 3rd-tap reset (when pickup or drop or routePolyline is cleared),
  // all previous route overlays are immediately and completely removed from Google Maps.
  useEffect(() => {
    if (mapProvider !== 'google' || !mapRef.current || !(window as any).google?.maps) {
      return;
    }

    const hasValidRoute = Boolean(pickup && drop && routePolyline && routePolyline.length > 0);

    // 1. Remove and clear any existing polyline
    if (activePolylineRef.current) {
      try {
        activePolylineRef.current.setMap(null);
      } catch (err) {
        console.warn('Error clearing polyline on Google Map:', err);
      }
      activePolylineRef.current = null;
    }

    // If reset or missing either pickup or drop, return immediately with clean map
    if (!hasValidRoute) {
      return;
    }

    // 2. Create fresh Google Maps Polyline attached to current map instance
    try {
      const polyline = new (window as any).google.maps.Polyline({
        path: routePolyline,
        strokeColor: '#000000',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map: mapRef.current
      });
      activePolylineRef.current = polyline;
    } catch (err) {
      console.warn('Error creating Google Maps Polyline:', err);
    }

    return () => {
      if (activePolylineRef.current) {
        try {
          activePolylineRef.current.setMap(null);
        } catch (e) {
          /* noop */
        }
        activePolylineRef.current = null;
      }
    };
  }, [routePolyline, pickup, drop, mapProvider, isLoaded, isMapReady]);

  useEffect(() => {
    setCurrentCenter(center);
    if (!mapRef.current || mapProvider !== 'google' || !(window as any).google?.maps) {
      return;
    }

    if (pickup && drop) {
      try {
        const bounds = new (window as any).google.maps.LatLngBounds();
        bounds.extend(new (window as any).google.maps.LatLng(pickup.lat, pickup.lng));
        bounds.extend(new (window as any).google.maps.LatLng(drop.lat, drop.lng));
        mapRef.current.fitBounds(bounds, 70);
      } catch (e) {
        mapRef.current.panTo({ lat: center.lat, lng: center.lng });
      }
    } else if (pickup) {
      mapRef.current.panTo({ lat: pickup.lat, lng: pickup.lng });
    } else if (drop) {
      mapRef.current.panTo({ lat: drop.lat, lng: drop.lng });
    } else if (center) {
      mapRef.current.panTo({ lat: center.lat, lng: center.lng });
    }
  }, [center.lat, center.lng, pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, mapProvider, isMapReady]);

  useEffect(() => {
    if (loadError) {
      console.warn('Google Maps load error, switching to Leaflet:', loadError);
      setMapProvider('leaflet');
    }
  }, [loadError]);

  const [isLocating, setIsLocating] = useState(false);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  const handleRecenter = () => {
    // 1. If userLocation already exists, instantly pan & zoom to it!
    if (userLocation) {
      setCurrentCenter(userLocation);
      if (mapRef.current) {
        mapRef.current.panTo(userLocation);
        mapRef.current.setZoom(15);
      }
      if (onRecenter) {
        onRecenter(userLocation);
      }
    }

    if (!navigator.geolocation) {
      setLocationToast('Geolocation not supported / লোকেশন সাপোর্ট নেই');
      setTimeout(() => setLocationToast(null), 3500);
      return;
    }

    setIsLocating(true);

    const onGeoSuccess = (pos: GeolocationPosition) => {
      setIsLocating(false);
      const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCurrentCenter(newPos);
      if (mapRef.current) {
        mapRef.current.panTo(newPos);
        mapRef.current.setZoom(15);
      }
      if (onRecenter) {
        onRecenter(newPos);
      }
      setLocationToast('Location updated / অবস্থান পাওয়া গেছে');
      setTimeout(() => setLocationToast(null), 2500);
    };

    const onGeoError = (err: GeolocationPositionError) => {
      console.warn('High accuracy GPS error, trying fallback:', err);
      // Fallback to low-accuracy IP/Cellular geolocation
      navigator.geolocation.getCurrentPosition(
        onGeoSuccess,
        (fallbackErr) => {
          setIsLocating(false);
          console.warn('Geolocation fallback error:', fallbackErr);
          if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
            setLocationToast('Please allow location permission in browser / ব্রাউজারে লোকেশন অনুমতি দিন');
          } else {
            setLocationToast('GPS unavailable / লোকেশন পেতে সমস্যা হয়েছে');
          }
          setTimeout(() => setLocationToast(null), 4000);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      onGeoError,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  };

  const polylineCoords = routePolyline.map(p => [p.lat, p.lng] as [number, number]);
  const leafletPolygonCoords = servicePolygon.map(p => [p.lat, p.lng] as [number, number]);
  const leafletDrawnCoords = drawnPoints.map(p => [p.lat, p.lng] as [number, number]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Map Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto">
        {!disableProviderToggle && (
          <button
            type="button"
            onClick={() => setMapProvider(p => p === 'google' && isLoaded ? 'leaflet' : 'google')}
            className="p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 text-slate-700 hover:text-brand-600 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase"
            title="Toggle Map Engine"
          >
            <Layers className="w-3.5 h-3.5 text-brand-600" />
            <span>{mapProvider === 'google' && isLoaded ? 'Google Maps' : 'OSM Map'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleRecenter}
          disabled={isLocating}
          className="px-3.5 py-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center gap-2 text-xs font-bold active:scale-95 disabled:opacity-75"
          title="My Location / আমার বর্তমান অবস্থান"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          ) : (
            <Locate className="w-4 h-4 text-blue-600" />
          )}
          <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'My Location / আমার অবস্থান'}</span>
        </button>
      </div>

      {/* Floating GPS Location Toast Notification */}
      {locationToast && (
        <div className="absolute top-16 right-3 z-[1050] bg-slate-900/90 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xl border border-white/10 flex items-center gap-2 animate-fade-in pointer-events-none max-w-xs">
          <Locate className="w-4 h-4 text-blue-400 shrink-0" />
          <span>{locationToast}</span>
        </div>
      )}

      {/* Floating Status / Mode Badge */}
      {drawingMode === 'draw' && (
        <div className="absolute top-3 left-3 z-[1000] bg-brand-600 text-white px-4 py-2 rounded-2xl shadow-xl border border-white/20 text-xs font-black flex items-center gap-2 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <span>Drawing Mode: Click map to place boundary points ({drawnPoints.length} added)</span>
        </div>
      )}

      {drawingMode === 'edit' && (
        <div className="absolute top-3 left-3 z-[1000] bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl border border-slate-800 text-xs font-black flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span>Edit Mode: Drag white pins to adjust boundary points ({servicePolygon.length} vertices)</span>
        </div>
      )}

      {drawingMode === 'test' && (
        <div className="absolute top-3 left-3 z-[1000] bg-indigo-600 text-white px-4 py-2 rounded-2xl shadow-xl border border-white/20 text-xs font-black flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Test Mode: Click anywhere on map to check Inside / Outside status</span>
        </div>
      )}

      {/* Test Result Floating Card */}
      {testMarker && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-200 flex items-center gap-3 max-w-sm">
          {testMarker.isInside ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1">
            <div className="text-xs font-black text-slate-900">
              {testMarker.isInside
                ? 'Inside Service Area / সার্ভিস এলাকার ভিতরে'
                : 'Outside Service Area / সার্ভিস এলাকার বাইরে'}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              Lat: {testMarker.lat.toFixed(5)}, Lng: {testMarker.lng.toFixed(5)}
            </div>
          </div>
        </div>
      )}

      {/* Map Legend Overlay */}
      {showLegend && servicePolygon && servicePolygon.length >= 3 && drawingMode === 'none' && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200/80 flex flex-wrap items-center gap-3.5 text-[11px] font-bold text-slate-700 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-3.5 rounded border-2 border-brand-500 bg-brand-500/20 inline-block shrink-0" />
            <span className="text-slate-900">Service Area <span className="text-slate-400 font-normal">/ সার্ভিস এলাকা</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 inline-block shrink-0" />
            <span className="text-emerald-700">Inside <span className="text-slate-400 font-normal">/ এলাকার ভিতরে</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 inline-block shrink-0" />
            <span className="text-rose-700">Outside <span className="text-slate-400 font-normal">/ এলাকার বাইরে</span></span>
          </div>
        </div>
      )}

      {mapProvider === 'google' && isLoaded && !loadError ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={currentCenter}
          zoom={zoom}
          onLoad={(map) => {
            mapRef.current = map;
            setIsMapReady(true);
          }}
          onClick={(e) => {
            if (!e.latLng) return;
            const clicked = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            if (drawingMode === 'draw' && onAddDrawnPoint) {
              onAddDrawnPoint(clicked);
            } else if (interactive && onMapClick) {
              // If clicked within 65m of user's current GPS location, treat as exact userLocation tap
              if (userLocation) {
                const distanceMeters = getDistanceMeters(clicked, userLocation);
                if (distanceMeters <= 65) {
                  onMapClick(userLocation);
                  return;
                }
              }
              onMapClick(clicked);
            }
          }}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            draggableCursor: drawingMode === 'draw' || drawingMode === 'test' ? 'crosshair' : 'default'
          }}
        >
          {/* Saved Geofence Polygon */}
          {servicePolygon && servicePolygon.length >= 3 && drawingMode !== 'draw' && (
            <GooglePolygon
              path={servicePolygon}
              options={{
                fillColor: isServiceAreaEnabled ? '#F27D26' : '#64748B',
                fillOpacity: isServiceAreaEnabled ? 0.22 : 0.1,
                strokeColor: isServiceAreaEnabled ? '#F27D26' : '#475569',
                strokeOpacity: 0.9,
                strokeWeight: 2.5,
                clickable: false
              }}
            />
          )}

          {/* Draggable Vertex Markers in Edit Mode */}
          {drawingMode === 'edit' &&
            servicePolygon.map((pt, idx) => (
              <GoogleMarker
                key={`vertex-${idx}`}
                position={pt}
                draggable={true}
                onDragEnd={(e) => {
                  if (e.latLng && onVertexDragEnd) {
                    onVertexDragEnd(idx, { lat: e.latLng.lat(), lng: e.latLng.lng() });
                  }
                }}
                onClick={() => {
                  if (onVertexClick) {
                    onVertexClick(idx);
                  }
                }}
                title={`Vertex #${idx + 1} (Drag to adjust, click to delete)`}
                label={{
                  text: String(idx + 1),
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
                icon={{
                  path: (window as any).google.maps.SymbolPath.CIRCLE,
                  scale: 12,
                  fillColor: '#F27D26',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 2.5
                }}
              />
            ))}

          {/* Live Drawing Points & Outline in Draw Mode */}
          {drawingMode === 'draw' && drawnPoints.length > 0 && (
            <>
              <GooglePolyline
                path={drawnPoints}
                options={{
                  strokeColor: '#F27D26',
                  strokeOpacity: 0.95,
                  strokeWeight: 3.5
                }}
              />
              {drawnPoints.map((pt, idx) => (
                <GoogleMarker
                  key={`draw-pt-${idx}`}
                  position={pt}
                  label={{
                    text: String(idx + 1),
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}
                  icon={{
                    path: (window as any).google.maps.SymbolPath.CIRCLE,
                    scale: 11,
                    fillColor: idx === 0 ? '#10B981' : '#F27D26',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2.5
                  }}
                  onClick={() => {
                    // Clicking on the first point in draw mode triggers closing
                    if (idx === 0 && drawnPoints.length >= 3 && onAddDrawnPoint) {
                      onAddDrawnPoint(drawnPoints[0]);
                    }
                  }}
                />
              ))}
            </>
          )}

          {/* Test Location Pin */}
          {testMarker && (
            <GoogleMarker
              position={{ lat: testMarker.lat, lng: testMarker.lng }}
              title={testMarker.isInside ? 'Inside Service Area' : 'Outside Service Area'}
              icon={{
                path: (window as any).google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: testMarker.isInside ? '#10B981' : '#EF4444',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
              }}
            />
          )}

          {/* Current User/Driver GPS Location (Blue Dot with Accuracy Circle and Click Target) */}
          {userLocation && (
            <>
              {/* Accuracy visual ring (non-clickable so it doesn't block map clicks) */}
              <GoogleCircle
                center={userLocation}
                radius={userLocationAccuracy && userLocationAccuracy > 15 ? Math.min(userLocationAccuracy, 120) : 35}
                options={{
                  fillColor: '#3B82F6',
                  fillOpacity: 0.15,
                  strokeColor: '#2563EB',
                  strokeOpacity: 0.45,
                  strokeWeight: 1.5,
                  clickable: false
                }}
              />
              {/* Large transparent tap target over the blue dot to ensure effortless clicking */}
              <GoogleCircle
                center={userLocation}
                radius={35}
                onClick={() => {
                  if (interactive && onMapClick && userLocation) {
                    onMapClick(userLocation);
                  }
                }}
                options={{
                  fillColor: '#3B82F6',
                  fillOpacity: 0.01,
                  strokeColor: '#2563EB',
                  strokeOpacity: 0,
                  strokeWeight: 0,
                  clickable: interactive,
                  zIndex: 999
                }}
              />
              {/* Blue dot visual marker with direct click handler */}
              <GoogleMarker
                position={userLocation}
                title={userLocationLabel || "🔵 User Current Location / আমার বর্তমান অবস্থান (Click to set as pickup)"}
                onClick={() => {
                  if (interactive && onMapClick && userLocation) {
                    onMapClick(userLocation);
                  }
                }}
                clickable={interactive}
                cursor="pointer"
                icon={{
                  path: (window as any).google?.maps?.SymbolPath?.CIRCLE,
                  scale: 8,
                  fillColor: '#2563EB',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3
                }}
              />
            </>
          )}

          {/* Pickup Marker */}
          {pickup && (
            <GoogleMarker
              position={pickup}
              title="Pickup Location"
              icon={{
                url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                scaledSize: new (window as any).google.maps.Size(25, 41),
                anchor: (window as any).google?.maps?.Point ? new (window as any).google.maps.Point(12.5, 41) : undefined
              }}
            />
          )}

          {/* Drop Marker */}
          {drop && (
            <GoogleMarker
              position={drop}
              title="Drop Location"
              icon={{
                url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                scaledSize: new (window as any).google.maps.Size(25, 41),
                anchor: (window as any).google?.maps?.Point ? new (window as any).google.maps.Point(12.5, 41) : undefined
              }}
            />
          )}

          {/* Live Drivers with Inside/Outside border styling */}
          {drivers.map((drv) => (
            <GoogleMarker
              key={drv.id}
              position={{ lat: drv.lat, lng: drv.lng }}
              title={`${drv.name || 'Driver'} (${drv.isInsideServiceArea === false ? 'Outside Service Area' : 'Inside Service Area'})`}
              icon={{
                path: (window as any).google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: '#F27D26',
                fillOpacity: 1,
                strokeColor: drv.isInsideServiceArea === false ? '#EF4444' : '#10B981',
                strokeWeight: 3
              }}
            />
          ))}

          {/* Route polyline is managed directly on the Google Map instance via activePolylineRef above */}
        </GoogleMap>
      ) : (
        <MapContainer
          center={[currentCenter.lat, currentCenter.lng]}
          zoom={zoom}
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />

          {/* Leaflet Polygon Fallback */}
          {leafletPolygonCoords.length >= 3 && drawingMode !== 'draw' && (
            <LeafletPolygon
              positions={leafletPolygonCoords}
              pathOptions={{
                color: isServiceAreaEnabled ? '#F27D26' : '#64748B',
                fillColor: isServiceAreaEnabled ? '#F27D26' : '#94A3B8',
                fillOpacity: isServiceAreaEnabled ? 0.22 : 0.1,
                weight: 2.5
              }}
            />
          )}

          {drawingMode === 'draw' && leafletDrawnCoords.length > 0 && (
            <LeafletPolyline positions={leafletDrawnCoords} color="#F27D26" weight={3.5} opacity={0.95} />
          )}

          {userLocation && (
            <LeafletCircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={10}
              eventHandlers={{
                click: () => {
                  if (interactive && onMapClick && userLocation) {
                    onMapClick(userLocation);
                  }
                }
              }}
              pathOptions={{
                color: '#FFFFFF',
                weight: 3,
                fillColor: '#2563EB',
                fillOpacity: 1
              }}
            />
          )}

          {pickup && <LeafletMarker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
          {drop && <LeafletMarker position={[drop.lat, drop.lng]} icon={dropIcon} />}
          {drivers.map((drv) => (
            <LeafletMarker key={drv.id} position={[drv.lat, drv.lng]} icon={bikeIcon} />
          ))}
          {pickup && drop && polylineCoords.length > 0 && (
            <LeafletPolyline positions={polylineCoords} color="#000000" weight={4} opacity={0.85} />
          )}
          <LeafletMapCenterUpdater center={currentCenter} />
          {interactive && (
            <LeafletMapEvents
              userLocation={userLocation}
              onMapClick={(coords) => {
                if (drawingMode === 'draw' && onAddDrawnPoint) {
                  onAddDrawnPoint(coords);
                } else if (onMapClick) {
                  onMapClick(coords);
                }
              }}
            />
          )}
        </MapContainer>
      )}
    </div>
  );
}
