/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { 
  DriverWallet, 
  CommissionTransaction, 
  UserProfile, 
  Ride, 
  DriverVerificationStatus, 
  DriverAccessReason, 
  DriverAccessEvaluation,
  AppSettings
} from '../types';

export const DEFAULT_COMMISSION_PERCENT = 10;
export const DEFAULT_COMMISSION_BLOCK_LIMIT = 100; // Threshold (₹) where driver is blocked from receiving new rides
export const MIN_WALLET_BALANCE_REQUIRED = -100;

/**
 * Fetch global app settings for commission rate and block limit
 */
export async function getGlobalCommissionSettings(): Promise<{ commissionRatePercent: number; commissionBlockLimit: number }> {
  try {
    const settingsDoc = await getDoc(doc(db, 'app_settings', 'global'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as Partial<AppSettings>;
      return {
        commissionRatePercent: data.commissionRatePercent ?? DEFAULT_COMMISSION_PERCENT,
        commissionBlockLimit: data.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT
      };
    }
  } catch (err) {
    console.warn('Could not fetch app_settings/global:', err);
  }
  return {
    commissionRatePercent: DEFAULT_COMMISSION_PERCENT,
    commissionBlockLimit: DEFAULT_COMMISSION_BLOCK_LIMIT
  };
}

/**
 * Evaluates driver ride access status with all 7 business rules:
 * 1. Driver Approval Status == APPROVED
 * 2. Driver Online == true
 * 3. Driver Available == true (not currently busy on an active trip)
 * 4. Driver Inside Service Area Polygon == true
 * 5. Driver Admin Ride Control == ACTIVE (not SUSPENDED by Admin)
 * 6. Driver Commission Balance < Commission Block Limit (₹100)
 */
export function evaluateDriverRideAccess(
  driver: Partial<UserProfile> | null | undefined,
  activeRide: Ride | null = null,
  serviceArea?: { enabled: boolean; polygon: any[] },
  isDriverInside: boolean = true
): DriverAccessEvaluation {
  const balance = driver?.commissionBalance ?? 0;
  const blockLimit = driver?.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT;
  const isCommissionLimitReached = balance >= blockLimit;
  const isAdminSuspended = driver?.adminRideAccess === 'SUSPENDED';

  // 1. Verification status
  if (!driver || driver.driverVerificationStatus !== DriverVerificationStatus.APPROVED) {
    return {
      canReceiveNewRides: false,
      rideAccessStatus: 'BLOCKED',
      reason: 'Driver Not Approved',
      bengaliReason: 'ড্রাইভার ভেরিফিকেশন অপেক্ষমান / ড্রাইভার অনুমোদিত নয়',
      isCommissionLimitReached,
      isAdminSuspended,
      commissionBalance: balance,
      commissionBlockLimit: blockLimit
    };
  }

  // 2. Online status
  if (!driver.isOnline) {
    return {
      canReceiveNewRides: false,
      rideAccessStatus: 'BLOCKED',
      reason: 'Driver Offline',
      bengaliReason: 'ড্রাইভার অফলাইনে আছেন (Online সুইচ চালু করুন)',
      isCommissionLimitReached,
      isAdminSuspended,
      commissionBalance: balance,
      commissionBlockLimit: blockLimit
    };
  }

  // 3. Busy on active trip
  if (activeRide) {
    return {
      canReceiveNewRides: false,
      rideAccessStatus: 'BLOCKED',
      reason: 'Busy',
      bengaliReason: 'চলমান ট্রিপে ব্যস্ত আছেন (ট্রিপ শেষ হলে আবার নতুন রাইড পাবেন)',
      isCommissionLimitReached,
      isAdminSuspended,
      commissionBalance: balance,
      commissionBlockLimit: blockLimit
    };
  }

  // 4. Outside service area polygon
  if (serviceArea?.enabled && !isDriverInside) {
    return {
      canReceiveNewRides: false,
      rideAccessStatus: 'BLOCKED',
      reason: 'Outside Service Area',
      bengaliReason: 'সার্ভিস এলাকার বাইরে অবস্থান করছেন',
      isCommissionLimitReached,
      isAdminSuspended,
      commissionBalance: balance,
      commissionBlockLimit: blockLimit
    };
  }

  // 5. Admin manual suspension
  if (isAdminSuspended) {
    return {
      canReceiveNewRides: false,
      rideAccessStatus: 'SUSPENDED',
      reason: 'Admin Suspended',
      bengaliReason: 'অ্যাডমিন কর্তৃক নতুন রাইড গ্রহণ স্থগিত করা হয়েছে',
      isCommissionLimitReached,
      isAdminSuspended: true,
      commissionBalance: balance,
      commissionBlockLimit: blockLimit
    };
  }

  // 6. Commission threshold reached
  if (isCommissionLimitReached) {
    return {
      canReceiveNewRides: false,
      rideAccessStatus: 'BLOCKED',
      reason: 'Commission Limit Reached',
      bengaliReason: `বকেয়া কমিশন সীমা (₹${blockLimit}) পৌঁছেছে - কমিশন পরিশোধ করুন`,
      isCommissionLimitReached: true,
      isAdminSuspended: false,
      commissionBalance: balance,
      commissionBlockLimit: blockLimit
    };
  }

  // 7. All checks passed
  return {
    canReceiveNewRides: true,
    rideAccessStatus: 'ACTIVE',
    reason: 'ACTIVE',
    bengaliReason: 'সক্রিয় - নতুন রাইড পাওয়ার জন্য প্রস্তুত',
    isCommissionLimitReached: false,
    isAdminSuspended: false,
    commissionBalance: balance,
    commissionBlockLimit: blockLimit
  };
}

/**
 * Record 10% commission on a completed ride.
 * IDEMPOTENT: Uses commissionProcessed flag on the ride document to guarantee
 * commission is added exactly ONCE for each completed ride.
 */
export async function recordCompletedRideCommission(
  rideId: string,
  options?: {
    forceFare?: number;
    forceDriverId?: string;
    forceDriverName?: string;
  }
): Promise<{
  success: boolean;
  alreadyProcessed?: boolean;
  commissionAmount: number;
  newCommissionBalance: number;
  isCommissionBlocked: boolean;
}> {
  try {
    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);

    if (!rideSnap.exists()) {
      console.error(`Ride ${rideId} not found`);
      return { success: false, commissionAmount: 0, newCommissionBalance: 0, isCommissionBlocked: false };
    }

    const ride = rideSnap.data() as Ride;

    // Idempotency check: Never charge commission twice
    if (ride.commissionProcessed) {
      console.log(`Ride ${rideId} commission already processed. Skipping.`);
      return {
        success: true,
        alreadyProcessed: true,
        commissionAmount: ride.commissionAmount || 0,
        newCommissionBalance: 0,
        isCommissionBlocked: false
      };
    }

    const driverId = options?.forceDriverId || ride.driverId;
    if (!driverId) {
      console.error(`Ride ${rideId} has no driver assigned`);
      return { success: false, commissionAmount: 0, newCommissionBalance: 0, isCommissionBlocked: false };
    }

    const driverName = options?.forceDriverName || ride.driverName || 'Driver';
    const finalFare = options?.forceFare ?? ride.finalFare ?? ride.acceptedFare ?? ride.userOfferedFare ?? 0;

    // Get current global settings
    const settings = await getGlobalCommissionSettings();
    const commissionPercent = settings.commissionRatePercent;
    const commissionAmount = Math.round((finalFare * commissionPercent) / 100);

    // 1. Mark ride as processed atomically
    await updateDoc(rideRef, {
      commissionProcessed: true,
      commissionAmount,
      commissionRate: commissionPercent / 100,
      commissionStatus: 'DUE',
      finalFare,
      updatedAt: Date.now()
    });

    // 2. Update Driver User Document (users collection)
    const driverUserRef = doc(db, 'users', driverId);
    const driverSnap = await getDoc(driverUserRef);
    const driverData = driverSnap.exists() ? (driverSnap.data() as Partial<UserProfile>) : {};

    const currentBalance = driverData.commissionBalance ?? 0;
    const newCommissionBalance = currentBalance + commissionAmount;
    const totalDue = (driverData.totalCommissionDue ?? 0) + commissionAmount;
    const totalIncome = (driverData.totalRideIncome ?? 0) + finalFare;
    const blockLimit = driverData.commissionBlockLimit ?? settings.commissionBlockLimit;
    const isCommissionBlocked = newCommissionBalance >= blockLimit;

    await setDoc(driverUserRef, {
      commissionBalance: newCommissionBalance,
      totalCommissionDue: totalDue,
      totalRideIncome: totalIncome,
      commissionBlocked: isCommissionBlocked,
      commissionBlockLimit: blockLimit,
      updatedAt: Date.now()
    }, { merge: true });

    // 3. Add Commission Transaction Record in ledger
    await addDoc(collection(db, 'commission_transactions'), {
      driverId,
      driverName,
      rideId,
      amount: commissionAmount,
      type: 'COMMISSION_DEDUCTION',
      paymentMethod: 'AUTO_DEDUCT',
      status: 'COMPLETED',
      description: `Ride Commission (10%) on Ride #${rideId.slice(0, 6)} - Fare: ₹${finalFare}`,
      timestamp: Date.now()
    });

    // 4. Also keep wallets collection in sync for backwards compatibility
    const walletRef = doc(db, 'wallets', driverId);
    await setDoc(walletRef, {
      driverId,
      driverName,
      balance: -newCommissionBalance,
      pendingCommission: newCommissionBalance,
      totalEarned: totalIncome,
      isBlocked: isCommissionBlocked,
      commissionBlockLimit: blockLimit,
      updatedAt: Date.now()
    }, { merge: true });

    return {
      success: true,
      commissionAmount,
      newCommissionBalance,
      isCommissionBlocked
    };
  } catch (err) {
    console.error('Error recording completed ride commission:', err);
    return { success: false, commissionAmount: 0, newCommissionBalance: 0, isCommissionBlocked: false };
  }
}

