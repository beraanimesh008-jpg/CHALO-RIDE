/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PolygonCoord, PolygonServiceArea, ServiceArea } from '../types';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

/**
 * Default geographic boundary coordinates enclosing the ChaLo rural operating
 * network in South 24 Parganas, West Bengal:
 * Pathar Pratima, Mathurapur, Kakdwip, Namkhana, Ramganga, Raidighi.
 */
export const DEFAULT_CHALO_POLYGON: PolygonCoord[] = [
  { lat: 22.065, lng: 88.375 }, // North Mathurapur / Mandirbazar corridor
  { lat: 22.015, lng: 88.512 }, // North-East Raidighi & river edge
  { lat: 21.865, lng: 88.485 }, // East Ramganga / Kuemuri
  { lat: 21.725, lng: 88.410 }, // South-East Pathar Pratima southern island / Brajaballabhpur
  { lat: 21.710, lng: 88.240 }, // South Namkhana & Hatania-Doania creek
  { lat: 21.840, lng: 88.150 }, // West Kakdwip / Muriganga river bank
  { lat: 21.950, lng: 88.220 }, // North-West Kulpi border
];

export const DEFAULT_POLYGON_SERVICE_AREA: PolygonServiceArea = {
  id: 'primary_boundary',
  name: 'ChaLo Sundarban Operating Zone',
  bengaliName: 'চলো সুন্দরবন সার্ভিস এলাকা',
  enabled: true,
  polygon: DEFAULT_CHALO_POLYGON,
  updatedAt: 1710000000000,
  updatedBy: 'system'
};

/**
 * Preserved historical legacy hub definitions (preserved for data safety,
 * not used for polygon-based ride eligibility).
 */
export const DEFAULT_SERVICE_AREAS: ServiceArea[] = [
  {
    id: 'zone-patharpratima',
    name: 'Pathar Pratima Central',
    bengaliName: 'পাথরপ্রতিমা সদর',
    center: { lat: 21.796, lng: 88.358 },
    radiusKm: 12,
    isActive: true,
    description: 'Central hub connecting Pathar Pratima Ghat, hospital, and marketplace'
  },
  {
    id: 'zone-mathurapur',
    name: 'Mathurapur & Railway Junction',
    bengaliName: 'মথুরাপুর স্টেশন ও বাজার',
    center: { lat: 22.025, lng: 88.388 },
    radiusKm: 10,
    isActive: true,
    description: 'High commuter density corridor linking train services to ferry points'
  },
  {
    id: 'zone-kakdwip',
    name: 'Kakdwip Port & Sub-division',
    bengaliName: 'কাকদ্বীপ বন্দর ও বাসস্ট্যান্ড',
    center: { lat: 21.876, lng: 88.188 },
    radiusKm: 14,
    isActive: true,
    description: 'Commercial fishing harbour and major transport junction'
  },
  {
    id: 'zone-raidighi',
    name: 'Raidighi & Mani River Link',
    bengaliName: 'রায়দিঘি বাজার',
    center: { lat: 21.996, lng: 88.489 },
    radiusKm: 10,
    isActive: true,
    description: 'Agricultural trade center and river jetty'
  },
  {
    id: 'zone-namkhana',
    name: 'Namkhana & Hatania Doania',
    bengaliName: 'নামখানা ফেরিঘাট',
    center: { lat: 21.765, lng: 88.232 },
    radiusKm: 12,
    isActive: true,
    description: 'Gateway to Bakkhali and coastal villages'
  },
  {
    id: 'zone-ramganga',
    name: 'Ramganga River Port',
    bengaliName: 'রামগঙ্গা খেয়াঘাট',
    center: { lat: 21.821, lng: 88.397 },
    radiusKm: 8,
    isActive: true,
    description: 'Key river transport and island ferry terminal'
  }
];

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// In-memory live state singleton synced with Firestore
let livePolygonServiceArea: PolygonServiceArea = DEFAULT_POLYGON_SERVICE_AREA;
const listeners = new Set<(area: PolygonServiceArea) => void>();

export function getLivePolygonServiceArea(): PolygonServiceArea {
  return livePolygonServiceArea;
}

