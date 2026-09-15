/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  ShieldAlert, 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Receipt,
  Calendar,
  IndianRupee,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { UserProfile, CommissionTransaction, Ride, RideStatus } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import CommissionPaymentModal from './CommissionPaymentModal';
import { evaluateDriverRideAccess, DEFAULT_COMMISSION_BLOCK_LIMIT } from '../lib/commissionService';

interface DriverCommissionWalletProps {
  driverId: string;
  driverName: string;
}

export default function DriverCommissionWallet({ driverId, driverName }: DriverCommissionWalletProps) {
  const [driverProfile, setDriverProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [todayCompletedRides, setTodayCompletedRides] = useState<number>(0);
  const [todayIncome, setTodayIncome] = useState<number>(0);
  const [todayCommission, setTodayCommission] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    // 1. Listen to Driver profile document in users collection
    const userRef = doc(db, 'users', driverId);
    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setDriverProfile(snap.data() as UserProfile);
      }
      setLoading(false);
    });

    // 2. Listen to Driver's rides to calculate Today's Completed Rides and Earnings accurately
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();

    const ridesQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId)
    );

    const unsubRides = onSnapshot(ridesQuery, (snap) => {
      let count = 0;
      let income = 0;
      let commission = 0;

      snap.docs.forEach((d) => {
        const ride = d.data() as Ride;
        if (ride.status === RideStatus.COMPLETED) {
          const rideTime = ride.updatedAt || ride.createdAt || 0;
          if (rideTime >= todayTimestamp) {
            count += 1;
            const fare = ride.finalFare || ride.acceptedFare || ride.userOfferedFare || 0;
            income += fare;
            commission += ride.commissionAmount || Math.round(fare * 0.10);
          }
        }
      });

      setTodayCompletedRides(count);
      setTodayIncome(income);
      setTodayCommission(commission);
    });

    // 3. Listen to Commission Transactions Ledger
    const txQuery = query(
      collection(db, 'commission_transactions'),
      where('driverId', '==', driverId)
    );

    const unsubTx = onSnapshot(txQuery, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionTransaction));
      items.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(items);
    });

    return () => {
      unsubUser();
      unsubRides();
      unsubTx();
    };
  }, [driverId]);

  const commissionBalance = driverProfile?.commissionBalance ?? 0;
  const commissionBlockLimit = driverProfile?.commissionBlockLimit ?? DEFAULT_COMMISSION_BLOCK_LIMIT;
  const totalCommissionPaid = driverProfile?.totalCommissionPaid ?? 0;
  const totalCommissionDue = driverProfile?.totalCommissionDue ?? (commissionBalance + totalCommissionPaid);
  const totalRideIncome = driverProfile?.totalRideIncome ?? 0;
  const isBlocked = commissionBalance >= commissionBlockLimit;
  const isAdminSuspended = driverProfile?.adminRideAccess === 'SUSPENDED';

  // Calculate access evaluation
  const accessEval = evaluateDriverRideAccess(driverProfile, null);

  return (
    <div className="bg-white rounded-[2.5rem] card-shadow border border-slate-100 p-6 md:p-8 flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl shadow-sm shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Driver Commission & Balance
              <span className="text-xs font-bold text-slate-400">/ কমিশন ও ব্যালেন্স</span>
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              10% Company Commission • Cashfree Payments Integration
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <CreditCard className="w-4 h-4" />
          <span>Pay Commission / কমিশন পরিশোধ করুন</span>
        </button>
      </div>

      {/* Ride Access Status Banner */}
      <div className={cn(
        "p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all",
        isAdminSuspended
          ? "bg-amber-50 border-amber-200"
          : isBlocked
          ? "bg-rose-50 border-rose-200"
          : "bg-emerald-50/70 border-emerald-200"
      )}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl shrink-0 text-white",
            isAdminSuspended ? "bg-amber-600" : isBlocked ? "bg-rose-600" : "bg-emerald-600"
          )}>
            {isAdminSuspended ? (
              <ShieldAlert className="w-5 h-5" />
            ) : isBlocked ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Ride Access Status / রাইড পাওয়ার অবস্থা
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border",
                isAdminSuspended
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : isBlocked
                  ? "bg-rose-100 text-rose-900 border-rose-300"
                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
              )}>
                {isAdminSuspended ? 'SUSPENDED BY ADMIN' : isBlocked ? 'BLOCKED (LIMIT REACHED)' : 'ACTIVE'}
              </span>
            </div>

            <p className={cn(
              "text-xs font-bold mt-1",
              isAdminSuspended ? "text-amber-900" : isBlocked ? "text-rose-900" : "text-emerald-900"
            )}>
              {isAdminSuspended
                ? "Admin has paused your new ride requests. Contact admin to resume."
                : isBlocked
                ? `Commission limit (₹${commissionBlockLimit}) reached! New rides are paused. Ongoing rides are never cancelled. Pay commission to resume receiving new rides.`
                : "You are active and eligible to receive new ride bookings. Ongoing and new rides allowed."}
            </p>
          </div>
        </div>

        {isBlocked && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 self-start sm:self-center shadow-md active:scale-95"
          >
            Pay ₹{commissionBalance} Now
          </button>
        )}
      </div>

      {/* Main Commission & Earnings Grid (Requirement 2 & 10) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Today's Income */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Today's Income
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {formatCurrency(todayIncome)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">
            {todayCompletedRides} rides today
          </div>
        </div>

        {/* 2. Today's Completed Rides */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Completed Rides
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {todayCompletedRides}
          </div>
          <div className="text-[10px] text-brand-600 font-bold mt-1">
            Today's trips
          </div>
        </div>

        {/* 3. Total Ride Income */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Total Ride Income
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            {formatCurrency(totalRideIncome)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1">
            Lifetime earnings
          </div>
        </div>

        {/* 4. Commission Due */}
        <div className={cn(
          "p-4 rounded-2xl border",
          isBlocked ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-100"
        )}>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Commission Due
          </div>
          <div className={cn(
            "text-xl font-black tracking-tight",
            isBlocked ? "text-rose-600" : "text-slate-900"
          )}>
            {formatCurrency(commissionBalance)}
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            Limit: ₹{commissionBlockLimit}
          </div>
        </div>

        {/* 5. Commission Paid */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Commission Paid
          </div>
          <div className="text-xl font-black text-emerald-600 tracking-tight">
            {formatCurrency(totalCommissionPaid)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">
            Via Cashfree
          </div>
        </div>

        {/* 6. Current Commission Balance */}
        <div className={cn(
          "p-4 rounded-2xl border",
          isBlocked ? "bg-rose-100/60 border-rose-300" : "bg-brand-50/70 border-brand-200"
        )}>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
            Current Balance
          </div>
          <div className={cn(
            "text-xl font-black tracking-tight",
            isBlocked ? "text-rose-700" : "text-brand-700"
          )}>
            {formatCurrency(commissionBalance)}
          </div>
          <div className="text-[10px] font-black uppercase mt-1 text-slate-500">
            {isBlocked ? 'Blocked' : 'Active'}
          </div>
        </div>
      </div>

      {/* Commission Limit Progress Bar */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-slate-600">
            Commission Blocking Threshold Progress: {formatCurrency(commissionBalance)} / {formatCurrency(commissionBlockLimit)}
          </span>
          <span className={cn(
            "text-[10px] font-black uppercase",
            isBlocked ? "text-rose-600" : "text-slate-500"
          )}>
            {isBlocked ? '100% (Limit Exceeded)' : `${Math.min(100, Math.round((commissionBalance / commissionBlockLimit) * 100))}%`}
          </span>
        </div>

        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isBlocked ? "bg-rose-500" : commissionBalance >= 80 ? "bg-amber-500" : "bg-brand-600"
            )}
            style={{ width: `${Math.min(100, (commissionBalance / commissionBlockLimit) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-2 font-medium">
          Note: Rides already accepted continue normally. Only new ride bookings are paused if balance reaches ₹{commissionBlockLimit}.
        </p>
      </div>

      {/* Commission Transaction History (Requirement 12) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Commission History / কমিশন হিস্ট্রি
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Detailed ledger of 10% ride deductions and Cashfree payments
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
            {transactions.length} Records
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
              No commission transactions recorded yet. Complete rides to start logging transactions.
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    tx.type === 'COMMISSION_PAYMENT' || tx.type === 'WALLET_RECHARGE' || tx.type === 'ADMIN_MANUAL_RECHARGE'
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-rose-100 text-rose-700"
                  )}>
                    {tx.type === 'COMMISSION_PAYMENT' || tx.type === 'WALLET_RECHARGE' || tx.type === 'ADMIN_MANUAL_RECHARGE' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>
                        {tx.type === 'ADMIN_MANUAL_RECHARGE'
                          ? 'Admin Manual Recharge'
                          : tx.type === 'COMMISSION_PAYMENT'
                          ? 'Commission Payment (Cashfree)'
                          : tx.type === 'WALLET_RECHARGE'
                          ? 'Wallet Recharge'
                          : 'Ride Commission (10%)'}
                      </span>
                      {tx.type === 'ADMIN_MANUAL_RECHARGE' && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Admin Credit
                        </span>
                      )}
                      {tx.rideId && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{tx.rideId.slice(0, 6)}
                        </span>
                      )}
                      {tx.orderId && (
                        <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {tx.orderId.slice(0, 14)}...
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(tx.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} • {tx.type === 'ADMIN_MANUAL_RECHARGE' ? 'ADMIN_ADJUSTMENT' : (tx.paymentMethod || 'AUTO_DEDUCT')}
                      {tx.previousBalance !== undefined && tx.newBalance !== undefined && (
                        <span className="ml-1 text-slate-500 font-medium">
                          (Prev: ₹{Math.abs(tx.previousBalance)}, Rem: ₹{Math.abs(tx.newBalance)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={cn(
                    "text-sm font-black",
                    tx.type === 'COMMISSION_PAYMENT' || tx.type === 'WALLET_RECHARGE' || tx.type === 'ADMIN_MANUAL_RECHARGE'
                      ? "text-emerald-600" 
                      : "text-slate-800"
                  )}>
                    {tx.type === 'ADMIN_MANUAL_RECHARGE'
                      ? `+${formatCurrency(tx.amount)} (Credit)`
                      : tx.type === 'COMMISSION_PAYMENT' || tx.type === 'WALLET_RECHARGE' 
                      ? `-${formatCurrency(tx.amount)} (Paid)` 
                      : `+${formatCurrency(tx.amount)} (Due)`}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">
                    {tx.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <CommissionPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        driverId={driverId}
        driverName={driverName}
        commissionDue={commissionBalance}
        commissionBlockLimit={commissionBlockLimit}
        onPaymentSuccess={() => {
          // Re-trigger refresh if needed
        }}
      />
    </div>
  );
}
