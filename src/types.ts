/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  USER = 'USER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum RideStatus {
  SEARCHING = 'SEARCHING',
  NEGOTIATING = 'NEGOTIATING',
  ACCEPTED = 'ACCEPTED',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DriverVerificationStatus {
  INCOMPLETE = 'INCOMPLETE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  phoneNumber?: string;
  onboardingComplete?: boolean;
  driverOnboardingComplete?: boolean;
  // Driver Verification & Mandatory Profile Fields
  driverVerificationStatus?: DriverVerificationStatus;
  driverName?: string;
  driverMobile?: string;
  aadhaarNumber?: string;
  driverPhotoUrl?: string;
  submittedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;
  vehiclePhoto?: string;
  aadhaarPhoto?: string;
  accountNumber?: string;
  ifscCode?: string;
  rating?: number;
  totalRides?: number;
  isOnline?: boolean;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  bikeDetails?: {
    model: string;
    number: string;
  };
  // Driver Commission & Ride Access Control
  commissionRate?: number; // e.g. 0.10 (10%)
  commissionBalance?: number; // Outstanding commission due (₹)
  commissionBlockLimit?: number; // Configurable threshold (₹, default 100)
  adminRideAccess?: 'ACTIVE' | 'SUSPENDED'; // Manual admin override
  commissionBlocked?: boolean; // True when commissionBalance >= commissionBlockLimit
  totalCommissionDue?: number; // Cumulative commission charged
  totalCommissionPaid?: number; // Cumulative commission paid via Cashfree
  totalRideIncome?: number; // Cumulative ride fares earned
  createdAt?: number;
  updatedAt?: number;
}

export function maskAadhaar(aadhaar?: string): string {
  if (!aadhaar) return 'Not Provided';
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length < 4) return '•••• •••• ••••';
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

export function validateAadhaar(aadhaar: string): { isValid: boolean; error?: string } {
  const clean = aadhaar.replace(/[\s-]/g, '');
  if (!clean) {
    return { isValid: false, error: 'Driver Aadhaar Number is mandatory. / ড্রাইভারের আধার নম্বর আবশ্যক।' };
  }
  if (!/^\d{12}$/.test(clean)) {
    return { isValid: false, error: 'Aadhaar must be exactly 12 digits. / আধার নম্বর ১২ সংখ্যার হতে হবে।' };
  }
  if (/^(\d)\1{11}$/.test(clean)) {
    return { isValid: false, error: 'Invalid Aadhaar number pattern. / সঠিক আধার নম্বর দিন।' };
  }
  return { isValid: true };
}

export function validateDriverMobile(mobile: string): { isValid: boolean; error?: string } {
  const clean = mobile.replace(/[\s-+]/g, '');
  const digits = clean.startsWith('91') && clean.length === 12 ? clean.slice(2) : clean;
  if (!digits) {
    return { isValid: false, error: 'Driver Mobile Number is mandatory. / ড্রাইভারের মোবাইল নম্বর আবশ্যক।' };
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { isValid: false, error: 'Enter a valid 10-digit Indian mobile number. / সঠিক ১০ সংখ্যার মোবাইল নম্বর দিন।' };
  }
  return { isValid: true };
}

export interface RideOffer {
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  driverRating: number;
  driverPhone?: string;
  driverLocation: {
    lat: number;
    lng: number;
  };
  offeredFare: number;
  bikeDetails: {
    model: string;
    number: string;
  };
  timestamp: number;
}

