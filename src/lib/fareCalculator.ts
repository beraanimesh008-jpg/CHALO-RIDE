/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FareCalculationResult {
  routeDistanceKm: number;
  roundedDistanceKm: number;
  passengerCount: number;
  baseFare: number;
  passengerExtraCharge: number;
  finalFare: number;
  commissionAmount: number;
}

export const MAX_PASSENGERS = 4;
export const MIN_PASSENGERS = 1;

/**
 * Chalo TOTO Fixed Fare Chart (1 to 60 KM)
 * KM | 1 জন (p1) | 2 জন (p2) | 3 জন (p3) | 4 জন (p4)
 */
export const CHALO_FARE_CHART: Record<number, { p1: number; p2: number; p3: number; p4: number }> = {
  1: { p1: 20, p2: 25, p3: 35, p4: 47 },
  2: { p1: 25, p2: 30, p3: 40, p4: 52 },
  3: { p1: 30, p2: 35, p3: 40, p4: 47 },
  4: { p1: 35, p2: 40, p3: 55, p4: 74 },
  5: { p1: 45, p2: 55, p3: 75, p4: 100 },
  6: { p1: 50, p2: 70, p3: 80, p4: 94 },
  7: { p1: 60, p2: 80, p3: 90, p4: 105 },
  8: { p1: 70, p2: 80, p3: 95, p4: 116 },
  9: { p1: 70, p2: 85, p3: 95, p4: 110 },
  10: { p1: 70, p2: 85, p3: 100, p4: 121 },
  11: { p1: 70, p2: 90, p3: 105, p4: 126 },
  12: { p1: 70, p2: 90, p3: 105, p4: 126 },
  13: { p1: 70, p2: 95, p3: 110, p4: 131 },
  14: { p1: 70, p2: 95, p3: 110, p4: 131 },
  15: { p1: 70, p2: 97, p3: 115, p4: 140 },
  16: { p1: 75, p2: 100, p3: 115, p4: 136 },
  17: { p1: 80, p2: 100, p3: 115, p4: 136 },
  18: { p1: 100, p2: 135, p3: 150, p4: 173 },
  19: { p1: 100, p2: 135, p3: 150, p4: 173 },
  20: { p1: 145, p2: 175, p3: 190, p4: 215 },
  21: { p1: 150, p2: 175, p3: 190, p4: 215 },
  22: { p1: 150, p2: 185, p3: 220, p4: 268 },
  23: { p1: 160, p2: 185, p3: 220, p4: 268 },
  24: { p1: 170, p2: 190, p3: 230, p4: 284 },
  25: { p1: 170, p2: 190, p3: 230, p4: 284 },
  26: { p1: 180, p2: 200, p3: 250, p4: 315 },
  27: { p1: 190, p2: 200, p3: 250, p4: 315 },
  28: { p1: 190, p2: 220, p3: 280, p4: 357 },
  29: { p1: 200, p2: 250, p3: 280, p4: 326 },
  30: { p1: 200, p2: 250, p3: 300, p4: 368 },
  31: { p1: 200, p2: 250, p3: 300, p4: 368 },
  32: { p1: 210, p2: 260, p3: 300, p4: 357 },
  33: { p1: 220, p2: 270, p3: 310, p4: 368 },
  34: { p1: 220, p2: 270, p3: 325, p4: 399 },
  35: { p1: 220, p2: 270, p3: 325, p4: 399 },
  36: { p1: 230, p2: 280, p3: 335, p4: 410 },
  37: { p1: 230, p2: 280, p3: 335, p4: 410 },
  38: { p1: 240, p2: 280, p3: 335, p4: 410 },
  39: { p1: 250, p2: 300, p3: 375, p4: 472 },
  40: { p1: 250, p2: 300, p3: 375, p4: 472 },
  41: { p1: 265, p2: 320, p3: 390, p4: 483 },
  42: { p1: 270, p2: 350, p3: 390, p4: 452 },
  43: { p1: 280, p2: 360, p3: 390, p4: 441 },
  44: { p1: 295, p2: 370, p3: 405, p4: 462 },
  45: { p1: 295, p2: 370, p3: 405, p4: 462 },
  46: { p1: 290, p2: 370, p3: 405, p4: 462 },
  47: { p1: 325, p2: 395, p3: 450, p4: 530 },
  48: { p1: 325, p2: 395, p3: 450, p4: 530 },
  49: { p1: 325, p2: 395, p3: 500, p4: 635 },
  50: { p1: 370, p2: 430, p3: 500, p4: 598 },
  51: { p1: 370, p2: 430, p3: 500, p4: 598 },
  52: { p1: 370, p2: 430, p3: 500, p4: 598 },
  53: { p1: 370, p2: 430, p3: 500, p4: 598 },
  54: { p1: 380, p2: 440, p3: 500, p4: 588 },
  55: { p1: 380, p2: 450, p3: 500, p4: 578 },
  56: { p1: 400, p2: 450, p3: 500, p4: 578 },
  57: { p1: 400, p2: 450, p3: 500, p4: 578 },
  58: { p1: 400, p2: 450, p3: 500, p4: 578 },
  59: { p1: 400, p2: 450, p3: 500, p4: 578 },
  60: { p1: 420, p2: 470, p3: 510, p4: 578 }
};

