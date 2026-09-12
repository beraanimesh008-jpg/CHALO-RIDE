/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = ["places", "geometry"];

export const DEFAULT_CENTER = {
  lat: 21.85, // Centered around Pathar Pratima / Mathurapur
  lng: 88.37,
};

export const SERVICE_AREA_BOUNDS: [[number, number], [number, number]] = [
  [21.6, 88.1], // South-West
  [22.1, 88.65], // North-East
];

export const COMMISSION_RATE = 0.1; // 10%

export const APP_THEME = {
  colors: {
    primary: "#000000", // Sleek black
    accent: "#F27D26",  // Warm orange for attention
    bg: "#FFFFFF",
    muted: "#8E9299",
  },
};
