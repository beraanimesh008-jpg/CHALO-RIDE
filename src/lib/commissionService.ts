/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { DriverWallet, CommissionTransaction } from '../types';

export const DEFAULT_COMMISSION_PERCENT = 10;
export const MIN_WALLET_BALANCE_REQUIRED = -100; // Driver can go into negative up to -₹100 before block

export async function getDriverWallet(driverId: string, driverName: string = 'Driver'): Promise<DriverWallet> {
  const walletRef = doc(db, 'wallets', driverId);
  const snap = await getDoc(walletRef);

  if (snap.exists()) {
    return snap.data() as DriverWallet;
  }

  // Create default wallet
  const initialWallet: DriverWallet = {
    driverId,
    driverName,
    balance: 200, // Welcome promotional wallet bonus of ₹200 for new drivers
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
  const commissionAmount = calculateCommission(fare, ratePercent);
  const walletRef = doc(db, 'wallets', driverId);
  
  try {
    const currentWallet = await getDriverWallet(driverId, driverName);
    const newBalance = currentWallet.balance - commissionAmount;
    const newTotalEarned = currentWallet.totalEarned + (fare - commissionAmount);
    const newCommissionPaid = currentWallet.totalCommissionPaid + commissionAmount;
    const isBlocked = newBalance < MIN_WALLET_BALANCE_REQUIRED;

    await updateDoc(walletRef, {
      balance: newBalance,
      totalEarned: newTotalEarned,
      totalCommissionPaid: newCommissionPaid,
      isBlocked,
      updatedAt: Date.now()
    });

    // Add transaction record
    await addDoc(collection(db, 'commission_transactions'), {
      driverId,
      driverName,
      rideId,
      amount: commissionAmount,
      type: 'COMMISSION_DEDUCTION',
      paymentMethod: 'AUTO_DEDUCT',
      status: 'COMPLETED',
      description: `10% Commission on Ride ₹${fare}`,
      timestamp: Date.now()
    });

    return { success: true, commissionAmount, newBalance };
  } catch (err) {
    console.error('Error recording ride commission:', err);
    return { success: false, commissionAmount, newBalance: 0 };
  }
}

export async function rechargeDriverWallet(
  driverId: string,
  driverName: string,
  amount: number,
  paymentMethod: 'UPI' | 'CASH' | 'NET_BANKING' = 'UPI'
): Promise<{ success: boolean; newBalance: number }> {
  const walletRef = doc(db, 'wallets', driverId);

  try {
    const currentWallet = await getDriverWallet(driverId, driverName);
    const newBalance = currentWallet.balance + amount;
    const isBlocked = newBalance < MIN_WALLET_BALANCE_REQUIRED;

    await updateDoc(walletRef, {
      balance: newBalance,
      isBlocked,
      updatedAt: Date.now()
    });

    await addDoc(collection(db, 'commission_transactions'), {
      driverId,
      driverName,
      amount,
      type: 'WALLET_RECHARGE',
      paymentMethod,
      status: 'COMPLETED',
      description: `Wallet recharge via ${paymentMethod}`,
      timestamp: Date.now()
    });

    return { success: true, newBalance };
  } catch (err) {
    console.error('Error recharging driver wallet:', err);
    return { success: false, newBalance: 0 };
  }
}
