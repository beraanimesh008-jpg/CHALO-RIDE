/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polylinePath?: Array<{ lat: number; lng: number }>;
}

export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult> {
  const google = typeof window !== 'undefined' ? (window as any).google : undefined;

  // 1. Try modern Google Routes API (New) via JS SDK
  if (google?.maps) {
    try {
      let routesLib = google.maps.routes;
      if (!routesLib && typeof google.maps.importLibrary === 'function') {
        routesLib = await google.maps.importLibrary('routes');
      }

      if (routesLib?.Route?.computeRoutes) {
        const request = {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis']
        };

        const response = await routesLib.Route.computeRoutes(request);
        if (response?.routes && response.routes.length > 0) {
          const primaryRoute = response.routes[0];
          const distanceKm = Number(((primaryRoute.distanceMeters ?? 0) / 1000).toFixed(2));
          const durationMinutes = Math.max(1, Math.round((primaryRoute.durationMillis ?? 0) / 60000));

          let polylinePath: Array<{ lat: number; lng: number }> = [];
          if (primaryRoute.path && Array.isArray(primaryRoute.path)) {
            polylinePath = primaryRoute.path.map((pt: any) => ({
              lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
              lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng
            }));
          } else if (typeof primaryRoute.createPolylines === 'function') {
            const polylines = primaryRoute.createPolylines();
            if (polylines && polylines[0]?.getPath) {
              polylinePath = polylines[0].getPath().getArray().map((pt: any) => ({
                lat: pt.lat(),
                lng: pt.lng()
              }));
            }
          }

          if (distanceKm > 0) {
            return { distanceKm, durationMinutes, polylinePath };
          }
        }
      }
    } catch (err) {
      console.warn('Google Routes API (New) notice, falling back to road router:', err);
    }
  }

  // 2. High-precision Road Routing via OSRM fallback
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = Number((route.distance / 1000).toFixed(2));
      const durationMinutes = Math.max(1, Math.round(route.duration / 60));
      const polylinePath = (route.geometry.coordinates || []).map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0]
      }));

      return { distanceKm, durationMinutes, polylinePath };
    }
  } catch (err) {
    console.warn('OSRM routing failed, falling back to Haversine straight-line distance:', err);
  }

  // Haversine fallback
  const R = 6371;
  const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
  const dLon = ((destination.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((destination.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Number((R * c).toFixed(2));
  const durationMinutes = Math.max(2, Math.round(distanceKm * 2.5)); // ~25 km/h average bike speed

  return {
    distanceKm,
    durationMinutes,
    polylinePath: [origin, destination]
  };
}