export interface Ride {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userPhone?: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  drop: {
    address: string;
    lat: number;
    lng: number;
  };
  distance?: number;
  passengerCount?: number;
  routeDistanceKm?: number;
  baseFare?: number;
  passengerExtraCharge?: number;
  finalFare?: number;
  userOfferedFare: number;
  status: RideStatus;
  driverId?: string;
  driverName?: string;
  driverPhoto?: string;
  driverRating?: number;
  driverPhone?: string;
  bikeDetails?: {
    model: string;
    number: string;
  };
  acceptedFare?: number;
  offers: RideOffer[];
  // Commission tracking per ride
  commissionRate?: number; // 0.10 (10%)
  commissionAmount?: number; // 10% of final fare
  commissionStatus?: 'DUE' | 'PAID';
  commissionProcessed?: boolean; // Idempotency guard to prevent double-charging
  paymentMethod?: string; // 'Cash', 'UPI', 'Cashfree', etc.
  createdAt: number;
  updatedAt: number;
}

export interface AdminStats {
  totalRides: number;
  totalUsers: number;
  totalDrivers: number;
  totalEarnings: number;
  commissionRate: number;
}

export interface DriverWallet {
  driverId: string;
  driverName?: string;
  balance: number;
  totalEarned: number;
  totalCommissionPaid: number;
  pendingCommission: number;
  isBlocked: boolean;
  commissionBlockLimit?: number;
  adminRideAccess?: 'ACTIVE' | 'SUSPENDED';
  updatedAt: number;
}

export interface CommissionTransaction {
  id: string;
  driverId: string;
  driverName: string;
  rideId?: string;
  amount: number;
  type: 'COMMISSION_DEDUCTION' | 'COMMISSION_PAYMENT' | 'WALLET_RECHARGE';
  paymentMethod?: 'UPI' | 'CASH' | 'NET_BANKING' | 'AUTO_DEDUCT' | 'Cashfree' | string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  description?: string;
  orderId?: string;
  paymentSessionId?: string;
  verificationResult?: string;
  timestamp: number;
}

export interface PolygonCoord {
  lat: number;
  lng: number;
}

export interface PolygonServiceArea {
  id: string; // 'primary_boundary'
  name: string;
  bengaliName: string;
  enabled: boolean;
  polygon: PolygonCoord[];
  updatedAt: number;
  updatedBy: string;
}

export interface ServiceArea {
  id: string;
  name: string;
  bengaliName: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  isActive: boolean;
  description: string;
}

export interface LiveDriverLocation {
  driverId: string;
  driverName: string;
  driverPhone?: string;
  bikeModel?: string;
  bikeNumber?: string;
  rating: number;
  lat: number;
  lng: number;
  isOnline: boolean;
  status: 'IDLE' | 'ON_RIDE';
  currentRideId?: string;
  lastUpdated: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  titleBengali?: string;
  message: string;
  target: 'ALL' | 'DRIVERS' | 'USERS';
  type: 'INFO' | 'ALERT' | 'OFFER';
  createdAt: number;
  sentBy?: string;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minFare: number;
  maxDiscount?: number;
  validUntil: number;
  isActive: boolean;
  usageCount: number;
}

export interface SupportComplaint {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userPhone?: string;
  rideId?: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  createdAt: number;
  resolvedAt?: number;
  resolutionNotes?: string;
}

export interface AppSettings {
  baseFare: number;
  perKmRate: number;
  commissionRatePercent: number;
  minimumWalletBalance: number;
  commissionBlockLimit?: number; // Threshold for blocking new rides (default ₹100)
  nightSurchargePercent: number;
  supportPhone: string;
  supportEmail: string;
  emergencyHelpline: string;
  serviceNotice: string;
  isServiceActive: boolean;
}

export type DriverAccessReason = 
  | 'ACTIVE'
  | 'Commission Limit Reached'
  | 'Admin Suspended'
  | 'Driver Not Approved'
  | 'Driver Offline'
  | 'Outside Service Area'
  | 'Busy';

export interface DriverAccessEvaluation {
  canReceiveNewRides: boolean;
  rideAccessStatus: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  reason: DriverAccessReason;
  bengaliReason: string;
  reasonDescription?: string;
  isCommissionLimitReached: boolean;
  isAdminSuspended: boolean;
  commissionBalance: number;
  commissionBlockLimit: number;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  roleTitle: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  details: string;
  timestamp: number;
}