// Subscribe to Firestore 'service_areas/primary_boundary'
if (typeof window !== 'undefined') {
  try {
    const boundaryRef = doc(db, 'service_areas', 'primary_boundary');
    onSnapshot(boundaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        livePolygonServiceArea = {
          id: 'primary_boundary',
          name: data.name || DEFAULT_POLYGON_SERVICE_AREA.name,
          bengaliName: data.bengaliName || DEFAULT_POLYGON_SERVICE_AREA.bengaliName,
          enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
          polygon: Array.isArray(data.polygon) && data.polygon.length >= 3 ? data.polygon : DEFAULT_CHALO_POLYGON,
          updatedAt: data.updatedAt || Date.now(),
          updatedBy: data.updatedBy || 'admin'
        };
      } else {
        // Initialize the document with default polygon
        setDoc(boundaryRef, DEFAULT_POLYGON_SERVICE_AREA, { merge: true }).catch((err) => {
          console.warn('Initial boundary seeding notice:', err);
        });
      }
      // Notify all reactive subscribers
      listeners.forEach((fn) => fn(livePolygonServiceArea));
    }, (error) => {
      console.warn('Could not subscribe to primary_boundary:', error);
    });
  } catch (err) {
    console.warn('ServiceArea subscription initialization error:', err);
  }
}

/**
 * React hook to subscribe to the active service area polygon in real-time.
 */
export function useServiceAreaPolygon(): PolygonServiceArea {
  const [area, setArea] = useState<PolygonServiceArea>(livePolygonServiceArea);

  useEffect(() => {
    setArea(livePolygonServiceArea);
    const handler = (newArea: PolygonServiceArea) => setArea(newArea);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return area;
}

/**
 * Standard Ray-Casting algorithm to check if point (lat, lng) is inside a polygon.
 * Works seamlessly in client, server, and web worker environments without requiring Google Maps loaded.
 */
export function isPointInPolygon(point: { lat: number; lng: number }, polygon: PolygonCoord[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Validates whether a location coordinate is inside the ChaLo service boundary.
 * If serviceArea.enabled is false, returns inService: true (unrestricted).
 */
export function isWithinServicePolygon(
  lat: number,
  lng: number,
  customPolygon?: PolygonCoord[],
  customEnabled?: boolean
): { inService: boolean; enabled: boolean; polygon: PolygonCoord[] } {
  const polygon = customPolygon || livePolygonServiceArea.polygon;
  const enabled = customEnabled !== undefined ? customEnabled : livePolygonServiceArea.enabled;

  if (!enabled) {
    return { inService: true, enabled: false, polygon };
  }

  const inside = isPointInPolygon({ lat, lng }, polygon);
  return { inService: inside, enabled: true, polygon };
}

/**
 * Backwards-compatible drop-in replacement for existing isWithinServiceArea calls.
 * Replaces radius calculation with exact polygon point-in-polygon verification.
 */
export function isWithinServiceArea(
  lat: number,
  lng: number,
  _legacyAreas?: ServiceArea[]
): { inService: boolean; enabled: boolean; matchedZone?: any; distanceToCenter?: number } {
  const check = isWithinServicePolygon(lat, lng);
  return {
    inService: check.inService,
    enabled: check.enabled,
    distanceToCenter: 0,
    matchedZone: {
      name: livePolygonServiceArea.name,
      bengaliName: livePolygonServiceArea.bengaliName
    }
  };
}

/**
 * Saves or updates the primary service area polygon in Firestore.
 */
export async function saveServiceAreaPolygon(
  polygon: PolygonCoord[],
  enabled: boolean,
  updatedBy: string = 'admin'
): Promise<void> {
  const boundaryRef = doc(db, 'service_areas', 'primary_boundary');
  const payload: PolygonServiceArea = {
    id: 'primary_boundary',
    name: 'ChaLo Sundarban Operating Zone',
    bengaliName: 'চলো সুন্দরবন সার্ভিস এলাকা',
    enabled,
    polygon,
    updatedAt: Date.now(),
    updatedBy
  };

  await setDoc(boundaryRef, payload, { merge: true });
  livePolygonServiceArea = payload;
  listeners.forEach((fn) => fn(payload));
}

