/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FareCalculationResult {
  routeDistanceKm: number;
  baseFare: number;
  passengerExtraCharge: number;
  finalFare: number;
}

export const MAX_PASSENGERS = 4;
export const MIN_PASSENGERS = 1;
export const BASE_RATE_PER_KM = 10;

/**
 * Passenger extra charge rule:
 * 1 passenger -> ₹0 extra
 * 2 passengers -> ₹20 extra
 * 3 passengers -> ₹40 extra
 * 4 passengers -> ₹60 extra
 */
export function getPassengerExtraCharge(passengerCount: number): number {
  if (passengerCount === 1) return 0;
  if (passengerCount === 2) return 20;
  if (passengerCount === 3) return 40;
  if (passengerCount === 4) return 60;
  return 0;
}

/**
 * Validate passenger count
 */
export function validatePassengerCount(passengerCount: number): { isValid: boolean; error: string | null } {
  if (!passengerCount || passengerCount < MIN_PASSENGERS) {
    return {
      isValid: false,
      error: 'Please select 1–4 passengers. / অনুগ্রহ করে ১–৪ জন যাত্রী নির্বাচন করুন。',
    };
  }
  if (passengerCount > MAX_PASSENGERS) {
    return {
      isValid: false,
      error: 'Maximum 4 passengers allowed. / সর্বোচ্চ ৪ জন যাত্রী যেতে পারবেন。',
    };
  }
  return { isValid: true, error: null };
}

/**
 * Calculate Base Fare, Passenger Extra, and Final Fare
 * Base Fare = Route Distance (km) × ₹10
 * Final Fare = Base Fare + Passenger Extra
 */
export function calculateRideFare(
  distanceKm: number,
  passengerCount: number
): FareCalculationResult {
  const safeDistance = Math.max(0, Number(distanceKm.toFixed(2)));
  const baseFare = Math.round(safeDistance * BASE_RATE_PER_KM);
  const passengerExtraCharge = getPassengerExtraCharge(passengerCount);
  const finalFare = baseFare + passengerExtraCharge;

  return {
    routeDistanceKm: safeDistance,
    baseFare,
    passengerExtraCharge,
    finalFare,
  };
}
