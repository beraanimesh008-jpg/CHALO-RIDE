/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  set, 
  update, 
  onValue, 
  off, 
  Database 
} from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';
import { getDistanceMeters } from './utils';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Resolve Realtime Database instance with fallback protection
let rtdbInstance: Database | null = null;
try {
  // Use config databaseURL or standard default URL format for project
  const dbUrl = (firebaseConfig as any).databaseURL || 
    `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;
  rtdbInstance = getDatabase(app, dbUrl);
} catch (err) {
  try {
    rtdbInstance = getDatabase(app);
  } catch (innerErr) {
    console.warn('[Firebase Realtime DB] Could not initialize Realtime Database:', innerErr);
  }
}

export interface DriverRealtimeLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  lastUpdated: number;
  online: boolean;
  heading?: number;
  speed?: number;
}

// In-Memory Driver Tracking State to strictly enforce 20s interval & 50m movement threshold
interface DriverGpsMemory {
  lastUpdated: number;
  lastLat: number;
  lastLng: number;
}

const driverMemory = new Map<string, DriverGpsMemory>();

// Rules:
// 1. Minimum 20 seconds between Firebase writes
// 2. Minimum 50 meters movement threshold
const MIN_UPDATE_INTERVAL_MS = 20000; // 20 seconds
const MIN_DISTANCE_METERS = 50; // 50 meters
const STALE_TIMEOUT_MS = 75000; // 75 seconds (between 60-90s)

/**
 * Driver Online GPS Publisher
 * Evaluates 20s interval & 50m movement filter before writing to Firebase Realtime Database.
 * Returns true if write was executed, false if filtered out.
 */
export function publishDriverGps(
  driverId: string,
  latitude: number,
  longitude: number,
  heading?: number,
  speed?: number
): boolean {
  if (!driverId || !rtdbInstance) return false;

  const now = Date.now();
  const mem = driverMemory.get(driverId);

  // Check 1: 20 seconds interval completed?
  if (mem) {
    const elapsed = now - mem.lastUpdated;
    if (elapsed < MIN_UPDATE_INTERVAL_MS) {
      // Less than 20 seconds: DO NOT write
      return false;
    }

    // Check 2: Distance from previous location >= 50 meters?
    const movedMeters = getDistanceMeters(
      { lat: mem.lastLat, lng: mem.lastLng },
      { lat: latitude, lng: longitude }
    );
    if (movedMeters < MIN_DISTANCE_METERS) {
      // Stationary or < 50m movement: DO NOT write
      return false;
    }
  }

  // Update memory
  driverMemory.set(driverId, {
    lastUpdated: now,
    lastLat: latitude,
    lastLng: longitude
  });

  // Write ONLY the realtime GPS coordinates to Firebase Realtime Database
  try {
    const driverLocRef = ref(rtdbInstance, `drivers_location/${driverId}`);
    const payload: Record<string, any> = {
      driverId,
      latitude,
      longitude,
      lastUpdated: now,
      online: true
    };
    if (typeof heading === 'number') payload.heading = heading;
    if (typeof speed === 'number') payload.speed = speed;

    set(driverLocRef, payload).catch((err) => {
      console.warn('[Firebase RTDB] Driver GPS write error:', err.message);
    });
    return true;
  } catch (err) {
    console.warn('[Firebase RTDB] Failed to set driver GPS:', err);
    return false;
  }
}

/**
 * Driver Offline Handler
 * Sets online = false in Firebase Realtime Database immediately on offline / logout.
 */
export function setDriverGpsOffline(driverId: string): void {
  if (!driverId) return;
  driverMemory.delete(driverId);

  if (!rtdbInstance) return;

  try {
    const driverLocRef = ref(rtdbInstance, `drivers_location/${driverId}`);
    update(driverLocRef, {
      online: false,
      lastUpdated: Date.now()
    }).catch((err) => {
      console.warn('[Firebase RTDB] Failed to set driver offline:', err.message);
    });
  } catch (err) {
    console.warn('[Firebase RTDB] Error in setDriverGpsOffline:', err);
  }
}

/**
 * Check if a GPS coordinate is fresh (not stale).
 * Stale if lastUpdated > 75 seconds or online === false.
 */
export function isGpsFresh(gps: DriverRealtimeLocation | null | undefined, maxAgeMs = STALE_TIMEOUT_MS): boolean {
  if (!gps) return false;
  if (!gps.online) return false;
  if (typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') return false;
  const age = Date.now() - (gps.lastUpdated || 0);
  return age >= 0 && age <= maxAgeMs;
}

/**
 * Customer Map: Subscribe to a specific assigned driver's realtime GPS
 */
export function subscribeToDriverGps(
  driverId: string,
  onLocationUpdate: (loc: DriverRealtimeLocation | null) => void
): () => void {
  if (!driverId || !rtdbInstance) {
    onLocationUpdate(null);
    return () => {};
  }

  const driverLocRef = ref(rtdbInstance, `drivers_location/${driverId}`);
  const listener = onValue(
    driverLocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as DriverRealtimeLocation;
        if (isGpsFresh(data)) {
          onLocationUpdate(data);
        } else {
          onLocationUpdate(null);
        }
      } else {
        onLocationUpdate(null);
      }
    },
    (error) => {
      console.warn('[Firebase RTDB] Customer driver GPS subscription error:', error.message);
      onLocationUpdate(null);
    }
  );

  return () => {
    try {
      off(driverLocRef, 'value', listener);
    } catch {}
  };
}

/**
 * Admin Panel & Customer Nearby: Subscribe to all online drivers' realtime GPS
 */
export function subscribeToAllDriversGps(
  onUpdate: (driversMap: Record<string, DriverRealtimeLocation>) => void
): () => void {
  if (!rtdbInstance) {
    onUpdate({});
    return () => {};
  }

  const allLocRef = ref(rtdbInstance, 'drivers_location');
  const listener = onValue(
    allLocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val() as Record<string, DriverRealtimeLocation>;
        const freshDrivers: Record<string, DriverRealtimeLocation> = {};
        for (const [id, loc] of Object.entries(raw)) {
          if (loc && isGpsFresh(loc)) {
            freshDrivers[id] = { ...loc, driverId: id };
          }
        }
        onUpdate(freshDrivers);
      } else {
        onUpdate({});
      }
    },
    (error) => {
      console.warn('[Firebase RTDB] All drivers GPS subscription error:', error.message);
      onUpdate({});
    }
  );

  return () => {
    try {
      off(allLocRef, 'value', listener);
    } catch {}
  };
}