/**
 * Process a verified commission payment made by driver through Cashfree.
 * IDEMPOTENT: Checks orderId in transactions to prevent duplicate balance reductions.
 */
export async function processCashfreeCommissionPayment(paymentData: {
  driverId: string;
  driverName: string;
  amount: number;
  orderId: string;
  paymentSessionId?: string;
  paymentMethod?: string;
}): Promise<{
  success: boolean;
  alreadyProcessed?: boolean;
  newCommissionBalance: number;
  isBlocked: boolean;
}> {
  try {
    const { driverId, driverName, amount, orderId, paymentSessionId, paymentMethod = 'Cashfree' } = paymentData;

    // Idempotency check: If this order has already been credited, do not reduce balance twice
    const txQuery = query(
      collection(db, 'commission_transactions'),
      where('orderId', '==', orderId),
      where('status', '==', 'COMPLETED')
    );
    const existingTx = await getDocs(txQuery);
    if (!existingTx.empty) {
      console.log(`Payment order ${orderId} already processed. Skipping duplicate deduction.`);
      const driverRef = doc(db, 'users', driverId);
      const driverSnap = await getDoc(driverRef);
      const bal = driverSnap.data()?.commissionBalance ?? 0;
      const limit = driverSnap.data()?.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT;
      return { success: true, alreadyProcessed: true, newCommissionBalance: bal, isBlocked: bal >= limit };
    }

    // Fetch driver record
    const driverRef = doc(db, 'users', driverId);
    const driverSnap = await getDoc(driverRef);
    const driverData = driverSnap.exists() ? (driverSnap.data() as Partial<UserProfile>) : {};

    const currentBalance = driverData.commissionBalance ?? 0;
    const newCommissionBalance = Math.max(0, currentBalance - amount);
    const totalPaid = (driverData.totalCommissionPaid ?? 0) + amount;
    const blockLimit = driverData.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT;
    const isBlocked = newCommissionBalance >= blockLimit;

    // Update driver user document
    await setDoc(driverRef, {
      commissionBalance: newCommissionBalance,
      totalCommissionPaid: totalPaid,
      commissionBlocked: isBlocked,
      updatedAt: Date.now()
    }, { merge: true });

    // Record verified transaction in ledger
    await addDoc(collection(db, 'commission_transactions'), {
      driverId,
      driverName,
      amount,
      orderId,
      paymentSessionId: paymentSessionId || '',
      type: 'COMMISSION_PAYMENT',
      paymentMethod,
      status: 'COMPLETED',
      verificationResult: 'VERIFIED_SUCCESS',
      description: `Commission Payment of ₹${amount} via ${paymentMethod} (Order: ${orderId})`,
      timestamp: Date.now()
    });

    // Keep wallets collection in sync
    const walletRef = doc(db, 'wallets', driverId);
    await setDoc(walletRef, {
      driverId,
      driverName,
      balance: -newCommissionBalance,
      pendingCommission: newCommissionBalance,
      totalCommissionPaid: totalPaid,
      isBlocked,
      updatedAt: Date.now()
    }, { merge: true });

    return {
      success: true,
      newCommissionBalance,
      isBlocked
    };
  } catch (err) {
    console.error('Error processing Cashfree commission payment:', err);
    return { success: false, newCommissionBalance: 0, isBlocked: false };
  }
}