/**
 * Lookup fare directly from the fixed chart based on distance and passenger count (1 to 4)
 */
export function getChartFare(distanceKm: number, passengerCount: number): number {
  const safeDistance = Math.max(0, Number(distanceKm.toFixed(2)));
  const roundedKm = Math.min(60, Math.max(1, Math.round(safeDistance || 1)));
  const tier = CHALO_FARE_CHART[roundedKm] || CHALO_FARE_CHART[1];
  
  if (passengerCount <= 1) return tier.p1;
  if (passengerCount === 2) return tier.p2;
  if (passengerCount === 3) return tier.p3;
  return tier.p4;
}

/**
 * Passenger extra charge difference relative to 1 passenger base
 */
export function getPassengerExtraCharge(passengerCount: number, distanceKm?: number): number {
  if (typeof distanceKm === 'number') {
    const safeDistance = Math.max(0, Number(distanceKm.toFixed(2)));
    const roundedKm = Math.min(60, Math.max(1, Math.round(safeDistance || 1)));
    const tier = CHALO_FARE_CHART[roundedKm] || CHALO_FARE_CHART[1];
    if (passengerCount <= 1) return 0;
    if (passengerCount === 2) return tier.p2 - tier.p1;
    if (passengerCount === 3) return tier.p3 - tier.p1;
    return tier.p4 - tier.p1;
  }
  return 0;
}

/**
 * Validate passenger count (Strictly 1 to 4 passengers)
 */
export function validatePassengerCount(passengerCount: number): { isValid: boolean; error: string | null } {
  if (!passengerCount || passengerCount < MIN_PASSENGERS) {
    return {
      isValid: false,
      error: 'Please select 1–4 passengers. / অনুগ্রহ করে ১–৪ জন যাত্রী নির্বাচন করুন।',
    };
  }
  if (passengerCount > MAX_PASSENGERS) {
    return {
      isValid: false,
      error: 'Maximum 4 passengers allowed. / সর্বোচ্চ ৪ জন যাত্রী যেতে পারবেন।',
    };
  }
  return { isValid: true, error: null };
}

/**
 * Calculate Base Fare, Passenger Extra, Final Fare, and Commission Amount
 * Directly from the official Chalo TOTO Fixed Fare Chart.
 * 
 * - Single source of truth: CHALO_FARE_CHART (1 to 60 KM)
 * - Base Fare = 1 Passenger fare for the distance row
 * - Final Fare = Exact chart fare for distance & passenger count (1, 2, 3, or 4)
 * - Passenger Extra = Final Fare - Base Fare
 * - Commission = Exactly 10% of Final Fare (rounded to nearest Rupee)
 */
export function calculateRideFare(
  distanceKm: number,
  passengerCount: number
): FareCalculationResult {
  const safeDistance = Math.max(0, Number(distanceKm.toFixed(2)));
  const roundedDistanceKm = Math.min(60, Math.max(1, Math.round(safeDistance || 1)));
  const safePassengerCount = Math.min(MAX_PASSENGERS, Math.max(MIN_PASSENGERS, Math.round(passengerCount || 1)));

  const tier = CHALO_FARE_CHART[roundedDistanceKm] || CHALO_FARE_CHART[1];
  const baseFare = tier.p1;

  let finalFare: number;
  if (safePassengerCount <= 1) {
    finalFare = tier.p1;
  } else if (safePassengerCount === 2) {
    finalFare = tier.p2;
  } else if (safePassengerCount === 3) {
    finalFare = tier.p3;
  } else {
    finalFare = tier.p4;
  }

  const passengerExtraCharge = finalFare - baseFare;
  const commissionAmount = Math.round(finalFare * 0.10);

  return {
    routeDistanceKm: safeDistance,
    roundedDistanceKm,
    passengerCount: safePassengerCount,
    baseFare,
    passengerExtraCharge,
    finalFare,
    commissionAmount,
  };
}