/**
 * Toggle driver manual admin ride access (ACTIVE / SUSPENDED)
 */
export async function toggleDriverAdminRideAccess(
  driverId: string, 
  currentAccess: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE'
): Promise<'ACTIVE' | 'SUSPENDED'> {
  const newAccess = currentAccess === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
  const userRef = doc(db, 'users', driverId);
  const walletRef = doc(db, 'wallets', driverId);

  await setDoc(userRef, {
    adminRideAccess: newAccess,
    updatedAt: Date.now()
  }, { merge: true });

  await setDoc(walletRef, {
    adminRideAccess: newAccess,
    updatedAt: Date.now()
  }, { merge: true });

  return newAccess;
}

/**
 * Legacy compatibility functions
 */
export async function getDriverWallet(driverId: string, driverName: string = 'Driver'): Promise<DriverWallet> {
  const walletRef = doc(db, 'wallets', driverId);
  const snap = await getDoc(walletRef);

  if (snap.exists()) {
    return snap.data() as DriverWallet;
  }

  const initialWallet: DriverWallet = {
    driverId,
    driverName,
    balance: 0,
    totalEarned: 0,
    totalCommissionPaid: 0,
    pendingCommission: 0,
    isBlocked: false,
    updatedAt: Date.now()
  };

  try {
    await setDoc(walletRef, initialWallet);
  } catch (err) {
    console.error('Failed to create initial wallet document:', err);
  }

  return initialWallet;
}

export function calculateCommission(fare: number, ratePercent: number = DEFAULT_COMMISSION_PERCENT): number {
  return Math.round((fare * ratePercent) / 100);
}

export async function recordRideCommission(
  driverId: string,
  driverName: string,
  rideId: string,
  fare: number,
  ratePercent: number = DEFAULT_COMMISSION_PERCENT
): Promise<{ success: boolean; commissionAmount: number; newBalance: number }> {
  const res = await recordCompletedRideCommission(rideId, {
    forceFare: fare,
    forceDriverId: driverId,
    forceDriverName: driverName
  });
  return {
    success: res.success,
    commissionAmount: res.commissionAmount,
    newBalance: -res.newCommissionBalance
  };
}

export async function rechargeDriverWallet(
  driverId: string,
  driverName: string,
  amount: number,
  paymentMethod: 'UPI' | 'CASH' | 'NET_BANKING' = 'UPI'
): Promise<{ success: boolean; newBalance: number }> {
  const res = await processCashfreeCommissionPayment({
    driverId,
    driverName,
    amount,
    orderId: `MANUAL_RECHARGE_${Date.now()}`,
    paymentMethod
  });
  return {
    success: res.success,
    newBalance: -res.newCommissionBalance
  };
}
